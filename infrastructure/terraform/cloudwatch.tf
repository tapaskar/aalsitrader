# CloudWatch Dashboard for Trading Squad
# Creates monitoring dashboard with key metrics

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "trading-squad-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # Header
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# 🚀 Trading Squad Dashboard - ${var.environment}"
          background = "#1a1a2e"
        }
      },
      
      # Lambda Invocations
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Lambda Invocations"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.websocket.function_name, { color = "#00d4ff", label = "WebSocket" }],
            ["...", aws_lambda_function.http_api.function_name, { color = "#00d4aa", label = "HTTP API" }],
            ["...", aws_lambda_function.simulator.function_name, { color = "#a855f7", label = "Simulator" }],
            ["...", aws_lambda_function.agent_alpha.function_name, { color = "#ff6b6b", label = "Alpha" }],
            ["...", aws_lambda_function.agent_beta.function_name, { color = "#4ecdc4", label = "Beta" }],
            ["...", aws_lambda_function.agent_gamma.function_name, { color = "#a855f7", label = "Gamma" }],
            ["...", aws_lambda_function.agent_theta.function_name, { color = "#f97316", label = "Theta" }],
            ["...", aws_lambda_function.agent_delta.function_name, { color = "#3b82f6", label = "Delta" }],
            ["...", aws_lambda_function.agent_sigma.function_name, { color = "#10b981", label = "Sigma" }],
            ["...", aws_lambda_function.agent_orchestrator.function_name, { color = "#fbbf24", label = "Orchestrator" }]
          ]
          period = 300
          stat   = "Sum"
        }
      },

      # Lambda Errors
      {
        type   = "metric"
        x      = 8
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Lambda Errors"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.websocket.function_name, { color = "#ff6b6b" }],
            ["...", aws_lambda_function.http_api.function_name, { color = "#ef4444" }],
            ["...", aws_lambda_function.simulator.function_name, { color = "#dc2626" }],
            ["...", aws_lambda_function.agent_alpha.function_name, { color = "#ff6b6b", label = "Alpha" }],
            ["...", aws_lambda_function.agent_beta.function_name, { color = "#4ecdc4", label = "Beta" }],
            ["...", aws_lambda_function.agent_gamma.function_name, { color = "#a855f7", label = "Gamma" }],
            ["...", aws_lambda_function.agent_sigma.function_name, { color = "#10b981", label = "Sigma" }]
          ]
          period = 300
          stat   = "Sum"
          annotations = {
            horizontal = [
              { value = 1, color = "#ff0000", label = "Error Threshold" }
            ]
          }
        }
      },
      
      # Lambda Duration
      {
        type   = "metric"
        x      = 16
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Lambda Duration (ms)"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.websocket.function_name, { stat = "p99", color = "#00d4ff" }],
            ["...", aws_lambda_function.http_api.function_name, { stat = "p99", color = "#00d4aa" }],
            ["...", aws_lambda_function.simulator.function_name, { stat = "p99", color = "#a855f7" }]
          ]
          period = 300
        }
      },
      
      # WebSocket Connections
      {
        type   = "metric"
        x      = 0
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "WebSocket Connections"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApiGateway", "Connections", "ApiId", aws_apigatewayv2_api.websocket.id, { color = "#00d4ff" }],
            [".", "Messages", ".", ".", { color = "#10b981", stat = "Sum" }]
          ]
          period = 300
          stat   = "Average"
        }
      },
      
      # API Gateway Latency
      {
        type   = "metric"
        x      = 8
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "API Gateway Latency"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiId", aws_apigatewayv2_api.http.id, { color = "#f97316" }],
            ["...", aws_apigatewayv2_api.websocket.id, { color = "#00d4ff" }]
          ]
          period = 300
          stat   = "p99"
        }
      },
      
      # DynamoDB Capacity
      {
        type   = "metric"
        x      = 16
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "DynamoDB Consumed Capacity"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.activities.name, { color = "#00d4ff" }],
            ["...", "ConsumedWriteCapacityUnits", ".", ".", { color = "#00d4aa" }],
            ["...", aws_dynamodb_table.trades.name, "ConsumedReadCapacityUnits", { color = "#a855f7" }],
            ["...", "ConsumedWriteCapacityUnits", ".", { color = "#f97316" }]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      
      # Custom Metrics - Agent Activity
      {
        type   = "log"
        x      = 0
        y      = 13
        width  = 12
        height = 6
        properties = {
          title  = "Agent Activities (Last Hour)"
          region = data.aws_region.current.name
          query  = <<-EOT
            SOURCE '/aws/lambda/${aws_lambda_function.simulator.function_name}' | SOURCE '/aws/lambda/${aws_lambda_function.agent_alpha.function_name}' | SOURCE '/aws/lambda/${aws_lambda_function.agent_beta.function_name}' | SOURCE '/aws/lambda/${aws_lambda_function.agent_gamma.function_name}' | SOURCE '/aws/lambda/${aws_lambda_function.agent_theta.function_name}' | SOURCE '/aws/lambda/${aws_lambda_function.agent_delta.function_name}' | SOURCE '/aws/lambda/${aws_lambda_function.agent_sigma.function_name}'
            | fields @timestamp, @message
            | filter @message like /agentActivity/
            | stats count(*) as activities by bin(5m)
            | sort @timestamp desc
          EOT
        }
      },
      
      # Trade Volume
      {
        type   = "log"
        x      = 12
        y      = 13
        width  = 12
        height = 6
        properties = {
          title  = "Trade Volume"
          region = data.aws_region.current.name
          query  = <<-EOT
            SOURCE '/aws/lambda/${aws_lambda_function.http_api.function_name}'
            | fields @timestamp, @message
            | filter @message like /POST \/trades/
            | stats count(*) as new_trades by bin(1h)
            | sort @timestamp desc
          EOT
        }
      }
    ]
  })
}

