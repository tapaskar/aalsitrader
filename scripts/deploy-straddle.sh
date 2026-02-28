#!/bin/bash
set -euo pipefail

# Deploy Nifty Straddle Fargate Engine
# Usage: ./scripts/deploy-straddle.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT_DIR/backend"
TERRAFORM_DIR="$ROOT_DIR/infrastructure/terraform"

AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID="228644978624"
ECR_REPO="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/nifty-straddle-engine"

echo "=== Nifty Straddle Fargate Deploy ==="
echo ""

# Step 1: Install dependencies
echo "Installing dependencies..."
cd "$BACKEND_DIR"
npm install

# Step 2: Build Fargate bundle
echo "Building Fargate bundle..."
npm run build:fargate
echo "   done: dist/fargate-runner.js"

# Step 3: Build Docker image
echo "Building Docker image..."
docker build -f "$BACKEND_DIR/Dockerfile.straddle" -t nifty-straddle-engine "$BACKEND_DIR"
echo "   done: Docker image built"

# Step 4: Push to ECR
echo "Pushing to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker tag nifty-straddle-engine:latest "$ECR_REPO:latest"
docker push "$ECR_REPO:latest"
echo "   done: pushed to $ECR_REPO:latest"

# Step 5: Also build and deploy the updated Lambda (straddle-engine with injectedData)
echo "Building all Lambda bundles..."
npm run build:all

echo "Packaging Lambda zips..."
cd "$TERRAFORM_DIR/lambda"
for js_file in http nifty-straddle-ticker; do
  cp "$BACKEND_DIR/dist/$js_file.js" .
  zip -j "$js_file.zip" "$js_file.js"
done
echo "   done: Lambda zips ready"

# Step 6: Terraform apply
echo "Running Terraform apply..."
cd "$TERRAFORM_DIR"
/opt/homebrew/bin/terraform apply -var="environment=prod" -var="aws_region=$AWS_REGION" -auto-approve

# Step 7: Force new ECS deployment (pull latest image)
echo "Forcing new ECS deployment..."
aws ecs update-service \
  --cluster "nifty-straddle-prod" \
  --service "straddle-engine" \
  --force-new-deployment \
  --region "$AWS_REGION" \
  > /dev/null 2>&1 || echo "   (Service not running — will use latest image on next start)"

echo ""
echo "=== Deploy Complete ==="
echo ""

# Show outputs
echo "Key outputs:"
cd "$TERRAFORM_DIR"
ELASTIC_IP=$(/opt/homebrew/bin/terraform output -raw straddle_elastic_ip 2>/dev/null || echo "N/A")
ECR_URL=$(/opt/homebrew/bin/terraform output -raw straddle_ecr_repository_url 2>/dev/null || echo "N/A")
echo "   Elastic IP:  $ELASTIC_IP  <- Whitelist this at dhanhq.co"
echo "   ECR Repo:    $ECR_URL"
echo ""
echo "Manual commands:"
echo "   Start:  aws ecs update-service --cluster nifty-straddle-prod --service straddle-engine --desired-count 1 --region $AWS_REGION"
echo "   Stop:   aws ecs update-service --cluster nifty-straddle-prod --service straddle-engine --desired-count 0 --region $AWS_REGION"
echo "   Logs:   aws logs tail /ecs/nifty-straddle --follow --region $AWS_REGION"
