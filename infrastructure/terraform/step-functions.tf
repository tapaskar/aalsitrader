# Step Functions State Machine for Trading Squad Agent Orchestration

# IAM Role for Step Functions
resource "aws_iam_role" "step_functions" {
  name = "trading-squad-sfn-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "step_functions" {
  name = "trading-squad-sfn-policy"
  role = aws_iam_role.step_functions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = [
          aws_lambda_function.agent_orchestrator.arn,
          aws_lambda_function.agent_alpha.arn,
          aws_lambda_function.agent_beta.arn,
          aws_lambda_function.agent_gamma.arn,
          aws_lambda_function.agent_theta.arn,
          aws_lambda_function.agent_delta.arn,
          aws_lambda_function.agent_sigma.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Role for EventBridge to invoke Step Functions
resource "aws_iam_role" "eventbridge_sfn" {
  name = "trading-squad-eventbridge-sfn-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "eventbridge_sfn" {
  name = "trading-squad-eventbridge-sfn-policy"
  role = aws_iam_role.eventbridge_sfn.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "states:StartExecution"
        Resource = aws_sfn_state_machine.trading_squad.arn
      }
    ]
  })
}

# Step Functions State Machine
resource "aws_sfn_state_machine" "trading_squad" {
  name     = "trading-squad-orchestrator-${var.environment}"
  role_arn = aws_iam_role.step_functions.arn

  definition = jsonencode({
    Comment = "Trading Squad Agent Orchestration"
    StartAt = "DetermineAction"
    States = {
      DetermineAction = {
        Type = "Choice"
        Choices = [
          {
            Variable    = "$.action"
            StringEquals = "wake_all"
            Next        = "WakeAllAgents"
          },
          {
            Variable    = "$.action"
            StringEquals = "sleep_all"
            Next        = "SleepAllAgents"
          },
          {
            Variable    = "$.action"
            StringEquals = "eod_summary"
            Next        = "RunDeltaOnly"
          }
        ]
        Default = "LoadAgentMemory"
      }

      # ── Pre-market: Wake all agents ──
      WakeAllAgents = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.agent_orchestrator.arn
          Payload = {
            "action"      = "wake_all"
            "executionId.$" = "$$.Execution.Id"
            "timestamp.$"   = "$$.State.EnteredTime"
          }
        }
        ResultPath = "$.wakeResult"
        End        = true
      }

      # ── Post-market: Sleep all agents ──
      SleepAllAgents = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.agent_orchestrator.arn
          Payload = {
            "action"      = "sleep_all"
            "executionId.$" = "$$.Execution.Id"
            "timestamp.$"   = "$$.State.EnteredTime"
          }
        }
        ResultPath = "$.sleepResult"
        End        = true
      }

      # ── EOD: Run Delta journal only ──
      RunDeltaOnly = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.agent_delta.arn
          Payload = {
            "executionId.$" = "$$.Execution.Id"
            "timestamp.$"   = "$$.State.EnteredTime"
          }
        }
        ResultPath = "$.deltaResult"
        Retry = [
          {
            ErrorEquals     = ["States.ALL"]
            IntervalSeconds = 5
            MaxAttempts     = 1
            BackoffRate     = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.deltaError"
            Next        = "HandleError"
          }
        ]
        Next = "SaveAndBroadcast"
      }

      # ── Main flow: Load memory, run agents in parallel, aggregate ──
      LoadAgentMemory = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.agent_orchestrator.arn
          Payload = {
            "action"      = "load_memory"
            "executionId.$" = "$$.Execution.Id"
            "timestamp.$"   = "$$.State.EnteredTime"
          }
        }
        ResultSelector = {
          "executionId.$"   = "$.Payload.executionId"
          "timestamp.$"     = "$.Payload.timestamp"
          "sharedContext.$" = "$.Payload.sharedContext"
        }
        ResultPath = "$.memoryContext"
        Retry = [
          {
            ErrorEquals     = ["States.ALL"]
            IntervalSeconds = 3
            MaxAttempts     = 1
            BackoffRate     = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.memoryError"
            Next        = "RunParallelAgentsNoContext"
          }
        ]
        Next = "RunParallelAgents"
      }

      # Parallel agent execution with shared context
      RunParallelAgents = {
        Type = "Parallel"
        Branches = [
          {
            StartAt = "RunAlpha"
            States = {
              RunAlpha = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_alpha.arn
                  Payload = {
                    "executionId.$"   = "$.memoryContext.executionId"
                    "timestamp.$"     = "$.memoryContext.timestamp"
                    "sharedContext.$" = "$.memoryContext.sharedContext"
                    "scheduledAgents.$" = "$.agents"
                  }
                }
                ResultSelector = {
                  "agentId"   = "alpha"
                  "result.$"  = "$.Payload"
                }
                Retry = [
                  {
                    ErrorEquals     = ["States.ALL"]
                    IntervalSeconds = 5
                    MaxAttempts     = 1
                    BackoffRate     = 2
                  }
                ]
                Catch = [
                  {
                    ErrorEquals = ["States.ALL"]
                    ResultPath  = "$.error"
                    Next        = "AlphaFailed"
                  }
                ]
                End = true
              }
              AlphaFailed = {
                Type   = "Pass"
                Result = { "agentId" = "alpha", "error" = true }
                End    = true
              }
            }
          },
          {
            StartAt = "RunBeta"
            States = {
              RunBeta = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_beta.arn
                  Payload = {
                    "executionId.$"   = "$.memoryContext.executionId"
                    "timestamp.$"     = "$.memoryContext.timestamp"
                    "sharedContext.$" = "$.memoryContext.sharedContext"
                    "scheduledAgents.$" = "$.agents"
                  }
                }
                ResultSelector = {
                  "agentId"   = "beta"
                  "result.$"  = "$.Payload"
                }
                Retry = [
                  {
                    ErrorEquals     = ["States.ALL"]
                    IntervalSeconds = 5
                    MaxAttempts     = 1
                    BackoffRate     = 2
                  }
                ]
                Catch = [
                  {
                    ErrorEquals = ["States.ALL"]
                    ResultPath  = "$.error"
                    Next        = "BetaFailed"
                  }
                ]
                End = true
              }
              BetaFailed = {
                Type   = "Pass"
                Result = { "agentId" = "beta", "error" = true }
                End    = true
              }
            }
          },
          {
            StartAt = "RunGamma"
            States = {
              RunGamma = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_gamma.arn
                  Payload = {
                    "executionId.$"   = "$.memoryContext.executionId"
                    "timestamp.$"     = "$.memoryContext.timestamp"
                    "sharedContext.$" = "$.memoryContext.sharedContext"
                    "scheduledAgents.$" = "$.agents"
                  }
                }
                ResultSelector = {
                  "agentId"   = "gamma"
                  "result.$"  = "$.Payload"
                }
                Retry = [
                  {
                    ErrorEquals     = ["States.ALL"]
                    IntervalSeconds = 5
                    MaxAttempts     = 1
                    BackoffRate     = 2
                  }
                ]
                Catch = [
                  {
                    ErrorEquals = ["States.ALL"]
                    ResultPath  = "$.error"
                    Next        = "GammaFailed"
                  }
                ]
                End = true
              }
              GammaFailed = {
                Type   = "Pass"
                Result = { "agentId" = "gamma", "error" = true }
                End    = true
              }
            }
          },
          {
            StartAt = "RunTheta"
            States = {
              RunTheta = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_theta.arn
                  Payload = {
                    "executionId.$"   = "$.memoryContext.executionId"
                    "timestamp.$"     = "$.memoryContext.timestamp"
                    "sharedContext.$" = "$.memoryContext.sharedContext"
                    "scheduledAgents.$" = "$.agents"
                  }
                }
                ResultSelector = {
                  "agentId"   = "theta"
                  "result.$"  = "$.Payload"
                }
                Retry = [
                  {
                    ErrorEquals     = ["States.ALL"]
                    IntervalSeconds = 5
                    MaxAttempts     = 1
                    BackoffRate     = 2
                  }
                ]
                Catch = [
                  {
                    ErrorEquals = ["States.ALL"]
                    ResultPath  = "$.error"
                    Next        = "ThetaFailed"
                  }
                ]
                End = true
              }
              ThetaFailed = {
                Type   = "Pass"
                Result = { "agentId" = "theta", "error" = true }
                End    = true
              }
            }
          },
          {
            StartAt = "RunDelta"
            States = {
              RunDelta = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_delta.arn
                  Payload = {
                    "executionId.$"   = "$.memoryContext.executionId"
                    "timestamp.$"     = "$.memoryContext.timestamp"
                    "sharedContext.$" = "$.memoryContext.sharedContext"
                    "scheduledAgents.$" = "$.agents"
                  }
                }
                ResultSelector = {
                  "agentId"   = "delta"
                  "result.$"  = "$.Payload"
                }
                Retry = [
                  {
                    ErrorEquals     = ["States.ALL"]
                    IntervalSeconds = 5
                    MaxAttempts     = 1
                    BackoffRate     = 2
                  }
                ]
                Catch = [
                  {
                    ErrorEquals = ["States.ALL"]
                    ResultPath  = "$.error"
                    Next        = "DeltaFailed"
                  }
                ]
                End = true
              }
              DeltaFailed = {
                Type   = "Pass"
                Result = { "agentId" = "delta", "error" = true }
                End    = true
              }
            }
          }
        ]
        ResultPath = "$.agentResults"
        Next       = "AggregateResults"
      }

      # Fallback: Run agents without shared context
      RunParallelAgentsNoContext = {
        Type = "Parallel"
        Branches = [
          {
            StartAt = "RunAlphaNC"
            States = {
              RunAlphaNC = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_alpha.arn
                  Payload = {
                    "executionId.$" = "$$.Execution.Id"
                    "timestamp.$"   = "$$.State.EnteredTime"
                    "scheduledAgents.$" = "$.agents"
                  }
                }
                ResultSelector = { "agentId" = "alpha", "result.$" = "$.Payload" }
                Retry = [{ ErrorEquals = ["States.ALL"], IntervalSeconds = 5, MaxAttempts = 1, BackoffRate = 2 }]
                Catch = [{ ErrorEquals = ["States.ALL"], ResultPath = "$.error", Next = "AlphaNCFailed" }]
                End = true
              }
              AlphaNCFailed = { Type = "Pass", Result = { "agentId" = "alpha", "error" = true }, End = true }
            }
          },
          {
            StartAt = "RunBetaNC"
            States = {
              RunBetaNC = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_beta.arn
                  Payload = { "executionId.$" = "$$.Execution.Id", "timestamp.$" = "$$.State.EnteredTime", "scheduledAgents.$" = "$.agents" }
                }
                ResultSelector = { "agentId" = "beta", "result.$" = "$.Payload" }
                Retry = [{ ErrorEquals = ["States.ALL"], IntervalSeconds = 5, MaxAttempts = 1, BackoffRate = 2 }]
                Catch = [{ ErrorEquals = ["States.ALL"], ResultPath = "$.error", Next = "BetaNCFailed" }]
                End = true
              }
              BetaNCFailed = { Type = "Pass", Result = { "agentId" = "beta", "error" = true }, End = true }
            }
          },
          {
            StartAt = "RunGammaNC"
            States = {
              RunGammaNC = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_gamma.arn
                  Payload = { "executionId.$" = "$$.Execution.Id", "timestamp.$" = "$$.State.EnteredTime", "scheduledAgents.$" = "$.agents" }
                }
                ResultSelector = { "agentId" = "gamma", "result.$" = "$.Payload" }
                Retry = [{ ErrorEquals = ["States.ALL"], IntervalSeconds = 5, MaxAttempts = 1, BackoffRate = 2 }]
                Catch = [{ ErrorEquals = ["States.ALL"], ResultPath = "$.error", Next = "GammaNCFailed" }]
                End = true
              }
              GammaNCFailed = { Type = "Pass", Result = { "agentId" = "gamma", "error" = true }, End = true }
            }
          },
          {
            StartAt = "RunThetaNC"
            States = {
              RunThetaNC = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_theta.arn
                  Payload = { "executionId.$" = "$$.Execution.Id", "timestamp.$" = "$$.State.EnteredTime", "scheduledAgents.$" = "$.agents" }
                }
                ResultSelector = { "agentId" = "theta", "result.$" = "$.Payload" }
                Retry = [{ ErrorEquals = ["States.ALL"], IntervalSeconds = 5, MaxAttempts = 1, BackoffRate = 2 }]
                Catch = [{ ErrorEquals = ["States.ALL"], ResultPath = "$.error", Next = "ThetaNCFailed" }]
                End = true
              }
              ThetaNCFailed = { Type = "Pass", Result = { "agentId" = "theta", "error" = true }, End = true }
            }
          },
          {
            StartAt = "RunDeltaNC"
            States = {
              RunDeltaNC = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke"
                Parameters = {
                  FunctionName = aws_lambda_function.agent_delta.arn
                  Payload = { "executionId.$" = "$$.Execution.Id", "timestamp.$" = "$$.State.EnteredTime", "scheduledAgents.$" = "$.agents" }
                }
                ResultSelector = { "agentId" = "delta", "result.$" = "$.Payload" }
                Retry = [{ ErrorEquals = ["States.ALL"], IntervalSeconds = 5, MaxAttempts = 1, BackoffRate = 2 }]
                Catch = [{ ErrorEquals = ["States.ALL"], ResultPath = "$.error", Next = "DeltaNCFailed" }]
                End = true
              }
              DeltaNCFailed = { Type = "Pass", Result = { "agentId" = "delta", "error" = true }, End = true }
            }
          }
        ]
        ResultPath = "$.agentResults"
        Next       = "AggregateResults"
      }

      # Aggregate all agent outputs
      AggregateResults = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.agent_orchestrator.arn
          Payload = {
            "action"        = "aggregate"
            "executionId.$" = "$$.Execution.Id"
            "timestamp.$"   = "$$.State.EnteredTime"
            "agentResults.$" = "$.agentResults"
          }
        }
        ResultSelector = {
          "executionId.$" = "$.Payload.executionId"
          "timestamp.$"   = "$.Payload.timestamp"
          "aggregated.$"  = "$.Payload.aggregated"
        }
        ResultPath = "$.aggregation"
        Next       = "RunSigma"
      }

      # Sigma runs AFTER all other agents (has full context)
      RunSigma = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.agent_sigma.arn
          Payload = {
            "executionId.$" = "$$.Execution.Id"
            "timestamp.$"   = "$$.State.EnteredTime"
            "sharedContext.$" = "$.aggregation.aggregated"
          }
        }
        ResultPath = "$.sigmaResult"
        Retry = [
          {
            ErrorEquals     = ["States.ALL"]
            IntervalSeconds = 5
            MaxAttempts     = 1
            BackoffRate     = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.sigmaError"
            Next        = "SaveAndBroadcast"
          }
        ]
        Next = "SaveAndBroadcast"
      }

      # Final step: broadcast summary
      SaveAndBroadcast = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.agent_orchestrator.arn
          Payload = {
            "action"        = "save_and_broadcast"
            "executionId.$" = "$$.Execution.Id"
            "timestamp.$"   = "$$.State.EnteredTime"
            "aggregated.$"  = "$.aggregation.aggregated"
          }
        }
        ResultPath = "$.broadcastResult"
        End        = true
      }

      # Error fallback
      HandleError = {
        Type   = "Pass"
        Result = { "status" = "error", "message" = "Agent execution failed - check CloudWatch logs" }
        End    = true
      }
    }
  })
}
