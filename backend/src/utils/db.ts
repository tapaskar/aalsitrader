import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const STAGE = process.env.STAGE || 'prod';

export const TableNames = {
  connections: process.env.CONNECTIONS_TABLE || '',
  activities: process.env.ACTIVITIES_TABLE || '',
  agentState: process.env.AGENT_STATE_TABLE || '',
  trades: process.env.TRADES_TABLE || '',
  communications: process.env.COMMUNICATIONS_TABLE || '',
  chatMessages: process.env.CHAT_MESSAGES_TABLE || `trading-squad-chat-messages-${STAGE}`,
  // Paper Trading Tables
  momentumTrades: process.env.MOMENTUM_TRADES_TABLE || `momentum-trades-${STAGE}`,
  momentumPortfolio: process.env.MOMENTUM_PORTFOLIO_TABLE || `momentum-portfolio-${STAGE}`,
  momentumConfig: process.env.MOMENTUM_CONFIG_TABLE || `momentum-config-${STAGE}`,
  momentumSignals: process.env.MOMENTUM_SIGNALS_TABLE || `momentum-signals-${STAGE}`,
  momentumPerformance: process.env.MOMENTUM_PERFORMANCE_TABLE || `momentum-performance-${STAGE}`,
  momentumMetrics: process.env.MOMENTUM_METRICS_TABLE || `momentum-metrics-${STAGE}`,
  // Nifty Straddle
  niftyStraddle: process.env.NIFTY_STRADDLE_TABLE || `nifty-straddle-${STAGE}`,
};

export const WebSocketEndpoint = process.env.WEBSOCKET_API_ENDPOINT || '';
