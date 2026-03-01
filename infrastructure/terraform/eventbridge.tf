# EventBridge Rules for Agent Scheduling
# Targets: Step Functions state machine (primary) + simulator Lambda (fallback)

# Market hours trigger (every 15 min, 9 AM - 4 PM IST weekdays)
resource "aws_cloudwatch_event_rule" "agent_heartbeat_15min" {
  name                = "trading-squad-15min-${var.environment}"
  description         = "Trigger agent orchestrator every 15 minutes during market hours"
  schedule_expression = "cron(*/15 3-10 ? * MON-FRI *)"  # UTC = IST - 5:30
}

resource "aws_cloudwatch_event_target" "sfn_15min" {
  rule      = aws_cloudwatch_event_rule.agent_heartbeat_15min.name
  target_id = "StepFunctionsOrchestrator"
  arn       = aws_sfn_state_machine.trading_squad.arn
  role_arn  = aws_iam_role.eventbridge_sfn.arn

  input = jsonencode({
    action = "simulate_heartbeat"
    agents = ["alpha", "gamma"]
  })
}

# 30-minute heartbeat for other agents
resource "aws_cloudwatch_event_rule" "agent_heartbeat_30min" {
  name                = "trading-squad-30min-${var.environment}"
  description         = "Trigger agent orchestrator every 30 minutes during market hours"
  schedule_expression = "cron(*/30 3-10 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_target" "sfn_30min" {
  rule      = aws_cloudwatch_event_rule.agent_heartbeat_30min.name
  target_id = "StepFunctionsOrchestrator"
  arn       = aws_sfn_state_machine.trading_squad.arn
  role_arn  = aws_iam_role.eventbridge_sfn.arn

  input = jsonencode({
    action = "simulate_heartbeat"
    agents = ["beta", "theta"]
  })
}

# Pre-market activation (9:00 AM IST = 3:30 AM UTC)
resource "aws_cloudwatch_event_rule" "pre_market" {
  name                = "trading-squad-pre-market-${var.environment}"
  description         = "Wake all agents before market open"
  schedule_expression = "cron(30 3 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_target" "sfn_pre_market" {
  rule      = aws_cloudwatch_event_rule.pre_market.name
  target_id = "StepFunctionsOrchestrator"
  arn       = aws_sfn_state_machine.trading_squad.arn
  role_arn  = aws_iam_role.eventbridge_sfn.arn

  input = jsonencode({
    action = "wake_all"
  })
}

# Post-market journal (4:30 PM IST = 11:00 AM UTC)
resource "aws_cloudwatch_event_rule" "post_market" {
  name                = "trading-squad-post-market-${var.environment}"
  description         = "Trigger Delta for EOD summary"
  schedule_expression = "cron(0 11 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_target" "sfn_post_market" {
  rule      = aws_cloudwatch_event_rule.post_market.name
  target_id = "StepFunctionsOrchestrator"
  arn       = aws_sfn_state_machine.trading_squad.arn
  role_arn  = aws_iam_role.eventbridge_sfn.arn

  input = jsonencode({
    action = "eod_summary"
  })
}

# Keep simulator Lambda permissions for manual/fallback invocation
resource "aws_lambda_permission" "eventbridge_15min" {
  statement_id  = "AllowEventBridge15minInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.simulator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.agent_heartbeat_15min.arn
}

resource "aws_lambda_permission" "eventbridge_30min" {
  statement_id  = "AllowEventBridge30minInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.simulator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.agent_heartbeat_30min.arn
}

resource "aws_lambda_permission" "eventbridge_pre_market" {
  statement_id  = "AllowEventBridgePreMarketInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.simulator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.pre_market.arn
}

resource "aws_lambda_permission" "eventbridge_post_market" {
  statement_id  = "AllowEventBridgePostMarketInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.simulator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.post_market.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# Autonomous Paper Trader (every 15 minutes during market hours)
# Scans smart money signals for entries + monitors open positions for exits
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_event_rule" "autonomous_trader_15min" {
  name                = "autonomous-trader-15min-${var.environment}"
  description         = "Trigger autonomous paper trader every 10 min during market hours"
  schedule_expression = "cron(*/10 3-10 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_target" "autonomous_trader" {
  rule      = aws_cloudwatch_event_rule.autonomous_trader_15min.name
  target_id = "AutoTraderLambda"
  arn       = aws_lambda_function.autonomous_trader.arn

  input = jsonencode({
    action = "scan_and_trade"
  })
}

resource "aws_lambda_permission" "eventbridge_autonomous_trader" {
  statement_id  = "AllowEventBridgeAutoTrader"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.autonomous_trader.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.autonomous_trader_15min.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# Nifty Straddle Ticker (every 3 minutes during market hours)
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_event_rule" "nifty_straddle_ticker" {
  name                = "nifty-straddle-ticker-${var.environment}"
  description         = "Trigger nifty straddle engine every 3 minutes during market hours (DISABLED — replaced by ECS Fargate)"
  schedule_expression = "cron(*/3 3-10 ? * MON-FRI *)"
  state               = "DISABLED"  # Disabled — Fargate handles this now via WebSocket
}

resource "aws_cloudwatch_event_target" "nifty_straddle_ticker" {
  rule      = aws_cloudwatch_event_rule.nifty_straddle_ticker.name
  target_id = "NiftyStraddleTicker"
  arn       = aws_lambda_function.nifty_straddle_ticker.arn
}

resource "aws_lambda_permission" "eventbridge_nifty_straddle" {
  statement_id  = "AllowEventBridgeNiftyStraddleInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nifty_straddle_ticker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.nifty_straddle_ticker.arn
}
