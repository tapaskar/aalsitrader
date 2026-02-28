# Trading Squad Dashboard — AWS Deployment Guide

## 🎯 Project Overview

A real-time web dashboard for the Trading Squad AI agents with:
- Live agent status (Active/Sleeping)
- Real-time activity feed
- Agent-to-agent communication visualization
- WebSocket-based updates
- Responsive design

---

## 📁 Project Structure

```
trading-squad-dashboard/
├── frontend/                    # React/Vue frontend
│   ├── public/
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── AgentCard.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── CommPanel.tsx
│   │   │   └── OutputPanel.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API services
│   │   ├── store/              # State management (Zustand/Redux)
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/                     # Node.js/Express API
│   ├── src/
│   │   ├── agents/             # Agent simulation logic
│   │   ├── websocket/          # WebSocket handlers
│   │   ├── routes/             # API routes
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── infrastructure/              # Terraform/CDK
│   ├── terraform/
│   └── aws-cdk/
└── docker-compose.yml
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS CloudFront                        │
│                     (CDN + SSL + Caching)                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                     S3 Bucket                               │
│              (Static Website Hosting)                       │
│                   Frontend Build                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              API Gateway (WebSocket + HTTP)                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│   Lambda 1   │ │  Lambda 2   │ │  Lambda 3  │
│  HTTP API    │ │  WebSocket  │ │   Agent    │
│   Handler    │ │  Handler    │ │ Simulator  │
└───────┬──────┘ └──────┬──────┘ └─────┬──────┘
        │               │              │
        └───────────────┼──────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              DynamoDB (Agent State + Messages)              │
└─────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│         EventBridge (Scheduled Agent Wakeups)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Steps

### Step 1: Frontend (S3 + CloudFront)

```bash
# Build frontend
cd frontend
npm install
npm run build

# Deploy to S3
aws s3 sync dist/ s3://trading-squad-dashboard-prod \
  --delete \
  --cache-control "max-age=31536000,immutable"

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Step 2: Backend (Lambda + API Gateway)

```bash
# Install dependencies
cd backend
npm install

# Deploy with Serverless Framework
npx serverless deploy --stage prod

# Or with AWS CDK
cd infrastructure/aws-cdk
npm install
npx cdk deploy TradingSquadDashboardStack
```

### Step 3: WebSocket Setup

```typescript
// backend/src/websocket/handler.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocument.from(new DynamoDB({}));

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { routeKey, connectionId } = event.requestContext;
  
  switch (routeKey) {
    case '$connect':
      // Store connection
      await dynamo.put({
        TableName: process.env.CONNECTIONS_TABLE!,
        Item: { connectionId, connectedAt: Date.now() }
      });
      return { statusCode: 200, body: 'Connected' };
      
    case '$disconnect':
      // Remove connection
      await dynamo.delete({
        TableName: process.env.CONNECTIONS_TABLE!,
        Key: { connectionId }
      });
      return { statusCode: 200, body: 'Disconnected' };
      
    case 'agentActivity':
      // Broadcast agent activity to all connected clients
      const data = JSON.parse(event.body || '{}');
      await broadcastToAll(data);
      return { statusCode: 200, body: 'Broadcasted' };
      
    default:
      return { statusCode: 404, body: 'Not found' };
  }
};

async function broadcastToAll(data: any) {
  // Get all connections from DynamoDB
  const connections = await dynamo.scan({
    TableName: process.env.CONNECTIONS_TABLE!
  });
  
  // Send to each connection via API Gateway Management API
  const apigwManagementApi = new ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_ENDPOINT
  });
  
  for (const conn of connections.Items || []) {
    try {
      await apigwManagementApi.postToConnection({
        ConnectionId: conn.connectionId,
        Data: JSON.stringify(data)
      });
    } catch (e) {
      // Connection dead, clean up
      await dynamo.delete({
        TableName: process.env.CONNECTIONS_TABLE!,
        Key: { connectionId: conn.connectionId }
      });
    }
  }
}
```

### Step 4: Agent Simulator (Lambda + EventBridge)

