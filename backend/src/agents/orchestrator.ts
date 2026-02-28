/**
 * Orchestrator Lambda Handler
 * Manages agent lifecycle within Step Functions state machine.
 * Actions: load_memory, aggregate, save_and_broadcast, wake_all, sleep_all
 */

import {
  AgentEvent,
  agents,
  updateAgentState,
  wakeAgent,
  sleepAgent,
  broadcastToAll,
} from './shared.js';
import {
  getAllLatestAgentOutputs,
  getAgentOutputsForExecution,
  AgentOutput,
} from '../utils/agent-memory.js';

interface OrchestratorEvent extends AgentEvent {
  action: 'load_memory' | 'aggregate' | 'save_and_broadcast' | 'wake_all' | 'sleep_all';
  agentResults?: any[];
  aggregated?: any;
}

export const handler = async (event: OrchestratorEvent) => {
  const { action, executionId, timestamp: tsInput } = event;
  const timestamp = typeof tsInput === 'number' ? tsInput : Date.now();

  switch (action) {
    case 'load_memory':
      return await loadMemory(executionId, timestamp);

    case 'aggregate':
      return await aggregate(executionId, timestamp, event.agentResults || []);

    case 'save_and_broadcast':
      return await saveAndBroadcast(executionId, timestamp, event.aggregated);

    case 'wake_all':
      return await wakeAll(timestamp);

    case 'sleep_all':
      return await sleepAll(timestamp);

    default:
      throw new Error(`Unknown orchestrator action: ${action}`);
  }
};

/**
 * Load latest agent memory from DynamoDB to provide shared context
 */
async function loadMemory(executionId: string, timestamp: number) {
  const latestOutputs = await getAllLatestAgentOutputs();

  const sharedContext: Record<string, any> = {};
  for (const [agentId, output] of Object.entries(latestOutputs)) {
    sharedContext[agentId] = {
      analysis: output.analysis,
      alertType: output.alertType,
      tags: output.tags,
      metadata: output.metadata,
      timestamp: output.timestamp,
    };
  }

  return {
    executionId,
    timestamp,
    sharedContext: { latestOutputs: sharedContext },
  };
}

/**
 * Aggregate results from all agent executions in this run
 */
async function aggregate(executionId: string, timestamp: number, agentResults: any[]) {
  // Also read from DynamoDB in case Step Functions results are incomplete
  const dbOutputs = await getAgentOutputsForExecution(executionId);

  // Merge: prefer Step Functions results, fill gaps from DynamoDB
  const resultMap = new Map<string, any>();
  for (const output of dbOutputs) {
    resultMap.set(output.agentId, output);
  }
  for (const result of agentResults) {
    if (result?.agentId) {
      resultMap.set(result.agentId, result);
    }
  }

  const allResults = Array.from(resultMap.values());

  // Build summary
  const alerts = allResults.filter((r) => r.alertType === 'warning' || r.alertType === 'alert');
  const interAgentMessages = allResults.flatMap((r) => r.interAgentMessages || []);

  return {
    executionId,
    timestamp,
    aggregated: {
      agentCount: allResults.length,
      agents: allResults.map((r) => r.agentId),
      alerts: alerts.map((r) => ({ agentId: r.agentId, analysis: r.analysis })),
      interAgentMessages,
      summary: `Execution ${executionId}: ${allResults.length} agents ran. ${alerts.length} alerts.`,
    },
  };
}

/**
 * Final step: broadcast summary to connected WebSocket clients
 */
async function saveAndBroadcast(executionId: string, timestamp: number, aggregated: any) {
  if (aggregated) {
    await broadcastToAll({
      type: 'executionComplete',
      executionId,
      timestamp,
      summary: aggregated,
    });
  }

  return { executionId, timestamp, status: 'complete' };
}

/**
 * Wake all agents (pre-market)
 */
async function wakeAll(timestamp: number) {
  await Promise.all(agents.map((agent) => wakeAgent(agent, timestamp)));

  await broadcastToAll({
    type: 'squadStatus',
    status: 'active',
    message: 'All agents awake and scanning markets.',
    timestamp,
  });

  return { status: 'all_awake', timestamp };
}

/**
 * Sleep all agents (post-market)
 */
async function sleepAll(timestamp: number) {
  await Promise.all(agents.map((agent) => sleepAgent(agent, timestamp)));

  await broadcastToAll({
    type: 'squadStatus',
    status: 'sleeping',
    message: 'Market closed. All agents sleeping.',
    timestamp,
  });

  return { status: 'all_sleeping', timestamp };
}
