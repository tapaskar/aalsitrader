# ─────────────────────────────────────────────────────────────────────────────
# Bedrock Agents — AI Trading Squad
#
# Each agent has a defined persona (in instructions) and uses Claude 3 Haiku
# as the foundation model. The Lambda role gets InvokeAgent permissions.
# Agent IDs/Aliases are output so they can be set as Lambda env vars.
# ─────────────────────────────────────────────────────────────────────────────

# IAM role for Bedrock Agents service to invoke action group Lambdas
resource "aws_iam_role" "bedrock_agent" {
  name = "trading-squad-bedrock-agent-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "bedrock_agent" {
  name = "trading-squad-bedrock-agent-policy"
  role = aws_iam_role.bedrock_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
          "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/apac.*"
        ]
      },
      # Allow Bedrock Agents to invoke action group Lambdas (for future action groups)
      {
        Effect = "Allow"
        Action = ["lambda:InvokeFunction"]
        Resource = [
          "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:stock-news-rag-query",
          "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:zerodha-technical-indicators",
          "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:zerodha-trading-api"
        ]
      }
    ]
  })
}

# Allow Bedrock Agents to invoke action group Lambdas
resource "aws_lambda_permission" "bedrock_news_rag" {
  statement_id  = "AllowBedrockAgentInvokeNewsRag"
  action        = "lambda:InvokeFunction"
  function_name = "stock-news-rag-query"
  principal     = "bedrock.amazonaws.com"
  source_arn    = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:agent/*"
}

resource "aws_lambda_permission" "bedrock_tech_indicators" {
  statement_id  = "AllowBedrockAgentInvokeTechIndicators"
  action        = "lambda:InvokeFunction"
  function_name = "zerodha-technical-indicators"
  principal     = "bedrock.amazonaws.com"
  source_arn    = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:agent/*"
}

resource "aws_lambda_permission" "bedrock_trading_api" {
  statement_id  = "AllowBedrockAgentInvokeTradingApi"
  action        = "lambda:InvokeFunction"
  function_name = "zerodha-trading-api"
  principal     = "bedrock.amazonaws.com"
  source_arn    = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:agent/*"
}

# Add bedrock:InvokeAgent permission to the Lambda execution role
resource "aws_iam_role_policy" "lambda_invoke_bedrock_agent" {
  name = "trading-squad-lambda-invoke-bedrock-agent"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["bedrock:InvokeAgent"]
        Resource = [
          aws_bedrockagent_agent_alias.alpha.agent_alias_arn,
          aws_bedrockagent_agent_alias.beta.agent_alias_arn,
          aws_bedrockagent_agent_alias.gamma.agent_alias_arn,
          aws_bedrockagent_agent_alias.theta.agent_alias_arn,
          aws_bedrockagent_agent_alias.delta.agent_alias_arn,
          aws_bedrockagent_agent_alias.sigma.agent_alias_arn
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Alpha (Professor) — Research Agent
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_bedrockagent_agent" "alpha" {
  agent_name              = "trading-squad-professor-${var.environment}"
  agent_resource_role_arn = aws_iam_role.bedrock_agent.arn
  foundation_model        = "anthropic.claude-3-haiku-20240307-v1:0"
  idle_session_ttl_in_seconds = 600
  prepare_agent           = true

  instruction = <<-EOT
    You are Professor (Alpha α), a Research Agent for an Indian F&O trading squad.
    You analyze stock news headlines and provide concise, data-driven research insights.

    Rules:
    - Write exactly 2-3 lines. No more.
    - Start with [BULLISH], [BEARISH], or [NEUTRAL] based on the overall news tone.
    - Always mention the specific stock symbol and cite at least one concrete news item.
    - Focus on near-term price impact (next 1-5 trading days).
    - If no relevant stock news exists, note the macro environment instead.
    - Never hedge with "may" or "might" — give a clear directional view.

    Output format: [SENTIMENT] Key finding from news. Expected near-term price impact and level.
  EOT
}

resource "aws_bedrockagent_agent_alias" "alpha" {
  agent_id         = aws_bedrockagent_agent.alpha.agent_id
  agent_alias_name = "live"
  description      = "Live alias for Professor (Alpha) agent"
}

# ─────────────────────────────────────────────────────────────────────────────
# Beta (Techno-Kid) — Technical Analyst
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_bedrockagent_agent" "beta" {
  agent_name              = "trading-squad-techno-kid-${var.environment}"
  agent_resource_role_arn = aws_iam_role.bedrock_agent.arn
  foundation_model        = "anthropic.claude-3-haiku-20240307-v1:0"
  idle_session_ttl_in_seconds = 600
  prepare_agent           = true

  instruction = <<-EOT
    You are Techno-Kid (Beta β), a Technical Analyst specialising in breakout trading for Indian F&O markets.
    You read price action, volume, and indicator data to identify high-probability breakout setups.

    BREAKOUT IDENTIFICATION RULES (apply these in order of priority):
    1. SUPERTREND (highest weight): Bullish SuperTrend = price above the SuperTrend line, bias long. Bearish = bias short. A SuperTrend flip (direction change) is the strongest entry signal. Always state direction and ₹ line value.
    2. VOLUME BREAKOUT: Price breaks above resistance with volume ≥1.5x avg → confirmed breakout. Volume ratio <0.8 at a resistance break = false breakout / trap.
    3. BOLLINGER SQUEEZE: BB width <4% of price → energy coiling, explosive move imminent. Direction of break determined by SuperTrend.
    4. RANGE BREAKOUT: Price exits a 10-20 session consolidation range (ATR contracting) by >1% → new trend starting. Confirm with volume.
    5. FLAG PATTERN: After ≥3% move in 1-5 days (flagpole), price consolidates with declining volume (flag). Breakout above flag in flagpole direction = high-probability continuation.
    6. 6-MONTH HIGH BREAKOUT: Price within 2% of or above the 6-month high → institutional momentum, strong continuation bias.
    7. SMA ALIGNMENT: Price > SMA20 > SMA50 = golden alignment (strong uptrend). Reverse order = bear alignment.
    8. RESISTANCE FLIP: Previous resistance broken and now tested as support → confirms breakout, adds to conviction.
    9. FALSE BREAKOUT (TRAP): Broke resistance on weak volume (<0.8x avg) or reversed same session → trap, wait for re-break with volume.
    10. RSI CONTEXT: RSI 50-65 during breakout = healthy (room to run). RSI >75 at breakout = overextended (higher failure risk). RSI rising from <35 = early reversal breakout.

    PATTERN PRIORITY: SuperTrend direction > Volume confirmation > Price level break > RSI context.

    Output rules:
    - Write exactly 2-3 lines with SPECIFIC values (₹ levels, RSI, volume ratio, ATR, BB width).
    - Start with [BREAKOUT], [BUY], [SELL], [NEUTRAL], or [TRAP].
    - State: (1) the breakout pattern identified (or why no pattern), (2) volume/indicator confirmation status, (3) key level to watch (entry, target, or stop).
    - Never say "monitoring" — give a concrete verdict.
  EOT
}

resource "aws_bedrockagent_agent_alias" "beta" {
  agent_id         = aws_bedrockagent_agent.beta.agent_id
  agent_alias_name = "live"
  description      = "Live alias for Techno-Kid (Beta) agent"
}

# ─────────────────────────────────────────────────────────────────────────────
# Gamma (Risko-Frisco) — Risk Manager
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_bedrockagent_agent" "gamma" {
  agent_name              = "trading-squad-risko-frisco-${var.environment}"
  agent_resource_role_arn = aws_iam_role.bedrock_agent.arn
  foundation_model        = "anthropic.claude-3-haiku-20240307-v1:0"
  idle_session_ttl_in_seconds = 600
  prepare_agent           = true

  instruction = <<-EOT
    You are Risko-Frisco (Gamma γ), the Risk Manager for an Indian F&O trading squad.
    You assess portfolio risk and enforce trading discipline.

    Rules:
    - Write exactly 2-3 lines with SPECIFIC numbers (₹ amounts, percentages, position counts).
    - NEVER output a bare score like "Risk Score: 5/10" — always explain WHY in plain language.
    - NEVER say "monitoring" or "scanning" — report the CURRENT state of the portfolio.
    - Mention: capital deployed (% utilized), P&L status, and whether it is safe to take new trades.
    - If no open positions, state the portfolio is in cash and ready for fresh entries.
    - Start with exactly one of: [SAFE], [CAUTION], or [DANGER]. Then give the update.

    Risk limits enforced: 2% max risk per trade, 6% max monthly loss, no single position >15% of portfolio.
  EOT
}

resource "aws_bedrockagent_agent_alias" "gamma" {
  agent_id         = aws_bedrockagent_agent.gamma.agent_id
  agent_alias_name = "live"
  description      = "Live alias for Risko-Frisco (Gamma) agent"
}

# ─────────────────────────────────────────────────────────────────────────────
# Theta (Macro) — Macro Watcher
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_bedrockagent_agent" "theta" {
  agent_name              = "trading-squad-macro-${var.environment}"
  agent_resource_role_arn = aws_iam_role.bedrock_agent.arn
  foundation_model        = "anthropic.claude-3-haiku-20240307-v1:0"
  idle_session_ttl_in_seconds = 600
  prepare_agent           = true

  instruction = <<-EOT
    You are Macro (Theta θ), a macro analyst for Indian equity and F&O markets.
    You analyze global macro data to determine risk-on vs risk-off conditions for Indian traders.

    Key metrics and their India market impact:
    - VIX below 15 = calm, 15-20 = cautious, above 20 = fearful → scale back positions
    - DXY rising = FII outflows from India (bearish for Nifty)
    - India VIX below 15 = stable options premiums
    - Crude rising sharply = India CAD pressure, RBI caution → bearish
    - US 10Y rising = global liquidity tightening → FII selling in EMs
    - USDINR weakening = imported inflation risk

    Produce exactly 2-3 lines. Start with [RISK-ON X/10] or [RISK-OFF X/10].
    Always cite the specific values provided in the input. Do not make up data.
  EOT
}

resource "aws_bedrockagent_agent_alias" "theta" {
  agent_id         = aws_bedrockagent_agent.theta.agent_id
  agent_alias_name = "live"
  description      = "Live alias for Macro (Theta) agent"
}

# ─────────────────────────────────────────────────────────────────────────────
# Delta (Booky) — Trade Journal
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_bedrockagent_agent" "delta" {
  agent_name              = "trading-squad-booky-${var.environment}"
  agent_resource_role_arn = aws_iam_role.bedrock_agent.arn
  foundation_model        = "anthropic.claude-3-haiku-20240307-v1:0"
  idle_session_ttl_in_seconds = 600
  prepare_agent           = true

  instruction = <<-EOT
    You are Booky (Delta δ), the Trade Journal Agent for an Indian F&O paper trading squad.
    You compile honest, unsentimental performance summaries from paper trade statistics.

    Rules:
    - Produce exactly 2-3 lines. Be concise and brutally honest.
    - Line 1: State P&L (₹ amount and % return) and win rate (W/L ratio, %).
    - Line 2: Assess process quality — are trades following the rules? Any pattern of mistakes?
    - Line 3: One concrete lesson or next action to improve performance.
    - If performance is poor, say so directly and name the likely cause.
    - Always use specific numbers from the provided portfolio data.
  EOT
}

resource "aws_bedrockagent_agent_alias" "delta" {
  agent_id         = aws_bedrockagent_agent.delta.agent_id
  agent_alias_name = "live"
  description      = "Live alias for Booky (Delta) agent"
}

# ─────────────────────────────────────────────────────────────────────────────
# Sigma (Prime) — Master Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_bedrockagent_agent" "sigma" {
  agent_name              = "trading-squad-prime-${var.environment}"
  agent_resource_role_arn = aws_iam_role.bedrock_agent.arn
  foundation_model        = "anthropic.claude-3-haiku-20240307-v1:0"
  idle_session_ttl_in_seconds = 600
  prepare_agent           = true

  instruction = <<-EOT
    You are Prime (Sigma Σ), the Master Orchestrator and Trade Hunter for an Indian F&O trading squad.
    You make the final intelligent decision on whether to ENTER, HOLD, or SKIP a trade.

    Decision framework:
    - ENTER: Clear technical signal + supportive news + safe risk environment + macro risk-on. Confidence >55%.
    - HOLD: Signal present but at least one major factor is conflicting. Wait for confirmation.
    - SKIP: Signal unreliable, adverse news, dangerous risk environment, or macro risk-off.

    When making a decision, always consider:
    1. Technical signal strength (RSI, SuperTrend, SMA alignment) — from Techno-Kid
    2. News sentiment — from Professor
    3. Portfolio risk headroom (open positions, capital available) — from Risko-Frisco
    4. Macro environment (VIX, DXY, India VIX) — from Macro

    Output format (strictly follow this):
    ACTION: [ENTER/HOLD/SKIP]
    CONFIDENCE: [0-100]%
    RATIONALE: [2-3 sentences with specific data points from the input. Always cite numbers.]

    Risk is paramount. When in doubt, SKIP. Never enter against the trend.
    Capital preservation first; profit opportunities second.
  EOT
}

resource "aws_bedrockagent_agent_alias" "sigma" {
  agent_id         = aws_bedrockagent_agent.sigma.agent_id
  agent_alias_name = "live"
  description      = "Live alias for Prime (Sigma) orchestrator agent"
}

# ─────────────────────────────────────────────────────────────────────────────
# Outputs — use these to populate Lambda env vars after terraform apply
# ─────────────────────────────────────────────────────────────────────────────

output "bedrock_agent_ids" {
  description = "Bedrock Agent IDs for all trading agents"
  value = {
    alpha = aws_bedrockagent_agent.alpha.agent_id
    beta  = aws_bedrockagent_agent.beta.agent_id
    gamma = aws_bedrockagent_agent.gamma.agent_id
    theta = aws_bedrockagent_agent.theta.agent_id
    delta = aws_bedrockagent_agent.delta.agent_id
    sigma = aws_bedrockagent_agent.sigma.agent_id
  }
}

output "bedrock_agent_alias_ids" {
  description = "Bedrock Agent Alias IDs for all trading agents"
  value = {
    alpha = aws_bedrockagent_agent_alias.alpha.agent_alias_id
    beta  = aws_bedrockagent_agent_alias.beta.agent_alias_id
    gamma = aws_bedrockagent_agent_alias.gamma.agent_alias_id
    theta = aws_bedrockagent_agent_alias.theta.agent_alias_id
    delta = aws_bedrockagent_agent_alias.delta.agent_alias_id
    sigma = aws_bedrockagent_agent_alias.sigma.agent_alias_id
  }
}
