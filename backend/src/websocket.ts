import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DeleteCommand, PutCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TableNames, WebSocketEndpoint } from './utils/db.js';

const apiGateway = new ApiGatewayManagementApiClient({
  endpoint: WebSocketEndpoint,
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { routeKey, connectionId } = event.requestContext;
  const timestamp = Date.now();

  console.log(`WebSocket ${routeKey}`, { connectionId, routeKey });

  try {
    switch (routeKey) {
      case '$connect':
        // Store connection
        await docClient.send(new PutCommand({
          TableName: TableNames.connections,
          Item: {
            connectionId,
            connectedAt: timestamp,
            ttl: Math.floor(timestamp / 1000) + 86400, // 24 hours TTL
          },
        }));
        
        console.log('Client connected:', connectionId);

        // Note: Cannot send messages during $connect - connection not fully established yet
        return { statusCode: 200, body: 'Connected' };

      case '$disconnect':
        // Remove connection
        await docClient.send(new DeleteCommand({
          TableName: TableNames.connections,
          Key: { connectionId },
        }));
        
        console.log('Client disconnected:', connectionId);
        return { statusCode: 200, body: 'Disconnected' };

      case '$default':
        // Handle custom actions from frontend
        if (event.body) {
          const data = JSON.parse(event.body);

          switch (data.action) {
            case 'subscribe':
              // Client subscribing to specific agents
              return { statusCode: 200, body: JSON.stringify({ status: 'subscribed' }) };

            case 'getAgentStatus':
              // Return current agent statuses
              const agents = await getAgentStatuses();
              await sendToConnection(connectionId, {
                type: 'agentStatus',
                agents,
                timestamp,
              });
              return { statusCode: 200, body: 'Sent agent status' };

            case 'chatMessage':
              // User sending a chat message - log it and broadcast
              const chatMessage = {
                id: crypto.randomUUID(),
                sessionId: data.sessionId || connectionId,
                userId: data.userId || 'anonymous',
                from: data.from || 'User',
                to: data.to || 'Squad',
                content: data.content,
                type: data.type || 'user', // 'user' | 'agent' | 'system'
                timestamp,
                ttl: Math.floor(timestamp / 1000) + 604800, // 7 days
              };

              // Store the chat message
              await storeChatMessage(chatMessage);

              // Broadcast to all connected clients
              await broadcastToAll({
                type: 'chatMessage',
                message: chatMessage,
                timestamp,
              });

              return { statusCode: 200, body: 'Chat message stored' };

            case 'getChatHistory':
              // Get chat history for a session
              const history = await getChatHistory(data.sessionId || connectionId, data.limit || 50);
              await sendToConnection(connectionId, {
                type: 'chatHistory',
                messages: history,
                sessionId: data.sessionId || connectionId,
                timestamp,
              });
              return { statusCode: 200, body: 'Chat history sent' };

            default:
              return { statusCode: 200, body: 'Unknown action' };
          }
        }
        return { statusCode: 200, body: 'Default handled' };

      case 'agentActivity':
        // Broadcast agent activity to all connected clients
        if (event.body) {
          const data = JSON.parse(event.body);
          
          // Store activity
          await storeActivity(data.activity);
          
          // Broadcast to all
          await broadcastToAll({
            type: 'agentActivity',
            activity: data.activity,
            timestamp,
          });
          
          return { statusCode: 200, body: 'Activity broadcasted' };
        }
        return { statusCode: 400, body: 'No activity data' };

      case 'agentStatusChange':
        // Agent status changed
        if (event.body) {
          const data = JSON.parse(event.body);
          
          await updateAgentStatus(data.agentId, data.status, data.currentTask);
          
          await broadcastToAll({
            type: 'agentStatusChange',
            agentId: data.agentId,
            status: data.status,
            currentTask: data.currentTask,
            timestamp,
          });
          
          return { statusCode: 200, body: 'Status updated' };
        }
        return { statusCode: 400, body: 'No status data' };

      case 'commMessage':
        // Agent-to-agent communication
        if (event.body) {
          const data = JSON.parse(event.body);
          
          await storeCommunication(data.comm);
          
          await broadcastToAll({
            type: 'commMessage',
            comm: data.comm,
            timestamp,
          });
          
          return { statusCode: 200, body: 'Comm broadcasted' };
        }
        return { statusCode: 400, body: 'No comm data' };

      case 'paperTradeOpen':
        // New paper trade opened
        if (event.body) {
          const data = JSON.parse(event.body);
          
          await broadcastToAll({
            type: 'paperTradeOpen',
            trade: data.trade,
            timestamp,
          });
          
          // Also log to Sigma's activity feed
          await storeActivity({
            agentId: 'sigma',
            agentName: 'Sigma',
            agentGreek: 'Σ',
            agentColor: '#10b981',
            type: 'success',
            content: `Paper Trade Opened: ${data.trade.signal} ${data.trade.symbol} @ ₹${data.trade.entryPrice}`,
            tags: ['Paper Trading', data.trade.symbol, 'Trade Open'],
            metadata: { tradeId: data.trade.id, pnl: data.trade.netPnL },
          });
          
          return { statusCode: 200, body: 'Paper trade open broadcasted' };
        }
        return { statusCode: 400, body: 'No trade data' };

      case 'paperTradeClose':
        // Paper trade closed
        if (event.body) {
          const data = JSON.parse(event.body);
          
          await broadcastToAll({
            type: 'paperTradeClose',
            trade: data.trade,
            timestamp,
          });
          
          // Log to Sigma's activity feed
          const pnlStatus = (data.trade.netPnL || 0) >= 0 ? 'profit' : 'loss';
          const emoji = pnlStatus === 'profit' ? '✅' : '❌';
          
          await storeActivity({
            agentId: 'sigma',
            agentName: 'Sigma',
            agentGreek: 'Σ',
            agentColor: '#10b981',
            type: pnlStatus === 'profit' ? 'success' : 'warning',
            content: `${emoji} Paper Trade Closed: ${data.trade.symbol} ${data.trade.exitReason} - ${pnlStatus === 'profit' ? '+' : ''}₹${Math.abs(data.trade.netPnL || 0).toFixed(0)}`,
            tags: ['Paper Trading', data.trade.symbol, 'Trade Close', pnlStatus === 'profit' ? 'Win' : 'Loss'],
            metadata: { tradeId: data.trade.id, pnl: data.trade.netPnL, exitReason: data.trade.exitReason },
          });
          
          return { statusCode: 200, body: 'Paper trade close broadcasted' };
        }
        return { statusCode: 400, body: 'No trade data' };

      case 'paperPortfolioUpdate':
        // Portfolio state changed
        if (event.body) {
          const data = JSON.parse(event.body);
          
          await broadcastToAll({
            type: 'paperPortfolioUpdate',
            portfolio: data.portfolio,
            timestamp,
          });
          
          return { statusCode: 200, body: 'Portfolio update broadcasted' };
        }
        return { statusCode: 400, body: 'No portfolio data' };

      case 'paperSignalGenerated':
        // New signal for Sigma review
        if (event.body) {
          const data = JSON.parse(event.body);
          
          await broadcastToAll({
            type: 'paperSignalGenerated',
            signal: data.signal,
            requiresApproval: data.requiresApproval,
            timestamp,
          });
          
          // Notify Sigma of pending signal
          await storeActivity({
            agentId: 'sigma',
            agentName: 'Sigma',
            agentGreek: 'Σ',
            agentColor: '#10b981',
            type: 'alert',
            content: `🔔 New Signal: ${data.signal.symbol} ${data.signal.signal} - Awaiting your review`,
            tags: ['Signal', 'Paper Trading', data.signal.symbol, 'Pending Approval'],
            metadata: { signalId: data.signal.id, confidence: data.signal.confidence },
          });
          
          return { statusCode: 200, body: 'Signal broadcasted' };
        }
        return { statusCode: 400, body: 'No signal data' };

      default:
        return { statusCode: 404, body: 'Route not found' };
    }
  } catch (error) {
    console.error('WebSocket error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: (error as Error).message }) };
  }
};

async function sendToConnection(connectionId: string, data: unknown): Promise<void> {
  try {
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data)),
    }));
  } catch (error) {
    // Connection dead, clean it up
    if ((error as Error).name === 'GoneException') {
      await docClient.send(new DeleteCommand({
        TableName: TableNames.connections,
        Key: { connectionId },
      }));
    }
    throw error;
  }
}

