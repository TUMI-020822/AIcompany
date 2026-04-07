// ── DAG Orchestration Types ──────────────────────────────────────────────────

export interface DAGNodeMetadata {
  tokens: number;
  duration: number;
  model: string;
}

export interface DAGNode {
  id: string;
  agentId: string;
  agentName: string;
  label: string;
  taskPrompt: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  metadata?: DAGNodeMetadata;
}

export interface TaskDAG {
  nodes: DAGNode[];
  taskId: string;
  taskName: string;
  status: 'planning' | 'running' | 'done' | 'failed';
}

export interface AgentInfo {
  id: string;
  name: string;
  dept: string;
  description: string;
  tags: string[];
  role: string;
  systemPrompt: string;
  config: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string;
    temperature: number;
    maxTokens: number;
  };
}

export interface LLMPlanOutput {
  subtasks: {
    id: string;
    label: string;
    taskPrompt: string;
    agentId: string;
    dependencies: string[];
  }[];
}
