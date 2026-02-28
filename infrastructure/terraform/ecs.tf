# ─────────────────────────────────────────────────────────────────────────────
# ECS Fargate Infrastructure for Nifty Straddle Engine
# Replaces Lambda ticker with persistent WebSocket-based engine
# ─────────────────────────────────────────────────────────────────────────────

# ── VPC (minimal — public subnet with Elastic IP) ────────────────────────────

resource "aws_vpc" "straddle" {
  cidr_block           = "10.0.0.0/24"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "nifty-straddle-vpc-${var.environment}" }
}

resource "aws_subnet" "straddle_public_a" {
  vpc_id                  = aws_vpc.straddle.id
  cidr_block              = "10.0.0.0/25"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "nifty-straddle-public-a-${var.environment}" }
}

resource "aws_internet_gateway" "straddle" {
  vpc_id = aws_vpc.straddle.id

  tags = { Name = "nifty-straddle-igw-${var.environment}" }
}

resource "aws_route_table" "straddle_public" {
  vpc_id = aws_vpc.straddle.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.straddle.id
  }

  tags = { Name = "nifty-straddle-rt-${var.environment}" }
}

resource "aws_route_table_association" "straddle_public_a" {
  subnet_id      = aws_subnet.straddle_public_a.id
  route_table_id = aws_route_table.straddle_public.id
}


# ── Security Group ───────────────────────────────────────────────────────────

resource "aws_security_group" "straddle" {
  name_prefix = "nifty-straddle-"
  vpc_id      = aws_vpc.straddle.id

  # Outbound only: WS to DhanHQ, REST to DhanHQ + DynamoDB
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # No ingress needed — engine is outbound-only

  tags = { Name = "nifty-straddle-sg-${var.environment}" }
}

# ── ECR Repository ───────────────────────────────────────────────────────────

resource "aws_ecr_repository" "straddle" {
  name                 = "nifty-straddle-engine"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }

  tags = { Name = "nifty-straddle-ecr-${var.environment}" }
}

# Lifecycle policy — keep only last 5 images
resource "aws_ecr_lifecycle_policy" "straddle" {
  repository = aws_ecr_repository.straddle.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

# ── CloudWatch Log Group ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "straddle_ecs" {
  name              = "/ecs/nifty-straddle"
  retention_in_days = 14
}

# ── IAM Roles ────────────────────────────────────────────────────────────────

# ECS Execution Role (pull ECR images + write CW logs)
resource "aws_iam_role" "ecs_execution" {
  name = "nifty-straddle-ecs-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_basic" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role (DynamoDB access — same as ticker Lambda)
resource "aws_iam_role" "ecs_task" {
  name = "nifty-straddle-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_dynamodb" {
  name = "nifty-straddle-dynamodb"
  role = aws_iam_role.ecs_task.id

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
          aws_dynamodb_table.nifty_straddle.arn,
          "${aws_dynamodb_table.nifty_straddle.arn}/index/*",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/users-${var.environment}",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:zerodha-token-manager",
        ]
      }
    ]
  })
}

# ── ECS Cluster ──────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "straddle" {
  name = "nifty-straddle-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

# ── ECS Task Definition ─────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "straddle" {
  family                   = "nifty-straddle-engine"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"   # 0.5 vCPU
  memory                   = "1024"  # 1 GB
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "straddle-engine"
    image     = "${aws_ecr_repository.straddle.repository_url}:latest"
    essential = true

    environment = [
      { name = "NIFTY_STRADDLE_TABLE", value = aws_dynamodb_table.nifty_straddle.name },
      { name = "USERS_TABLE", value = "users-${var.environment}" },
      { name = "ENCRYPTION_KEY", value = var.encryption_key },
      { name = "STAGE", value = var.environment },
      { name = "AWS_DEFAULT_REGION", value = var.aws_region },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.straddle_ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "engine"
      }
    }
  }])
}

# ── ECS Service ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "straddle" {
  name            = "straddle-engine"
  cluster         = aws_ecs_cluster.straddle.id
  task_definition = aws_ecs_task_definition.straddle.arn
  desired_count   = 0  # Controlled by EventBridge schedule
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.straddle_public_a.id]
    security_groups  = [aws_security_group.straddle.id]
    assign_public_ip = true
  }

  # Allow external changes to desired_count (scheduling)
  lifecycle {
    ignore_changes = [desired_count]
  }
}

# ── Scheduling Lambda (start/stop Fargate) ───────────────────────────────────

