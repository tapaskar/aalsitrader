# OpenClaw Integration Examples

This folder contains examples of how to integrate your OpenClaw agents with the Trading Dashboard.

## Setup

```bash
cd openclaw-integration
npm install
```

## Configuration

Set environment variables in your OpenClaw environment:

```bash
export DASHBOARD_WS_URL=wss://your-api.execute-api.ap-south-1.amazonaws.com/prod
export DASHBOARD_API_URL=https://your-api.execute-api.ap-south-1.amazonaws.com/prod
```

Or create a `.env` file in your OpenClaw workspace:

```
DASHBOARD_WS_URL=wss://your-api.execute-api.ap-south-1.amazonaws.com/prod
DASHBOARD_API_URL=https://your-api.execute-api.ap-south-1.amazonaws.com/prod
```

## Usage Examples

### Basic: Send Activity from Alpha (Research Agent)

```javascript
const { dashboard } = require('./trading-dashboard/openclaw-integration/dashboard-client');

// Connect to dashboard
dashboard.connect();

// Send activity
async function scanNews() {
  // Your news scanning logic here
  const news = await fetchNews();
  
  // Send to dashboard
  await dashboard.sendActivity({
    agentId: 'alpha',
    type: 'info',
    content: `Found news: ${news.headline}`,
    tags: ['News', news.sector]
  });
  
  if (news.isUrgent) {
    await dashboard.sendActivity({
      agentId: 'alpha',
      type: 'alert',
      content: `URGENT: ${news.headline}`,
      tags: ['Alert', 'Urgent', news.sector]
    });
  }
}
```

### Advanced: Full Agent Integration

```javascript
const { DashboardClient } = require('./trading-dashboard/openclaw-integration/dashboard-client');

class AlphaAgent {
  constructor() {
    this.dashboard = new DashboardClient();
    this.dashboard.connect();
    
    // Handle commands from dashboard
    this.dashboard.handleCommand = (command) => {
      if (command.type === 'scanSymbol') {
        this.scanSpecificSymbol(command.symbol);
      }
    };
  }
  
  async runHeartbeat() {
    // Update status to active
    await this.dashboard.updateStatus('alpha', 'active', 'Scanning news...');
    
    try {
      // Do work
      const news = await this.scanNews();
      
      // Send results
      for (const item of news) {
        await this.dashboard.sendActivity({
          agentId: 'alpha',
          type: item.urgency > 7 ? 'alert' : 'info',
          content: item.summary,
          tags: ['News', item.category]
        });
      }
      
      // Communicate with Beta
      if (news.some(n => n.category === 'Earnings')) {
        await this.dashboard.sendComm('alpha', 'beta', 'Earnings data ready for technical review');
      }
      
    } catch (error) {
      await this.dashboard.sendActivity({
        agentId: 'alpha',
        type: 'error',
        content: `Error scanning news: ${error.message}`,
        tags: ['Error']
      });
    }
    
    // Go to sleep
    await this.dashboard.updateStatus('alpha', 'sleeping');
  }
  
  async scanNews() {
    // Your implementation
    return [];
  }
  
  async scanSpecificSymbol(symbol) {
    // Handle manual scan request from dashboard
    const news = await this.fetchSymbolNews(symbol);
    await this.dashboard.sendActivity({
      agentId: 'alpha',
      type: 'info',
      content: `Scanned ${symbol}: ${news.length} items found`,
      tags: ['Manual', symbol]
    });
  }
}

// Usage
const alpha = new AlphaAgent();
```

### Sigma (Trade Hunter) with Trade Logging

```javascript
const { dashboard } = require('./trading-dashboard/openclaw-integration/dashboard-client');

dashboard.connect();

async function identifyTrade() {
  const trade = {
    symbol: 'HAL',
    direction: 'long',
    entryPrice: 4280,
    stopLoss: 4080,
    target: 4650,
    setupType: 'Breakout',
    agentId: 'sigma'
  };
  
  // Send trade idea to dashboard
  await dashboard.sendActivity({
    agentId: 'sigma',
    type: 'success',
    content: `Trade identified: ${trade.symbol} ${trade.direction}. Entry: ₹${trade.entryPrice}, Target: ₹${trade.target}`,
    tags: ['Trade', 'Opportunity', trade.symbol]
  });
  
  // Log the trade
  await dashboard.logTrade(trade);
  
  // Communicate with Gamma for risk check
  await dashboard.sendComm('sigma', 'gamma', `Please validate risk for ${trade.symbol} position`);
}

async function executeTrade(tradeId, executionPrice) {
  // Update trade with execution details
  await dashboard.updateTrade(tradeId, {
    status: 'open',
    entryPrice: executionPrice,
    entryTime: Date.now()
  });
  
  await dashboard.sendActivity({
    agentId: 'sigma',
    type: 'success',
    content: `Trade executed: Entry at ₹${executionPrice}`,
    tags: ['Trade', 'Executed']
  });
}

async function closeTrade(tradeId, exitPrice, pnl) {
  await dashboard.updateTrade(tradeId, {
    status: 'closed',
    exitPrice,
    exitTime: Date.now(),
    pnl,
    pnlPercent: (pnl / entryPrice) * 100
  });
  
  await dashboard.sendActivity({
    agentId: 'sigma',
    type: pnl > 0 ? 'success' : 'warning',
    content: `Trade closed: P&L ₹${pnl.toFixed(0)}`,
    tags: ['Trade', 'Closed', pnl > 0 ? 'Win' : 'Loss']
  });
  
  // Notify Delta to journal
  await dashboard.sendComm('sigma', 'delta', `Trade complete. Please update journal.`);
}
```

### Delta (Trade Journal) EOD Summary

```javascript
const { dashboard } = require('./trading-dashboard/openclaw-integration/dashboard-client');

async function generateEODSummary() {
  // Get all trades from API
  const response = await fetch(`${process.env.DASHBOARD_API_URL}/trades`);
  const { trades } = await response.json();
  
  const today = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter(t => 
    new Date(t.entryTime).toISOString().split('T')[0] === today
  );
  
  const closedTrades = todayTrades.filter(t => t.status === 'closed');
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
  
  // Send summary
  await dashboard.sendActivity({
    agentId: 'delta',
    type: 'success',
    content: `EOD Summary: ${todayTrades.length} trades, ${closedTrades.length} closed. P&L: ₹${totalPnl.toFixed(0)}. Win rate: ${Math.round((wins.length / closedTrades.length) * 100) || 0}%`,
    tags: ['EOD', 'Summary', 'Journal']
  });
}
```

## Event Types

### Activity Types

- `info` - General information
- `success` - Successful operation
- `alert` - Urgent alert (plays sound)
- `warning` - Warning condition
- `error` - Error occurred

### Tags

Common tags for filtering:

- `News` - News-related
- `Technical` - Technical analysis
- `Risk` - Risk management
- `Trade` - Trade-related
- `Macro` - Macro/market-wide
- `Alert` - Alert condition
- `Error` - Error condition
- `[SYMBOL]` - Stock symbol (e.g., `RELIANCE`, `HAL`)

## Testing

Test your integration:

```bash
node test-integration.js
```

This will send test activities to verify your connection.
