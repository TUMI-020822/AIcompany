import type { Server as SocketIOServer } from 'socket.io';
import { nanoid } from 'nanoid';
import { db } from '../../db/index.js';
import { tasks, taskSteps } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createProvider, type ProviderId } from '../llm/registry.js';
import type { ChatMessage } from '../llm/provider.js';
import type { TaskDAG, DAGNode, AgentInfo } from './types.js';

/**
 * Emit a DAG update to all subscribers of a task room.
 */
function emitDAGUpdate(io: SocketIOServer, taskId: string, dag: TaskDAG) {
  io.to(`task:${taskId}`).emit('task:dag-update', dag);
}

/**
 * Emit a single node update.
 */
function emitStepUpdate(io: SocketIOServer, taskId: string, node: DAGNode) {
  io.to(`task:${taskId}`).emit('task:step-update', { taskId, node });
}

/**
 * Emit a progress message (chat-like).
 */
function emitProgress(io: SocketIOServer, taskId: string, message: string, agentName?: string) {
  io.to(`task:${taskId}`).emit('task:progress', {
    taskId,
    message,
    agentName: agentName || 'System',
    timestamp: Date.now(),
  });
}

/**
 * Get all nodes whose dependencies are fully met (all deps are 'done').
 */
function getReadyNodes(dag: TaskDAG): DAGNode[] {
  const doneIds = new Set(dag.nodes.filter((n) => n.status === 'done').map((n) => n.id));
  return dag.nodes.filter((n) =>
    n.status === 'pending' && n.dependencies.every((dep) => doneIds.has(dep))
  );
}

/**
 * Build the prompt for executing a single DAG node, including context from dependencies.
 */
function buildNodePrompt(node: DAGNode, dag: TaskDAG, agent: AgentInfo): ChatMessage[] {
  // Gather outputs from dependency nodes
  const depOutputs = node.dependencies
    .map((depId) => {
      const depNode = dag.nodes.find((n) => n.id === depId);
      if (depNode && depNode.output) {
        return `### Output from "${depNode.label}" (${depNode.agentName}):\n${depNode.output}`;
      }
      return null;
    })
    .filter(Boolean)
    .join('\n\n');

  const systemContent = agent.systemPrompt
    ? agent.systemPrompt
    : `You are ${agent.name}, an AI agent in the ${agent.dept} department. Your expertise includes: ${agent.tags.join(', ')}. ${agent.description}`;

  const system: ChatMessage = {
    role: 'system',
    content: systemContent,
  };

  let userContent = `You are working on the task: "${dag.taskName}"\n\nYour specific subtask: ${node.taskPrompt}`;
  if (depOutputs) {
    userContent += `\n\nHere are the results from previous steps that you should build upon:\n\n${depOutputs}`;
  }
  userContent += '\n\nProvide a thorough, actionable response. Be specific and detailed.';

  const user: ChatMessage = {
    role: 'user',
    content: userContent,
  };

  return [system, user];
}

/**
 * Execute a single node: call the agent's LLM and store the result.
 */
async function executeNode(
  node: DAGNode,
  dag: TaskDAG,
  agent: AgentInfo,
  io: SocketIOServer,
): Promise<void> {
  const startTime = Date.now();
  node.status = 'running';
  node.startedAt = startTime;
  emitStepUpdate(io, dag.taskId, node);
  emitProgress(io, dag.taskId, `${node.agentName} 开始执行: ${node.label}`, node.agentName);

  try {
    const messages = buildNodePrompt(node, dag, agent);

    const provider = createProvider(agent.config.provider as ProviderId, {
      apiKey: agent.config.apiKey,
      baseUrl: agent.config.baseUrl || undefined,
      model: agent.config.model,
    });

    // Use streaming to emit progress tokens
    let output = '';
    const stream = provider.chatStream({
      model: agent.config.model,
      messages,
      temperature: agent.config.temperature ?? 0.7,
      maxTokens: agent.config.maxTokens ?? 4096,
      stream: true,
    });

    let tokenCount = 0;
    for await (const token of stream) {
      output += token;
      tokenCount++;
      // Emit token-level progress every 20 tokens to avoid flooding
      if (tokenCount % 20 === 0) {
        io.to(`task:${dag.taskId}`).emit('task:node-token', {
          taskId: dag.taskId,
          nodeId: node.id,
          partial: output,
        });
      }
    }

    const endTime = Date.now();
    node.status = 'done';
    node.output = output;
    node.completedAt = endTime;
    node.metadata = {
      tokens: tokenCount,
      duration: endTime - startTime,
      model: agent.config.model,
    };

    // Persist step to database
    persistNodeResult(dag.taskId, node);

    emitStepUpdate(io, dag.taskId, node);
    emitProgress(
      io,
      dag.taskId,
      `${node.agentName} 完成: ${node.label} (${((endTime - startTime) / 1000).toFixed(1)}s)`,
      node.agentName,
    );
  } catch (err) {
    const endTime = Date.now();
    node.status = 'failed';
    node.error = err instanceof Error ? err.message : String(err);
    node.completedAt = endTime;
    node.metadata = {
      tokens: 0,
      duration: endTime - startTime,
      model: agent.config.model,
    };

    persistNodeResult(dag.taskId, node);

    emitStepUpdate(io, dag.taskId, node);
    emitProgress(
      io,
      dag.taskId,
      `${node.agentName} 失败: ${node.label} - ${node.error}`,
      node.agentName,
    );
  }
}

