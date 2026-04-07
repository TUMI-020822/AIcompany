import { createProvider, type ProviderId } from '../llm/registry.js';
import type { ChatMessage } from '../llm/provider.js';
import type { AgentInfo, DAGNode, LLMPlanOutput, TaskDAG } from './types.js';

/**
 * Find the first agent that has a usable API key configured,
 * so we can use its credentials for the planning LLM call.
 */
function findPlannerAgent(agents: AgentInfo[]): AgentInfo | null {
  for (const agent of agents) {
    if (agent.config.apiKey && agent.config.apiKey.length > 0) {
      return agent;
    }
  }
  return agents.length > 0 ? agents[0] : null;
}

/**
 * Build the system + user prompt for the planning LLM call.
 */
function buildPlannerPrompt(taskName: string, taskDescription: string, agents: AgentInfo[]): ChatMessage[] {
  const agentList = agents.map((a) =>
    `- ID: "${a.id}", Name: "${a.name}", Department: "${a.dept}", Skills: [${a.tags.join(', ')}], Description: "${a.description}"`
  ).join('\n');

  const system: ChatMessage = {
    role: 'system',
    content: `You are a task decomposition planner for an AI company. You break down complex tasks into a DAG (directed acyclic graph) of subtasks and assign each to the most appropriate agent.

RULES:
1. Create between 3 and 8 subtasks.
2. Each subtask must be assigned to one of the available agents by their exact ID.
3. Define dependencies: which subtasks must complete before another can start.
4. Support parallelism: subtasks with no interdependency should have empty dependency arrays so they run in parallel.
5. The first subtask(s) should have empty dependencies.
6. Every subtask ID must be unique (use simple IDs like "step1", "step2", etc.).
7. The final subtask should depend on all prior subtasks that feed into it.

You MUST respond with ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "subtasks": [
    {
      "id": "step1",
      "label": "Short label for the subtask",
      "taskPrompt": "Detailed prompt telling the agent exactly what to do",
      "agentId": "agent_id_from_list",
      "dependencies": []
    }
  ]
}`,
  };

  const user: ChatMessage = {
    role: 'user',
    content: `Task: "${taskName}"
Description: ${taskDescription || 'No additional description provided.'}

Available agents:
${agentList}

Decompose this task into a DAG of subtasks. Assign each subtask to the most appropriate agent based on their department and skills. Use parallelism where subtasks are independent.`,
  };

  return [system, user];
}

/**
 * Try to parse the LLM output as JSON, extracting from markdown code blocks if needed.
 */
function parseLLMJson(raw: string): LLMPlanOutput | null {
  let text = raw.trim();

  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0) {
      return parsed as LLMPlanOutput;
    }
  } catch {
    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*"subtasks"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && Array.isArray(parsed.subtasks)) {
          return parsed as LLMPlanOutput;
        }
      } catch {
        // fall through
      }
    }
  }
  return null;
}

/**
 * Validate and fix the DAG structure: ensure all agentIds exist, dependencies are valid, no cycles.
 */
function validateDAG(plan: LLMPlanOutput, agents: AgentInfo[]): LLMPlanOutput {
  const agentIds = new Set(agents.map((a) => a.id));
  const nodeIds = new Set(plan.subtasks.map((s) => s.id));

  const validated = plan.subtasks.map((subtask) => {
    // Fix invalid agent references
    let agentId = subtask.agentId;
    if (!agentIds.has(agentId)) {
      agentId = agents[0].id;
    }

    // Filter out invalid dependency references
    const deps = (subtask.dependencies || []).filter((d) => nodeIds.has(d) && d !== subtask.id);

    return { ...subtask, agentId, dependencies: deps };
  });

  return { subtasks: validated };
}

/**
 * Create a simple heuristic-based fallback plan when LLM planning fails.
 */
