# DynamoDB Tables

# Agent State Table
resource "aws_dynamodb_table" "agent_state" {
  name           = "trading-squad-agent-state-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"  # On-demand for variable traffic
  hash_key       = "agentId"

  attribute {
    name = "agentId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Agent State Table"
  }
}

# WebSocket Connections Table
resource "aws_dynamodb_table" "connections" {
  name           = "trading-squad-connections-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "WebSocket Connections"
  }
}

# Activities/Events Table
resource "aws_dynamodb_table" "activities" {
  name           = "trading-squad-activities-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "timestamp"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  attribute {
    name = "agentId"
    type = "S"
  }

  global_secondary_index {
    name            = "AgentIdIndex"
    hash_key        = "agentId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Activities Table"
  }
}

# Trades Table
resource "aws_dynamodb_table" "trades" {
  name           = "trading-squad-trades-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "entryTime"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "entryTime"
    type = "N"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "entryTime"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Trades Table"
  }
}

# Communications Table
resource "aws_dynamodb_table" "communications" {
  name           = "trading-squad-comms-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "timestamp"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "Communications Table"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Momentum Trading Tables (Paper Trading System)
# ─────────────────────────────────────────────────────────────────────────────

# Paper Trading Trades Table
resource "aws_dynamodb_table" "momentum_trades" {
  name           = "momentum-trades-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Momentum Trading Trades"
  }
}

# Paper Trading Portfolio Table
resource "aws_dynamodb_table" "momentum_portfolio" {
  name           = "momentum-portfolio-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Momentum Trading Portfolio"
  }
}

# Momentum Trading Signals Table
resource "aws_dynamodb_table" "momentum_signals" {
  name           = "momentum-signals-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "symbol"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  global_secondary_index {
    name            = "SymbolIndex"
    hash_key        = "symbol"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Momentum Trading Signals"
  }
}

# Paper Trading Config Table
resource "aws_dynamodb_table" "momentum_config" {
  name           = "momentum-config-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Momentum Trading Config"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Agent Memory Table (Step Functions agent-to-agent communication)
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "agent_memory" {
  name           = "trading-squad-agent-memory-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name            = "DateIndex"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Agent Memory Table"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Nifty Straddle Table
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "nifty_straddle" {
  name           = "nifty-straddle-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusDateIndex"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "Nifty Straddle Table"
  }
}
