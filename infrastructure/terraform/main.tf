terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5.0"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "trading-squad-dashboard"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"  # Mumbai region for India markets
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Domain name for the dashboard"
  type        = string
  default     = "trading-squad.yourdomain.com"
}

variable "dhan_access_token" {
  description = "DhanHQ API access token"
  type        = string
  default     = ""
  sensitive   = true
}

variable "dhan_client_id" {
  description = "DhanHQ client ID"
  type        = string
  default     = ""
}

variable "lemonsqueezy_signing_secret" {
  description = "Lemon Squeezy webhook signing secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "encryption_key" {
  description = "AES-256 encryption key for broker credentials (32 bytes)"
  type        = string
  default     = "trading-squad-enc-key-32bytes!!"
  sensitive   = true
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Outputs
output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "websocket_endpoint" {
  description = "WebSocket API endpoint"
  value       = aws_apigatewayv2_stage.websocket.invoke_url
}

output "s3_bucket_name" {
  description = "S3 bucket for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "api_gateway_url" {
  description = "HTTP API endpoint"
  value       = aws_apigatewayv2_stage.http.invoke_url
}
