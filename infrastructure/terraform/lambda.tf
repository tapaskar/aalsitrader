# IAM Role for Lambda
resource "aws_iam_role" "lambda" {
  name = "trading-squad-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "trading-squad-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.agent_state.arn,
          aws_dynamodb_table.connections.arn,
          aws_dynamodb_table.activities.arn,
          aws_dynamodb_table.trades.arn,
          aws_dynamodb_table.communications.arn,
          "${aws_dynamodb_table.agent_state.arn}/index/*",
          "${aws_dynamodb_table.activities.arn}/index/*",
          "${aws_dynamodb_table.trades.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections",
          "execute-api:Invoke"
        ]
        Resource = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.websocket.id}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      # Bedrock permissions for LLM calls
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          # Foundation models (wildcard region for cross-region inference profiles)
          "arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
          # APAC inference profiles
          "arn:aws:bedrock:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:inference-profile/apac.*"
        ]
      },
      # Lambda invoke for cross-Lambda calls
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:zerodha-technical-indicators",
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:stock-news-rag-query",
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:zerodha-trading-api",
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:zerodha-chart-data-api",
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:stock-analysis-batch-processor",
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:zerodha-token-manager"
        ]
      },
      # DynamoDB for momentum, sigma-memory, users, and chat tables
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.momentum_trades.arn,
          "${aws_dynamodb_table.momentum_trades.arn}/index/*",
          aws_dynamodb_table.momentum_portfolio.arn,
          "${aws_dynamodb_table.momentum_portfolio.arn}/index/*",
          aws_dynamodb_table.momentum_signals.arn,
          "${aws_dynamodb_table.momentum_signals.arn}/index/*",
          aws_dynamodb_table.momentum_config.arn,
          "${aws_dynamodb_table.momentum_config.arn}/index/*",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/sigma-memory-prod",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/sigma-memory-prod/index/*",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/users-prod",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/trading-squad-chat-messages-prod",
          aws_dynamodb_table.agent_memory.arn,
          "${aws_dynamodb_table.agent_memory.arn}/index/*",
          aws_dynamodb_table.nifty_straddle.arn,
          "${aws_dynamodb_table.nifty_straddle.arn}/index/*"
        ]
      },
      # ECS permissions for Fargate scaling (straddle start/stop)
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService"
        ]
        Resource = [
          "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.straddle.name}/${aws_ecs_service.straddle.name}"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda Layer for dependencies
# PRE-REQUISITE: Build layer.zip before running terraform apply:
#   cd backend && mkdir -p /tmp/layer-build && cp package.json package-lock.json /tmp/layer-build/ && \
#   cd /tmp/layer-build && npm ci --production && mkdir -p nodejs/node20 && mv node_modules nodejs/node20/ && \
#   zip -rq layer.zip nodejs/ && cp layer.zip <terraform>/lambda/ && rm -rf /tmp/layer-build
resource "aws_lambda_layer_version" "dependencies" {
  layer_name = "trading-squad-deps-${var.environment}"

  filename         = "lambda/layer.zip"
  source_code_hash = filebase64sha256("lambda/layer.zip")

  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]

  lifecycle {
    create_before_destroy = true
  }
}


# WebSocket Handler Lambda
resource "aws_lambda_function" "websocket" {
  function_name = "trading-squad-websocket-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "websocket.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 30
  memory_size   = 256

  # Deployment package
  filename         = "lambda/websocket.zip"
  source_code_hash = filebase64sha256("lambda/websocket.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      CONNECTIONS_TABLE    = aws_dynamodb_table.connections.name
      ACTIVITIES_TABLE     = aws_dynamodb_table.activities.name
      AGENT_STATE_TABLE    = aws_dynamodb_table.agent_state.name
      WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/prod"
    }
  }

  # Pre-build: npm run build:websocket && cp dist/websocket.js terraform/lambda/ && cd terraform/lambda && zip websocket.zip websocket.js
}

# HTTP API Handler Lambda
resource "aws_lambda_function" "http_api" {
  function_name = "trading-squad-http-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "http.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 30
  memory_size   = 256

  filename         = "lambda/http.zip"
  source_code_hash = filebase64sha256("lambda/http.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      TRADES_TABLE             = aws_dynamodb_table.trades.name
      ACTIVITIES_TABLE         = aws_dynamodb_table.activities.name
      AGENT_STATE_TABLE        = aws_dynamodb_table.agent_state.name
      CONNECTIONS_TABLE        = aws_dynamodb_table.connections.name
      COMMUNICATIONS_TABLE     = aws_dynamodb_table.communications.name
      MOMENTUM_TRADES_TABLE    = aws_dynamodb_table.momentum_trades.name
      MOMENTUM_PORTFOLIO_TABLE = aws_dynamodb_table.momentum_portfolio.name
      MOMENTUM_SIGNALS_TABLE   = aws_dynamodb_table.momentum_signals.name
      MOMENTUM_CONFIG_TABLE    = aws_dynamodb_table.momentum_config.name
      CHAT_MESSAGES_TABLE      = "trading-squad-chat-messages-${var.environment}"
      NIFTY_STRADDLE_TABLE     = aws_dynamodb_table.nifty_straddle.name
      DHAN_ACCESS_TOKEN              = var.dhan_access_token
      DHAN_CLIENT_ID                 = var.dhan_client_id
      LEMONSQUEEZY_SIGNING_SECRET    = var.lemonsqueezy_signing_secret
      STAGE                          = var.environment
      WEBSOCKET_API_ENDPOINT         = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/prod"
    }
  }

  # Pre-build: npm run build:http
}

