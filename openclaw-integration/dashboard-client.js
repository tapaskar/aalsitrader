/**
 * OpenClaw Integration Module
 * 
 * This module allows your OpenClaw agents to send data to the Trading Dashboard.
 * 
 * Usage:
 * ```javascript
 * const dashboard = require('./openclaw-integration/dashboard-client');
 * 
 * // Send agent activity
 * await dashboard.sendActivity({
 *   agentId: 'alpha',
 *   type: 'info',
 *   content: 'Found breaking news on HAL',
 *   tags: ['News', 'Defense']
 * });
 * 
 * // Update agent status
 * await dashboard.updateStatus('alpha', 'active', 'Scanning news...');
 * 
 * // Log a trade
 * await dashboard.logTrade({
 *   symbol: 'HAL',
 *   direction: 'long',
 *   entryPrice: 4280,
 *   stopLoss: 4080,
 *   target: 4650
 * });
 * ```
 */

const WebSocket = require('ws');
const https = require('https');

class DashboardClient {
  constructor(config = {}) {
    this.wsUrl = config.wsUrl || process.env.DASHBOARD_WS_URL;
    this.apiUrl = config.apiUrl || process.env.DASHBOARD_API_URL;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.maxRetries = config.maxRetries || 10;
    
    this.ws = null;
    this.retries = 0;
    this.connected = false;
    this.messageQueue = [];
    
    // Agent definitions
    this.agents = {
      alpha: { name: 'Alpha', greek: 'α', color: '#ff6b6b', role: 'Research Agent' },
      beta: { name: 'Beta', greek: 'β', color: '#4ecdc4', role: 'Technical Analyst' },
      gamma: { name: 'Gamma', greek: 'γ', color: '#a855f7', role: 'Risk Manager' },
      sigma: { name: 'Sigma', greek: 'Σ', color: '#10b981', role: 'Trade Hunter / Orchestrator' },
      theta: { name: 'Theta', greek: 'θ', color: '#f97316', role: 'Macro Watcher' },
      delta: { name: 'Delta', greek: 'δ', color: '#3b82f6', role: 'Trade Journal' },
    };
  }