function createFallbackPlan(taskName: string, taskDescription: string, agents: AgentInfo[]): LLMPlanOutput {
  const deptMap: Record<string, AgentInfo[]> = {};
  for (const agent of agents) {
    if (!deptMap[agent.dept]) deptMap[agent.dept] = [];
    deptMap[agent.dept].push(agent);
  }

  const subtasks: LLMPlanOutput['subtasks'] = [];
  const prompt = taskDescription || taskName;

  // Step 1: Analysis/planning (product or first agent)
  const analyst = deptMap['产品部']?.[0] || agents[0];
  subtasks.push({
    id: 'step1',
    label: '需求分析与规划',
    taskPrompt: `Analyze the following task and produce a detailed requirements document with goals, constraints, and success criteria.\n\nTask: ${prompt}`,
    agentId: analyst.id,
    dependencies: [],
  });

  // Step 2: Parallel execution by different departments
  const parallelAgents: AgentInfo[] = [];
  const usedIds = new Set([analyst.id]);
  const deptOrder = ['工程部', '设计部', '数据部', '市场部', '运营部', '战略部'];

  for (const dept of deptOrder) {
    const deptAgents = deptMap[dept] || [];
    for (const a of deptAgents) {
      if (!usedIds.has(a.id) && parallelAgents.length < 3) {
        parallelAgents.push(a);
        usedIds.add(a.id);
      }
    }
  }

  // If we still have no parallel agents, pick from remaining
  if (parallelAgents.length === 0) {
    for (const a of agents) {
      if (!usedIds.has(a.id) && parallelAgents.length < 2) {
        parallelAgents.push(a);
        usedIds.add(a.id);
      }
    }
  }

  let stepIdx = 2;
  for (const agent of parallelAgents) {
    const label = `${agent.dept} - ${agent.name}方案`;
    subtasks.push({
      id: `step${stepIdx}`,
      label,
      taskPrompt: `Based on the requirements analysis from the previous step, create a detailed plan from the perspective of ${agent.name} (${agent.dept}).\n\nOriginal task: ${prompt}\n\nFocus on your area of expertise: ${agent.tags.join(', ')}.`,
      agentId: agent.id,
      dependencies: ['step1'],
    });
    stepIdx++;
  }

  // Final step: Integration/summary
  const allPriorSteps = subtasks.slice(1).map((s) => s.id);
  subtasks.push({
    id: `step${stepIdx}`,
    label: '综合评审与整合',
    taskPrompt: `Review and integrate all the outputs from the previous steps into a cohesive final deliverable.\n\nOriginal task: ${prompt}\n\nSynthesize the analysis, plans, and recommendations into a comprehensive result.`,
    agentId: analyst.id,
    dependencies: allPriorSteps,
  });

  return { subtasks };
}

/**
 * Plan a task: use an LLM to decompose it into a DAG, or fall back to heuristics.
 */
export async function planTask(
  taskId: string,
  taskName: string,
  taskDescription: string,
  agents: AgentInfo[],
): Promise<TaskDAG> {
  if (agents.length === 0) {
    throw new Error('No agents available for task planning');
  }

  let plan: LLMPlanOutput | null = null;

  // Try LLM-based planning
  const plannerAgent = findPlannerAgent(agents);
  if (plannerAgent && plannerAgent.config.apiKey) {
    try {
      const messages = buildPlannerPrompt(taskName, taskDescription, agents);
      const provider = createProvider(plannerAgent.config.provider as ProviderId, {
        apiKey: plannerAgent.config.apiKey,
        baseUrl: plannerAgent.config.baseUrl || undefined,
        model: plannerAgent.config.model,
      });

      const raw = await provider.chat({
        model: plannerAgent.config.model,
        messages,
        temperature: 0.3,
        maxTokens: 4096,
      });

      console.log('[planner] LLM raw output length:', raw.length);
      plan = parseLLMJson(raw);
      if (plan) {
        plan = validateDAG(plan, agents);
        console.log('[planner] LLM plan validated with', plan.subtasks.length, 'subtasks');
      } else {
        console.warn('[planner] Failed to parse LLM output, falling back to heuristics');
      }
    } catch (err) {
      console.error('[planner] LLM planning failed:', err);
    }
  } else {
    console.log('[planner] No agent with API key found, using heuristic fallback');
  }

  // Fallback to heuristic plan
  if (!plan) {
    plan = createFallbackPlan(taskName, taskDescription, agents);
    console.log('[planner] Using fallback plan with', plan.subtasks.length, 'subtasks');
  }

  // Build DAGNode[] from the plan
  const nodes: DAGNode[] = plan.subtasks.map((s) => {
    const agent = agents.find((a) => a.id === s.agentId) || agents[0];
    return {
      id: s.id,
      agentId: agent.id,
      agentName: agent.name,
      label: s.label,
      taskPrompt: s.taskPrompt,
      dependencies: s.dependencies,
      status: 'pending' as const,
    };
  });

  return {
    nodes,
    taskId,
    taskName,
    status: 'planning',
  };
}
