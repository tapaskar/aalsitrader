import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import WebSocket from 'ws';

// Local DynamoDB endpoint
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const WS_ENDPOINT = process.env.WS_ENDPOINT || 'ws://localhost:3001';

const ddbClient = new DynamoDBClient({
  endpoint: DYNAMODB_ENDPOINT,
  region: 'ap-south-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const docClient = DynamoDBDocumentClient.from(ddbClient);

describe('Integration Tests', () => {
  let ws: WebSocket;
  let messages: any[] = [];

  beforeAll(async () => {
    // Connect WebSocket
    ws = new WebSocket(WS_ENDPOINT);
    
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
    });

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });
  });

  afterAll(() => {
    ws?.close();
  });

  it('should connect to DynamoDB', async () => {
    const result = await docClient.send(new ScanCommand({
      TableName: 'activities',
    }));
    
    expect(result).toBeDefined();
  });

  it('should connect to WebSocket', async () => {
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('should receive welcome message', async () => {
    // Wait a bit for welcome message
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const welcome = messages.find(m => m.type === 'connected');
    expect(welcome).toBeDefined();
    expect(welcome.message).toContain('Welcome');
  });

  it('should store and retrieve activity', async () => {
    const activity = {
      id: `test-${Date.now()}`,
      agentId: 'alpha',
      agentName: 'Alpha',
      agentGreek: 'α',
      agentColor: '#ff6b6b',
      type: 'info',
      content: 'Integration test activity',
      tags: ['Test'],
      timestamp: Date.now(),
    };

    // Store in DynamoDB
    await docClient.send(new PutCommand({
      TableName: 'activities',
      Item: activity,
    }));

    // Retrieve
    const result = await docClient.send(new GetCommand({
      TableName: 'activities',
      Key: { id: activity.id },
    }));

    expect(result.Item).toBeDefined();
    expect(result.Item?.content).toBe('Integration test activity');
  });

  it('should broadcast activity via WebSocket', async () => {
    const activity = {
      action: 'agentActivity',
      activity: {
        agentId: 'beta',
        agentName: 'Beta',
        agentGreek: 'β',
        agentColor: '#4ecdc4',
        type: 'success',
        content: 'WebSocket broadcast test',
        tags: ['WebSocket', 'Test'],
        timestamp: Date.now(),
      },
    };

    // Send via WebSocket
    ws.send(JSON.stringify(activity));

    // Wait for broadcast
    await new Promise(resolve => setTimeout(resolve, 500));

    const broadcast = messages.find(m => 
      m.type === 'agentActivity' && 
      m.activity?.content === 'WebSocket broadcast test'
    );

    expect(broadcast).toBeDefined();
  });

  it('should store and retrieve trade', async () => {
    const trade = {
      id: `trade-${Date.now()}`,
      symbol: 'TEST',
      direction: 'long',
      entryPrice: 100,
      stopLoss: 90,
      target: 120,
      status: 'open',
      setupType: 'Test',
      grade: 'A',
      entryTime: Date.now(),
      agentId: 'sigma',
    };

    await docClient.send(new PutCommand({
      TableName: 'trades',
      Item: trade,
    }));

    const result = await docClient.send(new GetCommand({
      TableName: 'trades',
      Key: { id: trade.id },
    }));

    expect(result.Item).toBeDefined();
    expect(result.Item?.symbol).toBe('TEST');
  });
});

describe('API Integration', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  it('should get trades via HTTP API', async () => {
    const response = await fetch(`${API_URL}/trades`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('trades');
    expect(Array.isArray(data.trades)).toBe(true);
  });

  it('should create trade via HTTP API', async () => {
    const trade = {
      symbol: 'RELIANCE',
      direction: 'long',
      entryPrice: 2500,
      stopLoss: 2400,
      target: 2700,
      setupType: 'Breakout',
      agentId: 'sigma',
    };

    const response = await fetch(`${API_URL}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });

    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data.message).toBe('Trade created');
  });

  it('should get agents via HTTP API', async () => {
    const response = await fetch(`${API_URL}/agents`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('agents');
  });
});