# Agent Simulator Lambda
resource "aws_lambda_function" "simulator" {
  function_name = "trading-squad-simulator-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "simulator.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 60
  memory_size   = 512

  filename         = "lambda/simulator.zip"
  source_code_hash = filebase64sha256("lambda/simulator.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      AGENT_STATE_TABLE        = aws_dynamodb_table.agent_state.name
      ACTIVITIES_TABLE         = aws_dynamodb_table.activities.name
      COMMUNICATIONS_TABLE     = aws_dynamodb_table.communications.name
      CONNECTIONS_TABLE        = aws_dynamodb_table.connections.name
      TRADES_TABLE             = aws_dynamodb_table.trades.name
      AGENT_MEMORY_TABLE       = aws_dynamodb_table.agent_memory.name
      MOMENTUM_TRADES_TABLE    = aws_dynamodb_table.momentum_trades.name
      MOMENTUM_PORTFOLIO_TABLE = aws_dynamodb_table.momentum_portfolio.name
      MOMENTUM_SIGNALS_TABLE   = aws_dynamodb_table.momentum_signals.name
      MOMENTUM_CONFIG_TABLE    = aws_dynamodb_table.momentum_config.name
      CHAT_MESSAGES_TABLE      = "trading-squad-chat-messages-${var.environment}"
      USERS_TABLE              = "users-${var.environment}"
      STAGE                    = var.environment
      WEBSOCKET_API_ENDPOINT   = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/prod"
    }
  }

  # Pre-build: npm run build:simulator
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "websocket" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}

resource "aws_lambda_permission" "http" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.http_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ── Agent Lambda Functions ──────────────────────────────────────────

locals {
  agent_env_vars = {
    AGENT_STATE_TABLE        = aws_dynamodb_table.agent_state.name
    ACTIVITIES_TABLE         = aws_dynamodb_table.activities.name
    COMMUNICATIONS_TABLE     = aws_dynamodb_table.communications.name
    CONNECTIONS_TABLE        = aws_dynamodb_table.connections.name
    TRADES_TABLE             = aws_dynamodb_table.trades.name
    AGENT_MEMORY_TABLE       = aws_dynamodb_table.agent_memory.name
    MOMENTUM_TRADES_TABLE    = aws_dynamodb_table.momentum_trades.name
    MOMENTUM_PORTFOLIO_TABLE = aws_dynamodb_table.momentum_portfolio.name
    MOMENTUM_SIGNALS_TABLE   = aws_dynamodb_table.momentum_signals.name
    MOMENTUM_CONFIG_TABLE    = aws_dynamodb_table.momentum_config.name
    CHAT_MESSAGES_TABLE      = "trading-squad-chat-messages-${var.environment}"
    STAGE                    = var.environment
    WEBSOCKET_API_ENDPOINT   = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/prod"
    DHAN_ACCESS_TOKEN        = var.dhan_access_token
    # Bedrock Agent IDs — populated automatically after terraform apply (bedrock-agents.tf)
    BEDROCK_AGENT_ALPHA_ID       = aws_bedrockagent_agent.alpha.agent_id
    BEDROCK_AGENT_ALPHA_ALIAS_ID = aws_bedrockagent_agent_alias.alpha.agent_alias_id
    BEDROCK_AGENT_BETA_ID        = aws_bedrockagent_agent.beta.agent_id
    BEDROCK_AGENT_BETA_ALIAS_ID  = aws_bedrockagent_agent_alias.beta.agent_alias_id
    BEDROCK_AGENT_GAMMA_ID       = aws_bedrockagent_agent.gamma.agent_id
    BEDROCK_AGENT_GAMMA_ALIAS_ID = aws_bedrockagent_agent_alias.gamma.agent_alias_id
    BEDROCK_AGENT_THETA_ID       = aws_bedrockagent_agent.theta.agent_id
    BEDROCK_AGENT_THETA_ALIAS_ID = aws_bedrockagent_agent_alias.theta.agent_alias_id
    BEDROCK_AGENT_DELTA_ID       = aws_bedrockagent_agent.delta.agent_id
    BEDROCK_AGENT_DELTA_ALIAS_ID = aws_bedrockagent_agent_alias.delta.agent_alias_id
    BEDROCK_AGENT_SIGMA_ID       = aws_bedrockagent_agent.sigma.agent_id
    BEDROCK_AGENT_SIGMA_ALIAS_ID = aws_bedrockagent_agent_alias.sigma.agent_alias_id
  }
}