async function broadcastToAll(data: unknown): Promise<void> {
  // Get all connections
  const result = await docClient.send(new ScanCommand({
    TableName: TableNames.connections,
  }));

  const connections = result.Items || [];
  
  // Send to all connections
  const sendPromises = connections.map(async (conn) => {
    try {
      await sendToConnection(conn.connectionId, data);
    } catch (error) {
      console.log(`Failed to send to ${conn.connectionId}:`, error);
    }
  });

  await Promise.all(sendPromises);
}

async function storeActivity(activity: unknown): Promise<void> {
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  
  await docClient.send(new PutCommand({
    TableName: TableNames.activities,
    Item: {
      id,
      timestamp,
      ...activity,
      ttl: Math.floor(timestamp / 1000) + 604800, // 7 days TTL
    },
  }));
}

async function updateAgentStatus(
  agentId: string,
  status: string,
  currentTask?: string
): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TableNames.agentState,
    Item: {
      agentId,
      status,
      currentTask,
      lastUpdate: Date.now(),
    },
  }));
}

async function getAgentStatuses(): Promise<unknown[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: TableNames.agentState,
  }));
  
  return result.Items || [];
}

async function storeCommunication(comm: unknown): Promise<void> {
  const id = crypto.randomUUID();
  const timestamp = Date.now();

  await docClient.send(new PutCommand({
    TableName: TableNames.communications,
    Item: {
      id,
      timestamp,
      ...comm,
      ttl: Math.floor(timestamp / 1000) + 86400, // 24 hours TTL
    },
  }));
}

async function storeChatMessage(message: {
  id: string;
  sessionId: string;
  userId: string;
  from: string;
  to: string;
  content: string;
  type: string;
  timestamp: number;
  ttl: number;
}): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TableNames.chatMessages,
    Item: {
      pk: `SESSION#${message.sessionId}`,
      sk: `MSG#${message.timestamp}#${message.id}`,
      ...message,
    },
  }));
}

async function getChatHistory(sessionId: string, limit: number): Promise<unknown[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TableNames.chatMessages,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `SESSION#${sessionId}` },
    ScanIndexForward: false, // Most recent first
    Limit: limit,
  }));

  return (result.Items || []).reverse(); // Return in chronological order
}