  connect() {
    if (!this.wsUrl) {
      console.error('DashboardClient: No WebSocket URL configured');
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ DashboardClient: Connected to Trading Dashboard');
        this.connected = true;
        this.retries = 0;
        
        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.send(msg);
        }
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data);
        this.handleMessage(message);
      });

      this.ws.on('close', () => {
        console.log('⚠️  DashboardClient: Disconnected');
        this.connected = false;
        this.reconnect();
      });

      this.ws.on('error', (err) => {
        console.error('DashboardClient Error:', err.message);
      });

    } catch (err) {
      console.error('DashboardClient: Connection failed:', err.message);
      this.reconnect();
    }
  }

  reconnect() {
    if (this.retries >= this.maxRetries) {
      console.error('DashboardClient: Max retries reached');
      return;
    }

    this.retries++;
    console.log(`DashboardClient: Reconnecting in ${this.reconnectInterval}ms (attempt ${this.retries})`);
    
    setTimeout(() => this.connect(), this.reconnectInterval);
  }

  send(data) {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.messageQueue.push(data);
    }
  }

  handleMessage(message) {
    // Handle incoming messages from dashboard
    switch (message.type) {
      case 'connected':
        console.log('Dashboard:', message.message);
        break;
      case 'agentCommand':
        // Handle commands from dashboard (e.g., manual trade execution)
        this.handleCommand(message.command);
        break;
      default:
        // Ignore other messages
        break;
    }
  }

  handleCommand(command) {
    // Override this method to handle dashboard commands
    console.log('DashboardCommand:', command);
  }

  // === Public API Methods ===

  async sendActivity(activityData) {
    const agent = this.agents[activityData.agentId];
    if (!agent) {
      console.error(`Unknown agent: ${activityData.agentId}`);
      return;
    }

    const activity = {
      id: this.generateId(),
      agentId: activityData.agentId,
      agentName: agent.name,
      agentGreek: agent.greek,
      agentColor: agent.color,
      type: activityData.type || 'info',
      content: activityData.content,
      tags: activityData.tags || [],
      timestamp: Date.now(),
    };

    // Store activity
    await docClient.send(new PutCommand({
      TableName: TableNames.activities,
      Item: {
        ...activity,
        ttl: Math.floor(timestamp / 1000) + 604800,
      },
    }));

    // Update agent state
    await docClient.send(new PutCommand({
      TableName: TableNames.agentState,
      Item: {
        agentId: agent.id,
        status: 'active',
        currentTask: content.slice(0, 50) + '...',
        lastActivity: timestamp,
      },
    }));

    // Broadcast to all connected clients
    await broadcastToAll({
      type: 'agentActivity',
      activity,
      timestamp,
    });

    // 20% chance to send communication
    if (Math.random() < 0.2) {
      await generateComm(agent, timestamp);
    }
  }

  async wakeAgent(agent: typeof agents[0], timestamp: number): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: TableNames.agentState,
      Item: {
        agentId: agent.id,
        status: 'active',
        currentTask: 'Initializing...',
        lastActivity: timestamp,
      },
    }));

    await broadcastToAll({
      type: 'agentStatusChange',
      agentId: agent.id,
      status: 'active',
      currentTask: 'Initializing...',
      timestamp,
    });
  }

  async sleepAgent(agent: typeof agents[0], timestamp: number): Promise<void> {
    // Calculate next wake time
    const nextWake = new Date(timestamp + 15 * 60 * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    await docClient.send(new PutCommand({
      TableName: TableNames.agentState,
      Item: {
        agentId: agent.id,
        status: 'sleeping',
        nextWake,
        lastActivity: timestamp,
      },
    }));

    await broadcastToAll({
      type: 'agentStatusChange',
      agentId: agent.id,
      status: 'sleeping',
      nextWake,
      timestamp,
    });
  }

  async generateComm(fromAgent: typeof agents[0], timestamp: number): Promise<void> {
    // Pick random recipient
    const otherAgents = agents.filter((a) => a.id !== fromAgent.id);
    const toAgent = otherAgents[Math.floor(Math.random() * otherAgents.length)];
    
    const commMessages: Record<string, string[]> = {
      alpha: ['Check technical validity on {SYMBOL}', 'News on {SYMBOL}, your thoughts?', 'Earnings data ready for {SYMBOL}'],
      beta: ['Confirmed breakout on {SYMBOL}', 'Volume validates the move', 'Support holding at {PRICE}'],
      gamma: ['Risk approved for {SYMBOL}', 'Position within limits', 'Stop-loss set at {PRICE}'],
      sigma: ['Hunting {SYMBOL}, all clear?', 'Entry zone approaching', 'Execute on {SYMBOL}?'],
      theta: ['FII selling pressure noted', 'Global cues negative', 'Risk-off score: {SCORE}/10'],
      delta: ['Trade logged successfully', 'Journal updated', 'Stats compiled'],
    };
    
    const messages = commMessages[fromAgent.id] || ['Message received'];
    const content = fillTemplate(messages[Math.floor(Math.random() * messages.length)]);
    
    const comm = {
      id: crypto.randomUUID(),
      from: fromAgent.name,
      fromGreek: fromAgent.greek,
      fromColor: fromAgent.color,
      to: toAgent.name,
      toGreek: toAgent.greek,
      toColor: toAgent.color,
      content,
      timestamp,
    };

    // Store communication
    await docClient.send(new PutCommand({
      TableName: TableNames.communications,
      Item: {
        ...comm,
        ttl: Math.floor(timestamp / 1000) + 86400,
      },
    }));

    // Broadcast
    await broadcastToAll({
      type: 'commMessage',
      comm,
      timestamp,
    });
  }

  async generateEODSummary(timestamp: number): Promise<void> {
    // Get today's trades
    const tradesResult = await docClient.send(new ScanCommand({
      TableName: TableNames.trades,
    }));
    
    const trades = tradesResult.Items || [];
    const closedTrades = trades.filter((t) => t.status === 'closed' && t.pnl !== undefined);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    const summary = {
      id: crypto.randomUUID(),
      agentId: 'delta',
      agentName: 'Delta',
      agentGreek: 'δ',
      agentColor: '#3b82f6',
      type: 'success',
      content: `EOD Summary: ${closedTrades.length} trades, P&L ₹${totalPnl.toFixed(0)}. Journal complete.`,
      tags: ['EOD', 'Summary', 'Journal'],
      timestamp,
    };

    await docClient.send(new PutCommand({
      TableName: TableNames.activities,
      Item: {
        ...summary,
        ttl: Math.floor(timestamp / 1000) + 604800,
      },
    }));

    await broadcastToAll({
      type: 'agentActivity',
      activity: summary,
      timestamp,
    });
  }

  async broadcastToAll(data: unknown): Promise<void> {
    // Get all connections
    const result = await docClient.send(new ScanCommand({
      TableName: TableNames.connections,
    }));

    const connections = result.Items || [];
    
    const sendPromises = connections.map(async (conn) => {
      try {
        await apiGateway.send(new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: Buffer.from(JSON.stringify(data)),
        }));
      } catch (error) {
        // Connection dead
        console.log(`Failed to send to ${conn.connectionId}`);
      }
    });

    await Promise.all(sendPromises);
  }

  function fillTemplate(template: string): string {
    const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'HAL', 'BDL', 'LT', 'ADANIENT'];
    const prices = ['4500', '3850', '1550', '1650', '950', '775', '4280', '1380', '2850', '2450'];
    
    return template
      .replace(/{SYMBOL}/g, symbols[Math.floor(Math.random() * symbols.length)])
      .replace(/{PRICE}/g, prices[Math.floor(Math.random() * prices.length)])
      .replace(/{CHANGE}/g, (Math.random() * 2 - 0.5).toFixed(1))
      .replace(/{VIX}/g, (15 + Math.random() * 10).toFixed(1))
      .replace(/{FLOW}/g, Math.random() > 0.5 ? 'buying' : 'selling')
      .replace(/{AMOUNT}/g, (Math.random() * 1000 + 100).toFixed(0))
      .replace(/{PERCENT}/g, (Math.random() * 50 + 10).toFixed(0))
      .replace(/{PNL}/g, (Math.random() * 5000 - 1000).toFixed(0))
      .replace(/{WINRATE}/g, (50 + Math.random() * 30).toFixed(0))
      .replace(/{DIRECTION}/g, Math.random() > 0.5 ? 'Long' : 'Short')
      .replace(/{ENTRY}/g, prices[Math.floor(Math.random() * prices.length)])
      .replace(/{TARGET}/g, prices[Math.floor(Math.random() * prices.length)])
      .replace(/{GRADE}/g, ['A', 'B', 'B', 'C'][Math.floor(Math.random() * 4)])
      .replace(/{SCORE}/g, (Math.random() * 10).toFixed(0));
  }
}

// Export singleton instance
const defaultClient = new DashboardClient();

module.exports = {
  DashboardClient,
  dashboard: defaultClient,
  
  // Convenience methods
  connect: (config) => {
    const client = config ? new DashboardClient(config) : defaultClient;
    client.connect();
    return client;
  },
  
  sendActivity: (data) => defaultClient.sendActivity(data),
  updateStatus: (agentId, status, task) => defaultClient.updateStatus(agentId, status, task),
  sendComm: (from, to, content) => defaultClient.sendComm(from, to, content),
  logTrade: (trade) => defaultClient.logTrade(trade),
  updateTrade: (id, updates) => defaultClient.updateTrade(id, updates),
};