/**
 * Persist a node result to the task_steps table.
 */
function persistNodeResult(taskId: string, node: DAGNode) {
  try {
    // Check if step already exists
    const existing = db.select().from(taskSteps)
      .where(eq(taskSteps.id, node.id))
      .get();

    if (existing) {
      db.update(taskSteps)
        .set({
          status: node.status === 'done' ? 'completed' : node.status,
          output: node.output ? { text: node.output, metadata: node.metadata } : null,
          startedAt: node.startedAt ? new Date(node.startedAt).toISOString() : null,
          completedAt: node.completedAt ? new Date(node.completedAt).toISOString() : null,
        } as any)
        .where(eq(taskSteps.id, node.id))
        .run();
    } else {
      db.insert(taskSteps).values({
        id: node.id,
        taskId,
        agentId: node.agentId,
        label: node.label,
        status: node.status === 'done' ? 'completed' : node.status,
        orderIndex: 0,
        input: { prompt: node.taskPrompt, dependencies: node.dependencies },
        output: node.output ? { text: node.output, metadata: node.metadata } : null,
        startedAt: node.startedAt ? new Date(node.startedAt).toISOString() : null,
        completedAt: node.completedAt ? new Date(node.completedAt).toISOString() : null,
      }).run();
    }
  } catch (err) {
    console.error('[executor] Failed to persist node result:', err);
  }
}

/**
 * Mark dependent nodes as 'skipped' when a node fails.
 */
function skipDependents(failedNodeId: string, dag: TaskDAG) {
  const toSkip = new Set<string>();
  const queue = [failedNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const node of dag.nodes) {
      if (node.status === 'pending' && node.dependencies.includes(currentId) && !toSkip.has(node.id)) {
        toSkip.add(node.id);
        node.status = 'skipped';
        queue.push(node.id);
      }
    }
  }
}

/**
 * Execute the entire DAG: run nodes in topological order, parallelizing where possible.
 */
export async function executeDAG(
  dag: TaskDAG,
  agents: AgentInfo[],
  io: SocketIOServer,
): Promise<TaskDAG> {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  dag.status = 'running';
  emitDAGUpdate(io, dag.taskId, dag);
  emitProgress(io, dag.taskId, `任务开始执行: ${dag.taskName}，共 ${dag.nodes.length} 个步骤`);

  // Update task status in database
  db.update(tasks)
    .set({ status: 'running', dag: dag as any })
    .where(eq(tasks.id, dag.taskId))
    .run();

  // Execute in waves: find ready nodes, run them in parallel, repeat
  let maxIterations = dag.nodes.length + 1; // safety guard
  while (maxIterations-- > 0) {
    const readyNodes = getReadyNodes(dag);

    if (readyNodes.length === 0) {
      // No more nodes to run - check if we're done or stuck
      break;
    }

    // Execute all ready nodes in parallel
    const promises = readyNodes.map(async (node) => {
      const agent = agentMap.get(node.agentId);
      if (!agent) {
        node.status = 'failed';
        node.error = `Agent "${node.agentId}" not found`;
        node.completedAt = Date.now();
        emitStepUpdate(io, dag.taskId, node);
        emitProgress(io, dag.taskId, `错误: 找不到代理 ${node.agentId}`, 'System');
        return;
      }

      // Check if agent has API key; if not, try to use fallback
      if (!agent.config.apiKey) {
        const fallback = agents.find((a) => a.config.apiKey && a.config.apiKey.length > 0);
        if (fallback) {
          emitProgress(
            io,
            dag.taskId,
            `${agent.name} 没有配置API密钥，使用 ${fallback.name} 的配置代替`,
            'System',
          );
          await executeNode(node, dag, { ...agent, config: fallback.config }, io);
        } else {
          node.status = 'failed';
          node.error = 'No API key configured for this agent and no fallback available';
          node.completedAt = Date.now();
          emitStepUpdate(io, dag.taskId, node);
          return;
        }
      } else {
        await executeNode(node, dag, agent, io);
      }

      // If this node failed, skip its dependents
      if (node.status === 'failed') {
        skipDependents(node.id, dag);
      }
    });

    await Promise.all(promises);
    emitDAGUpdate(io, dag.taskId, dag);
  }

  // Determine final status
  const hasFailed = dag.nodes.some((n) => n.status === 'failed');
  const hasSkipped = dag.nodes.some((n) => n.status === 'skipped');
  const allDone = dag.nodes.every((n) => n.status === 'done' || n.status === 'skipped');

  if (hasFailed) {
    dag.status = 'failed';
    emitProgress(io, dag.taskId, '任务执行失败，部分步骤未能完成');
  } else if (allDone) {
    dag.status = 'done';
    emitProgress(io, dag.taskId, '任务执行完成！所有步骤已成功完成');
  } else {
    dag.status = 'failed';
    emitProgress(io, dag.taskId, '任务异常终止');
  }

  // Update task in database
  const finalStatus = dag.status === 'done' ? 'completed' : 'failed';
  db.update(tasks)
    .set({
      status: finalStatus,
      dag: dag as any,
      completedAt: new Date().toISOString(),
    } as any)
    .where(eq(tasks.id, dag.taskId))
    .run();

  emitDAGUpdate(io, dag.taskId, dag);
  return dag;
}