# CloudWatch Alarms

# Lambda Error Alarm
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "trading-squad-lambda-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Lambda errors exceeded threshold"
  
  dimensions = {
    FunctionName = aws_lambda_function.websocket.function_name
  }
  
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# Lambda Duration Alarm
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "trading-squad-lambda-slow-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = 5000  # 5 seconds
  alarm_description   = "Lambda duration exceeded 5 seconds"
  
  dimensions = {
    FunctionName = aws_lambda_function.websocket.function_name
  }
  
  alarm_actions = [aws_sns_topic.alerts.arn]
}

# WebSocket Connection Alarm
resource "aws_cloudwatch_metric_alarm" "websocket_connections" {
  alarm_name          = "trading-squad-connections-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Connections"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Average"
  threshold           = 80  # Alert at 80% of 100 limit
  alarm_description   = "WebSocket connections approaching limit"
  
  dimensions = {
    ApiId = aws_apigatewayv2_api.websocket.id
  }
  
  alarm_actions = [aws_sns_topic.alerts.arn]
}

# DynamoDB Throttling Alarm
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttling" {
  alarm_name          = "trading-squad-dynamodb-throttled-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "DynamoDB requests being throttled"
  
  dimensions = {
    TableName = aws_dynamodb_table.activities.name
  }
  
  alarm_actions = [aws_sns_topic.alerts.arn]
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "trading-squad-alerts-${var.environment}"
}

# SNS Email Subscription (optional)
# resource "aws_sns_topic_subscription" "email" {
#   topic_arn = aws_sns_topic.alerts.arn
#   protocol  = "email"
#   endpoint  = "your-email@example.com"
# }

# Log Groups with retention
resource "aws_cloudwatch_log_group" "lambda_websocket" {
  name              = "/aws/lambda/${aws_lambda_function.websocket.function_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda_http" {
  name              = "/aws/lambda/${aws_lambda_function.http_api.function_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda_simulator" {
  name              = "/aws/lambda/${aws_lambda_function.simulator.function_name}"
  retention_in_days = 7
}

# Agent Lambda Log Groups
resource "aws_cloudwatch_log_group" "lambda_agent_orchestrator" {
  name              = "/aws/lambda/${aws_lambda_function.agent_orchestrator.function_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda_agent_alpha" {
  name              = "/aws/lambda/${aws_lambda_function.agent_alpha.function_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda_agent_beta" {
  name              = "/aws/lambda/${aws_lambda_function.agent_beta.function_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda_agent_gamma" {
  name              = "/aws/lambda/${aws_lambda_function.agent_gamma.function_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda_agent_theta" {
  name              = "/aws/lambda/${aws_lambda_function.agent_theta.function_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda_agent_delta" {
  name              = "/aws/lambda/${aws_lambda_function.agent_delta.function_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda_agent_sigma" {
  name              = "/aws/lambda/${aws_lambda_function.agent_sigma.function_name}"
  retention_in_days = 7
}

# Custom Metrics - Trade P&L
resource "aws_cloudwatch_log_metric_filter" "trade_profit" {
  name           = "trade-profit"
  pattern        = "{ $.status = \"closed\" && $.pnl > 0 }"
  log_group_name = aws_cloudwatch_log_group.lambda_http.name

  metric_transformation {
    name      = "TradeProfits"
    namespace = "TradingSquad"
    value     = "$.pnl"
    unit      = "Count"
  }
}

resource "aws_cloudwatch_log_metric_filter" "trade_loss" {
  name           = "trade-loss"
  pattern        = "{ $.status = \"closed\" && $.pnl < 0 }"
  log_group_name = aws_cloudwatch_log_group.lambda_http.name

  metric_transformation {
    name      = "TradeLosses"
    namespace = "TradingSquad"
    value     = "$.pnl"
    unit      = "Count"
  }
}
