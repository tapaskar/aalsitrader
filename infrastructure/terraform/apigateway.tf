# WebSocket API
resource "aws_apigatewayv2_api" "websocket" {
  name                       = "trading-squad-websocket-${var.environment}"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

# WebSocket Integrations
resource "aws_apigatewayv2_integration" "websocket_lambda" {
  api_id           = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.websocket.invoke_arn
  integration_method = "POST"
}

# WebSocket Routes
resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_lambda.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_lambda.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_lambda.id}"
}

resource "aws_apigatewayv2_route" "agentActivity" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "agentActivity"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_lambda.id}"
}

# WebSocket Stage
resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = "prod"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.websocket.arn
    format          = "$context.requestId $context.connectionId $context.routeKey"
  }

  depends_on = [aws_api_gateway_account.main]
}

# HTTP API (REST)
resource "aws_apigatewayv2_api" "http" {
  name          = "trading-squad-http-${var.environment}"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins  = [
      "https://d2h3cqo8hiy9mo.cloudfront.net",
      "https://aalsitrader.com",
      "https://www.aalsitrader.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ]
    allow_methods  = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers  = ["authorization", "content-type"]
    expose_headers = ["authorization"]
    max_age        = 300
  }
}

# HTTP Routes
resource "aws_apigatewayv2_route" "trades_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /trades"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "trades_post" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /trades"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "agents_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /agents"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "activities_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /activities"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "screener_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /screener"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "screener_chart_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /screener/chart"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "trading_rules_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /trading-rules"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "trading_rules_put" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "PUT /trading-rules"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "auth_forgot_password" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /auth/forgot-password"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "auth_reset_password" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /auth/reset-password"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

# ─── Webhook Routes ───────────────────────────────────────────

resource "aws_apigatewayv2_route" "webhook_lemonsqueezy" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /webhooks/lemonsqueezy"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

# ─── Nifty Straddle Routes ────────────────────────────────────

resource "aws_apigatewayv2_route" "nifty_straddle_status" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /nifty-straddle/status"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_capital" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /nifty-straddle/capital"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_current" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /nifty-straddle/current"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_trades" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /nifty-straddle/trades"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_start" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /nifty-straddle/start"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_stop" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /nifty-straddle/stop"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_mode" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /nifty-straddle/mode"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_broker" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /nifty-straddle/broker"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_index" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /nifty-straddle/index"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "nifty_straddle_strategy" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /nifty-straddle/strategy"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_route" "broker_portfolio_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /broker-portfolio"
  target    = "integrations/${aws_apigatewayv2_integration.http_lambda.id}"
}

resource "aws_apigatewayv2_integration" "http_lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.http_api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_stage" "http" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "prod"
  auto_deploy = true
}

# API Gateway Account Settings (required for access logging)
resource "aws_iam_role" "apigateway_cloudwatch" {
  name = "trading-squad-apigw-cw-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apigateway_cloudwatch" {
  role       = aws_iam_role.apigateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.apigateway_cloudwatch.arn
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "websocket" {
  name              = "/aws/apigateway/trading-squad-websocket-${var.environment}"
  retention_in_days = 7
}
