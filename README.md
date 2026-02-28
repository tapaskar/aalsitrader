# Trading Dashboard with Paper Trading Integration

A comprehensive trading dashboard that integrates paper trading results with the Trading Squad agent system, featuring Sigma (Orchestrator) agent paper trading status display.

## Features

### Paper Trading Dashboard
- **Real-time Portfolio Tracking**: Virtual capital, P&L, win rate, drawdown metrics
- **Trade History**: Complete trade journal with filtering (open/closed/wins/losses)
- **Equity Curve**: Interactive chart showing paper trading growth over time
- **Performance Analytics**: Sharpe ratio, Sortino ratio, Calmar ratio, profit factor
- **Live Mode Toggle**: Switch between paper and live trading modes

### Sigma Agent Integration
- **Paper Trading Badge**: Displays "Paper Trading Active" with live stats
- **Trade Approval System**: Sigma can approve/reject trades before execution
- **Real-time Updates**: WebSocket broadcasts for trade opens, closes, signals
- **Activity Feed**: All paper trading events logged in Sigma's activity stream

### Components
- `PaperTradingPanel.tsx` - Main dashboard panel
- `PaperStatusBadge.tsx` - Mode indicator with paper/live toggle
- `TradeHistory.tsx` - Comprehensive trade table
- `EquityCurve.tsx` - Recharts-based equity visualization
- `SigmaApprovalBadge.tsx` - Shows approval status and statistics

## API Endpoints

### Paper Trading Endpoints
```
GET  /paper-trades          - List all paper trades
GET  /paper-portfolio        - Current portfolio state
GET  /paper-equity-curve     - Equity history for chart
GET  /paper-metrics          - Performance statistics
GET  /paper-mode             - Get current trading mode
POST /paper-mode             - Toggle paper/live mode
```

### Sigma Approval Endpoints
```
GET  /sigma-approvals        - List pending approvals
POST /sigma-approvals        - Approve/reject a trade
```

## WebSocket Events

### From Server to Client
```javascript
// New paper trade opened
{ type: 'paperTradeOpen', trade: PaperTrade, timestamp: number }

// Paper trade closed with P&L
{ type: 'paperTradeClose', trade: PaperTrade, timestamp: number }

// Portfolio state changed
{ type: 'paperPortfolioUpdate', portfolio: PortfolioState, timestamp: number }

// New signal for Sigma review
{ type: 'paperSignalGenerated', signal: Signal, requiresApproval: boolean }
```

## DynamoDB Schema

### Main Tables
| Table | Partition Key | Sort Key | GSI |
|-------|-------------|----------|-----|
| momentum-trades | TRADE#<id> | STATUS#<status>#<timestamp> | gsi1pk: SYMBOL#<symbol> |
| momentum-portfolio | PORTFOLIO#MAIN | TIMESTAMP#<timestamp> | - |
| momentum-config | CONFIG#MODE | TIME#<timestamp> | - |
| momentum-signals | SIGNAL#<symbol> | TIME#<timestamp> | - |
| momentum-metrics | METRICS#SNAPSHOT | TIME#<timestamp> | - |

### GSI for Querying by Status
```
Index: GSI1
Partition Key: gsi1pk (SYMBOL#<symbol>)
Sort Key: gsi1sk (timestamp)
```

## Setup Instructions

### 1. Deploy Backend
```bash
cd backend
npm install
npm run build

# Deploy CDK/Terraform infrastructure
cdk deploy
```

### 2. Create DynamoDB Tables
Run the provided setup script or create manually:

```bash
aws dynamodb create-table \
  --table-name momentum-trades \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi1pk,AttributeType=S \
    AttributeName=gsi1sk,AttributeType=N \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    "IndexName=GSI1,KeySchema=[{AttributeName=gsi1pk,KeyType=HASH},{AttributeName=gsi1sk,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

aws dynamodb create-table \
  --table-name momentum-portfolio \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

aws dynamodb create-table \
  --table-name momentum-config \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 3. Configure Environment Variables
```bash
# backend/.env
CONNECTIONS_TABLE=trading-connections
ACTIVITIES_TABLE=trading-activities
AGENT_STATE_TABLE=trading-agent-state
TRADES_TABLE=trading-trades
COMMUNICATIONS_TABLE=trading-communications
WEBSOCKET_API_ENDPOINT=wss://your-api.execute-api.region.amazonaws.com/prod
```

### 4. Frontend Setup
```bash
cd frontend
npm install

# Set API endpoint
echo "VITE_API_URL=https://your-api.execute-api.region.amazonaws.com/prod" > .env

echo "VITE_WS_URL=wss://your-api.execute-api.region.amazonaws.com/prod" >> .env

npm run dev
```

### 5. Build for Production
```bash
npm run build
# Deploy dist/ to S3/CloudFront
```

## Integration Points

### Connecting Existing Agents
Paper trading events are automatically broadcast via WebSocket. No changes needed to existing agents - Sigma will display paper trading stats in the sidebar.

### Sigma Approval Flow
1. Signal generated by indicators
2. `paperSignalGenerated` event broadcast
3. Sigma reviews in Paper Trading dashboard
4. Sigma approves/rejects via API
5. Trade executes in paper mode
6. Results appear in activity feed

### Momentum Trader Integration
The paper-trading.ts module (in `backend/src/momentum-trader/`) handles:
- Trade entry/exit logic
- P&L calculation
- Position sizing
- Risk management

## Development

### Frontend
- React + TypeScript
- Zustand for state management
- Recharts for equity curve
- Tailwind CSS for styling

### Backend
- AWS Lambda (Node.js 18+)
- API Gateway (HTTP + WebSocket)
- DynamoDB for persistence
- Event-driven architecture

### Testing
```bash
# Test HTTP endpoints
curl https://your-api.execute-api.region.amazonaws.com/prod/paper-portfolio

# Test WebSocket
wscat -c wss://your-api.execute-api.region.amazonaws.com/prod
> {"action": "subscribe"}
```

## Deployment

### AWS Infrastructure (CDK)
See `infrastructure/` directory for:
- Lambda functions
- API Gateway
- DynamoDB tables
- IAM roles

### Environment Variables
```bash
# Required
AWS_REGION=us-east-1
API_STAGE=prod

# Optional - for local testing
LOCAL_DYNAMODB_ENDPOINT=http://localhost:8000
```

## Troubleshooting

### WebSocket Not Connecting
- Check `VITE_WS_URL` matches API Gateway WebSocket endpoint
- Verify `WEBSOCKET_API_ENDPOINT` Lambda env var
- Check CloudWatch logs for connection errors

### Paper Trading Data Not Loading
- Verify DynamoDB tables exist
- Check IAM permissions for Lambda
- Review CloudWatch logs for errors

### Sigma Stats Not Showing
- Ensure paper trades have been created
- Check WebSocket connection status
- Verify `pendingApprovals` state in store

## License
MIT
