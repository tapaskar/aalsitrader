#!/bin/bash
# deploy.sh - One-command deployment to AWS

set -e

echo "🚀 Trading Squad Dashboard - AWS Deployment"
echo "============================================"

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI required"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm required"; exit 1; }

ENVIRONMENT=${1:-prod}
AWS_REGION=${2:-ap-south-1}

echo ""
echo "📋 Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  AWS Region: $AWS_REGION"
echo ""

# Step 1: Build frontend
echo "📦 Step 1: Building frontend..."
cd frontend
npm install --legacy-peer-deps || npm install --force
npm run build
cd ..

# Step 2: Build Lambda functions
echo "⚙️  Step 2: Building Lambda functions..."
cd backend
npm install --legacy-peer-deps || npm install --force
npm run build:all
cd ..

# Step 3: Initialize Terraform
echo "🏗️  Step 3: Initializing Terraform..."
cd infrastructure/terraform
terraform init

# Step 4: Plan
echo "📊 Step 4: Planning infrastructure..."
terraform plan -var="environment=$ENVIRONMENT" -var="aws_region=$AWS_REGION" -out=tfplan

# Step 5: Apply
echo "🚀 Step 5: Deploying infrastructure..."
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    terraform apply tfplan
else
    echo "❌ Deployment cancelled"
    exit 1
fi

# Step 6: Get outputs
echo ""
echo "📤 Deployment Outputs:"
terraform output

# Step 7: Upload frontend to S3
echo ""
echo "☁️  Step 6: Uploading frontend to S3..."
S3_BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 sync ../../frontend/dist s3://$S3_BUCKET --delete

# Step 8: Invalidate CloudFront
echo ""
echo "🔄 Step 7: Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].DomainName=='$S3_BUCKET.s3.amazonaws.com'].Id" --output text)
if [ ! -z "$DISTRIBUTION_ID" ]; then
    aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Dashboard URL: https://$(terraform output -raw cloudfront_url)"
echo "🔗 WebSocket Endpoint: $(terraform output -raw websocket_endpoint)"
echo ""
echo "📱 Update your frontend .env file with:"
echo "   VITE_WS_URL=$(terraform output -raw websocket_endpoint)"
echo ""

cd ../..