data "archive_file" "ecs_scheduler" {
  type        = "zip"
  output_path = "${path.module}/lambda/ecs-scheduler.zip"

  source {
    content = <<-JS
      const { ECSClient, UpdateServiceCommand } = require('@aws-sdk/client-ecs');
      const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
      const ecs = new ECSClient({});
      const ddb = new DynamoDBClient({});

      exports.handler = async (event) => {
        // On start: only spin up Fargate if at least one user has a running engine
        if (event.action === 'start') {
          const result = await ddb.send(new ScanCommand({
            TableName: process.env.STRADDLE_TABLE,
            FilterExpression: 'sk = :engine AND running = :t',
            ExpressionAttributeValues: {
              ':engine': { S: 'ENGINE' },
              ':t': { BOOL: true },
            },
            ProjectionExpression: 'pk',
            Limit: 1,
          }));
          if (!result.Items || result.Items.length === 0) {
            console.log('ECS scheduler: no active users, skipping Fargate start');
            return { statusCode: 200, body: JSON.stringify({ action: 'skipped', reason: 'no active users' }) };
          }
          console.log('ECS scheduler: found active user(s), starting Fargate');
        }

        const desiredCount = event.action === 'start' ? 1 : 0;
        console.log('ECS scheduler:', event.action, 'desired_count:', desiredCount);
        await ecs.send(new UpdateServiceCommand({
          cluster: process.env.ECS_CLUSTER,
          service: process.env.ECS_SERVICE,
          desiredCount,
        }));
        return { statusCode: 200, body: JSON.stringify({ action: event.action, desiredCount }) };
      };
    JS
    filename = "index.js"
  }
}

resource "aws_iam_role" "ecs_scheduler_lambda" {
  name = "nifty-straddle-ecs-scheduler-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_scheduler_lambda" {
  name = "ecs-update-service"
  role = aws_iam_role.ecs_scheduler_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecs:UpdateService"]
        Resource = aws_ecs_service.straddle.id
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Scan"]
        Resource = aws_dynamodb_table.nifty_straddle.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "ecs_scheduler" {
  function_name    = "nifty-straddle-ecs-scheduler-${var.environment}"
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  role             = aws_iam_role.ecs_scheduler_lambda.arn
  timeout          = 15
  memory_size      = 128
  filename         = data.archive_file.ecs_scheduler.output_path
  source_code_hash = data.archive_file.ecs_scheduler.output_base64sha256

  environment {
    variables = {
      ECS_CLUSTER    = aws_ecs_cluster.straddle.name
      ECS_SERVICE    = aws_ecs_service.straddle.name
      STRADDLE_TABLE = aws_dynamodb_table.nifty_straddle.name
    }
  }
}

# ── EventBridge Rules for Fargate start/stop ─────────────────────────────────

# Start: 9:10 AM IST = 3:40 AM UTC
resource "aws_cloudwatch_event_rule" "straddle_fargate_start" {
  name                = "straddle-fargate-start-${var.environment}"
  description         = "Start Fargate straddle engine at 9:10 AM IST"
  schedule_expression = "cron(40 3 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_target" "straddle_fargate_start" {
  rule      = aws_cloudwatch_event_rule.straddle_fargate_start.name
  target_id = "EcsSchedulerStart"
  arn       = aws_lambda_function.ecs_scheduler.arn

  input = jsonencode({ action = "start" })
}

resource "aws_lambda_permission" "eventbridge_ecs_start" {
  statement_id  = "AllowEventBridgeEcsStart"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ecs_scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.straddle_fargate_start.arn
}

# Stop: 3:35 PM IST = 10:05 AM UTC
resource "aws_cloudwatch_event_rule" "straddle_fargate_stop" {
  name                = "straddle-fargate-stop-${var.environment}"
  description         = "Stop Fargate straddle engine at 3:35 PM IST"
  schedule_expression = "cron(5 10 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_target" "straddle_fargate_stop" {
  rule      = aws_cloudwatch_event_rule.straddle_fargate_stop.name
  target_id = "EcsSchedulerStop"
  arn       = aws_lambda_function.ecs_scheduler.arn

  input = jsonencode({ action = "stop" })
}

resource "aws_lambda_permission" "eventbridge_ecs_stop" {
  statement_id  = "AllowEventBridgeEcsStop"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ecs_scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.straddle_fargate_stop.arn
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "straddle_ecr_repository_url" {
  description = "ECR repository URL for straddle engine"
  value       = aws_ecr_repository.straddle.repository_url
}


output "straddle_ecs_cluster" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.straddle.name
}

output "straddle_ecs_service" {
  description = "ECS service name"
  value       = aws_ecs_service.straddle.name
}