```typescript
// backend/src/agents/simulator.ts
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const agents = ['alpha', 'beta', 'gamma', 'theta', 'delta', 'sigma'];

export const simulateAgentActivity = async () => {
  // Each agent wakes up on schedule
  const now = new Date();
  
  for (const agent of agents) {
    const shouldWake = checkAgentSchedule(agent, now);
    
    if (shouldWake) {
      // Update agent status to active
      await updateAgentStatus(agent, 'active');
      
      // Simulate agent work
      const activity = await simulateAgentWork(agent);
      
      // Broadcast to all connected clients
      await broadcastActivity({
        type: 'agentActivity',
        agent,
        activity,
        timestamp: Date.now()
      });
      
      // Send agent back to sleep after work
      setTimeout(async () => {
        await updateAgentStatus(agent, 'sleeping');
        await broadcastActivity({
          type: 'agentStatusChange',
          agent,
          status: 'sleeping',
          nextWake: calculateNextWake(agent)
        });
      }, getAgentWorkDuration(agent));
    }
  }
};

// EventBridge triggers this every minute
export const handler = async () => {
  await simulateAgentActivity();
};
```

---

## 📊 AWS Services Cost Estimate

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| **S3** | 1GB storage, 10K requests | ~$0.50 |
| **CloudFront** | 100GB transfer | ~$8.50 |
| **API Gateway** | 1M WebSocket messages | ~$1.00 |
| **Lambda** | 1M invocations, 128MB | ~$2.00 |
| **DynamoDB** | 1GB storage, light traffic | ~$1.50 |
| **EventBridge** | Scheduled rules | ~$1.00 |
| **Route 53** | 1 hosted zone | ~$0.50 |
| **TOTAL** | | **~$15/month** |

---

## ⚠️ What You Need to Take Care Of

### 1. **SSL Certificate**
```bash
# Request certificate in ACM
aws acm request-certificate \
  --domain-name trading-squad.yourdomain.com \
  --validation-method DNS \
  --region us-east-1  # Must be us-east-1 for CloudFront
```

### 2. **Domain & DNS**
- Register domain in Route 53
- Create A/AAAA alias records pointing to CloudFront

### 3. **Security**
```typescript
// Add CORS and security headers
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};
```

### 4. **WebSocket Connection Limits**
- API Gateway: 10,000 concurrent connections per account (soft limit)
- Request limit increase if needed

### 5. **DynamoDB Capacity**
```typescript
// Use on-demand for variable traffic
const table = new dynamodb.Table(this, 'AgentState', {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  // or provisioned with auto-scaling
});
```

### 6. **Cold Starts**
- Use Lambda provisioned concurrency for WebSocket handlers
- Keep agent simulator warm with EventBridge

### 7. **Monitoring**
```bash
# Enable CloudWatch dashboards
aws cloudwatch put-dashboard \
  --dashboard-name TradingSquad \
  --dashboard-body file://dashboard.json
```

### 8. **Backup Strategy**
- DynamoDB point-in-time recovery
- S3 versioning for frontend builds

---

## 🔧 Local Development

```bash
# Start local servers
npm run dev:frontend  # Vite dev server on :5173
npm run dev:backend   # Local Lambda simulator on :3000
npm run dev:websocket # WebSocket server on :8080

# Or use Docker
docker-compose up
```

---

## 🚀 Quick Deploy Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Deploying Trading Squad Dashboard..."

# 1. Build frontend
echo "📦 Building frontend..."
cd frontend
npm ci
npm run build
cd ..

# 2. Deploy backend
echo "⚙️  Deploying backend..."
cd backend
npx serverless deploy --stage prod
cd ..

# 3. Deploy frontend to S3
echo "☁️  Uploading to S3..."
aws s3 sync frontend/dist s3://$BUCKET_NAME --delete

# 4. Invalidate CloudFront
echo "🔄 Invalidating CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

echo "✅ Deployment complete!"
echo "🌐 URL: https://trading-squad.yourdomain.com"
```

---

## 📝 Next Steps

1. [ ] Choose frontend framework (React/Vue/Svelte)
2. [ ] Set up AWS account and CLI
3. [ ] Configure domain in Route 53
4. [ ] Deploy initial version
5. [ ] Set up monitoring/alerting
6. [ ] Connect to actual OpenClaw agents

**Want me to generate the full working code for any specific part?**