# Orchestrator Lambda
resource "aws_lambda_function" "agent_orchestrator" {
  function_name = "trading-squad-orchestrator-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "agent-orchestrator.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 60
  memory_size   = 256

  filename         = "lambda/agent-orchestrator.zip"
  source_code_hash = filebase64sha256("lambda/agent-orchestrator.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = local.agent_env_vars
  }

  # Pre-build: npm run build:agent-orchestrator
}

# Alpha (Professor) Lambda
resource "aws_lambda_function" "agent_alpha" {
  function_name = "trading-squad-alpha-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "agent-alpha.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 120
  memory_size   = 256

  filename         = "lambda/agent-alpha.zip"
  source_code_hash = filebase64sha256("lambda/agent-alpha.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = local.agent_env_vars
  }

  # Pre-build: npm run build:agent-alpha
}

# Beta (Techno-Kid) Lambda
resource "aws_lambda_function" "agent_beta" {
  function_name = "trading-squad-beta-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "agent-beta.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 90
  memory_size   = 256

  filename         = "lambda/agent-beta.zip"
  source_code_hash = filebase64sha256("lambda/agent-beta.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = local.agent_env_vars
  }

  # Pre-build: npm run build:agent-beta
}

# Gamma (Risko-Frisco) Lambda
resource "aws_lambda_function" "agent_gamma" {
  function_name = "trading-squad-gamma-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "agent-gamma.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 90
  memory_size   = 256

  filename         = "lambda/agent-gamma.zip"
  source_code_hash = filebase64sha256("lambda/agent-gamma.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = local.agent_env_vars
  }

  # Pre-build: npm run build:agent-gamma
}

# Theta (Macro) Lambda
resource "aws_lambda_function" "agent_theta" {
  function_name = "trading-squad-theta-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "agent-theta.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 90
  memory_size   = 256

  filename         = "lambda/agent-theta.zip"
  source_code_hash = filebase64sha256("lambda/agent-theta.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = local.agent_env_vars
  }

  # Pre-build: npm run build:agent-theta
}

# Delta (Booky) Lambda
resource "aws_lambda_function" "agent_delta" {
  function_name = "trading-squad-delta-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "agent-delta.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 90
  memory_size   = 256

  filename         = "lambda/agent-delta.zip"
  source_code_hash = filebase64sha256("lambda/agent-delta.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = local.agent_env_vars
  }

  # Pre-build: npm run build:agent-delta
}

# Sigma (Prime) Lambda - Decision engine, needs more time/memory
resource "aws_lambda_function" "agent_sigma" {
  function_name = "trading-squad-sigma-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "agent-sigma.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 120
  memory_size   = 512

  filename         = "lambda/agent-sigma.zip"
  source_code_hash = filebase64sha256("lambda/agent-sigma.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = local.agent_env_vars
  }

  # Pre-build: npm run build:agent-sigma
}

# Autonomous Paper Trader Lambda (EventBridge → every 15 min during market hours)
resource "aws_lambda_function" "autonomous_trader" {
  function_name = "autonomous-trader-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 180
  memory_size   = 512

  filename         = "lambda/autonomous-trader.zip"
  source_code_hash = filebase64sha256("lambda/autonomous-trader.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      MOMENTUM_TRADES_TABLE    = aws_dynamodb_table.momentum_trades.name
      MOMENTUM_PORTFOLIO_TABLE = aws_dynamodb_table.momentum_portfolio.name
      MOMENTUM_SIGNALS_TABLE   = aws_dynamodb_table.momentum_signals.name
      MOMENTUM_CONFIG_TABLE    = aws_dynamodb_table.momentum_config.name
      MEMORY_TABLE             = "sigma-memory-${var.environment}"
      USERS_TABLE              = "users-${var.environment}"
      STAGE                    = var.environment
    }
  }

  # Pre-build: npm run build:auto-trader
}

# Nifty Straddle Ticker Lambda (EventBridge → every 3 min)
resource "aws_lambda_function" "nifty_straddle_ticker" {
  function_name = "nifty-straddle-ticker-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "nifty-straddle-ticker.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 30
  memory_size   = 256

  filename         = "lambda/nifty-straddle-ticker.zip"
  source_code_hash = filebase64sha256("lambda/nifty-straddle-ticker.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      NIFTY_STRADDLE_TABLE = aws_dynamodb_table.nifty_straddle.name
      USERS_TABLE          = "users-${var.environment}"
      DHAN_ACCESS_TOKEN    = var.dhan_access_token
      DHAN_CLIENT_ID       = var.dhan_client_id
      STAGE                = var.environment
      ENCRYPTION_KEY       = var.encryption_key
    }
  }
}

# NOTE: All Lambda functions must be pre-built before running terraform apply.
# Build steps:
#   cd backend && npm run build:all
#   Copy dist/*.js to infrastructure/terraform/lambda/ and zip each one
#   For the layer: build in a temp dir with npm ci --production
