import type { Server as SocketIOServer } from 'socket.io';
import { nanoid } from 'nanoid';
import { db } from '../../db/index.js';
import {
  tasks,
  taskSteps,
  companyEmployees,
  agentsCatalog,
  customAgents,
  apiKeys,
} from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { AgentInfo, TaskDAG } from './types.js';
import { planTask } from './planner.js';
import { executeDAG } from './executor.js';

export type { TaskDAG, DAGNode, AgentInfo } from './types.js';

/**
 * Resolve all hired agents for a company into AgentInfo[] with full configs.
 */
export function resolveCompanyAgents(companyId: string): AgentInfo[] {
  const employees = db.select().from(companyEmployees)
    .where(eq(companyEmployees.companyId, companyId))
    .all();

  const agents: AgentInfo[] = [];

  for (const emp of employees) {
    // Look up agent definition
    const catalogAgent = db.select().from(agentsCatalog)
      .where(eq(agentsCatalog.id, emp.agentId))
      .get();
    const custom = catalogAgent
      ? null
      : db.select().from(customAgents)
          .where(and(eq(customAgents.id, emp.agentId), eq(customAgents.companyId, companyId)))
          .get();

    const agentDef = catalogAgent || custom;
    if (!agentDef) continue;

    const empConfig = (emp.config as Record<string, unknown>) || {};
    const provider = (empConfig.provider as string) || 'deepseek';

    // Look up company API key for the provider
    const companyKey = db.select().from(apiKeys)
      .where(and(eq(apiKeys.companyId, companyId), eq(apiKeys.provider, provider)))
      .get();

    // Also check if apiKey is in the agent config directly
    const directApiKey = (empConfig.apiKey as string) || '';
    const resolvedApiKey = directApiKey || companyKey?.encryptedKey || '';

    agents.push({
      id: agentDef.id,
      name: agentDef.name,
      dept: agentDef.dept,
      description: agentDef.description || '',
      tags: (agentDef.tags as string[]) || [],
      role: 'role' in agentDef ? (agentDef as any).role || '' : '',
      systemPrompt: agentDef.systemPrompt || '',
      config: {
        provider,
        model: (empConfig.model as string) || 'deepseek-chat',
        apiKey: resolvedApiKey,
        baseUrl: (empConfig.baseUrl as string) || companyKey?.baseUrl || '',
        temperature: (empConfig.temperature as number) ?? 0.7,
        maxTokens: (empConfig.maxTokens as number) || 4096,
      },
    });
  }

  return agents;
}

/**
 * Launch a task: create it in the DB, plan the DAG, then execute.
 * This is async and runs in the background, emitting Socket.IO events along the way.
 */
export async function launchTask(
  companyId: string,
  taskName: string,
  taskDescription: string,
  io: SocketIOServer,
): Promise<{ taskId: string; dag: TaskDAG }> {
  const taskId = nanoid();
  const now = new Date().toISOString();

  // Create task in DB
  db.insert(tasks).values({
    id: taskId,
    companyId,
    name: taskName,
    description: taskDescription,
    status: 'running',
    dag: {},
    createdAt: now,
    completedAt: null,
  }).run();

  // Resolve agents
  const agents = resolveCompanyAgents(companyId);
  if (agents.length === 0) {
    db.update(tasks)
      .set({ status: 'failed', completedAt: new Date().toISOString() } as any)
      .where(eq(tasks.id, taskId))
      .run();
    throw new Error('No hired agents available for this company');
  }

  // Emit initial status
  io.to(`task:${taskId}`).emit('task:progress', {
    taskId,
    message: '正在分解任务，请稍候...',
    agentName: 'System',
    timestamp: Date.now(),
  });

  // Plan the task
  let dag: TaskDAG;
  try {
    dag = await planTask(taskId, taskName, taskDescription, agents);
    dag.status = 'running';
  } catch (err) {
    db.update(tasks)
      .set({ status: 'failed', completedAt: new Date().toISOString() } as any)
      .where(eq(tasks.id, taskId))
      .run();
    throw err;
  }

  // Store DAG in task
  db.update(tasks)
    .set({ dag: dag as any })
    .where(eq(tasks.id, taskId))
    .run();

  // Emit the planned DAG
  io.to(`task:${taskId}`).emit('task:dag-update', dag);
  io.to(`task:${taskId}`).emit('task:progress', {
    taskId,
    message: `任务已分解为 ${dag.nodes.length} 个步骤，开始执行...`,
    agentName: 'System',
    timestamp: Date.now(),
  });

  // Execute in background (don't await in the request handler)
  executeDAG(dag, agents, io).catch((err) => {
    console.error('[orchestrator] DAG execution failed:', err);
  });

  return { taskId, dag };
}
