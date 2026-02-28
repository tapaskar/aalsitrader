/**
 * Agent Memory Module
 * Provides DynamoDB-backed persistent memory for trading squad agents.
 * Replaces the file-based /memory/ system for serverless execution.
 */

import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './db.js';

const AGENT_MEMORY_TABLE = process.env.AGENT_MEMORY_TABLE || 'trading-squad-agent-memory-prod';
const TTL_DAYS = 30;

export interface AgentOutput {
  agentId: string;
  executionId: string;
  timestamp: number;
  date: string; // YYYY-MM-DD
  analysis: string;
  alertType: string; // info, alert, success, warning
  tags: string[];
  metadata?: Record<string, any>;
  interAgentMessages?: Array<{
    toAgentId: string;
    content: string;
  }>;
}

/**
 * Save agent output to DynamoDB (both execution-scoped and LATEST)
 */
export async function saveAgentOutput(output: AgentOutput): Promise<void> {
  const ttl = Math.floor(output.timestamp / 1000) + TTL_DAYS * 86400;

  // Save execution-scoped output
  await docClient.send(
    new PutCommand({
      TableName: AGENT_MEMORY_TABLE,
      Item: {
        pk: `EXECUTION#${output.executionId}`,
        sk: `AGENT#${output.agentId}`,
        gsi1pk: `DATE#${output.date}`,
        gsi1sk: `AGENT#${output.agentId}`,
        ...output,
        ttl,
      },
    })
  );

  // Also save as LATEST for quick lookup
  await docClient.send(
    new PutCommand({
      TableName: AGENT_MEMORY_TABLE,
      Item: {
        pk: `AGENT#${output.agentId}`,
        sk: 'MEMORY#LATEST',
        gsi1pk: `DATE#${output.date}`,
        gsi1sk: `LATEST#${output.agentId}`,
        ...output,
        ttl,
      },
    })
  );
}

/**
 * Get all agent outputs for a specific Step Functions execution
 */
export async function getAgentOutputsForExecution(executionId: string): Promise<AgentOutput[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: AGENT_MEMORY_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `EXECUTION#${executionId}` },
    })
  );
  return (result.Items || []) as AgentOutput[];
}

/**
 * Get the latest output for a specific agent
 */
export async function getLatestAgentOutput(agentId: string): Promise<AgentOutput | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: AGENT_MEMORY_TABLE,
      Key: { pk: `AGENT#${agentId}`, sk: 'MEMORY#LATEST' },
    })
  );
  return (result.Item as AgentOutput) || null;
}

/**
 * Get all agent outputs for a specific date
 */
export async function getAgentOutputsByDate(date: string): Promise<AgentOutput[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: AGENT_MEMORY_TABLE,
      IndexName: 'DateIndex',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': `DATE#${date}` },
    })
  );
  return (result.Items || []) as AgentOutput[];
}

/**
 * Get latest outputs for all agents (for shared context)
 */
export async function getAllLatestAgentOutputs(): Promise<Record<string, AgentOutput>> {
  const agentIds = ['alpha', 'beta', 'gamma', 'theta', 'delta', 'sigma'];
  const outputs: Record<string, AgentOutput> = {};

  await Promise.all(
    agentIds.map(async (agentId) => {
      const output = await getLatestAgentOutput(agentId);
      if (output) {
        outputs[agentId] = output;
      }
    })
  );

  return outputs;
}
