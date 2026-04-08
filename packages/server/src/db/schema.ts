import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ── Companies ───────────────────────────────────────────────────────────────
export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry').notNull().default(''),
  description: text('description').notNull().default(''),
  settings: text('settings', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  createdAt: text('created_at').notNull(),
});

// ── Agent Catalog (built-in agents) ─────────────────────────────────────────
export const agentsCatalog = sqliteTable('agents_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  dept: text('dept').notNull(),
  description: text('description').notNull().default(''),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  role: text('role').notNull().default(''),
  // 模型配置
  model: text('model').notNull().default('deepseek-chat'),
  // 技能列表（对应可用 skills）
  skills: text('skills', { mode: 'json' }).$type<string[]>().default([]),
  // MCP 工具列表
  mcpTools: text('mcp_tools', { mode: 'json' }).$type<string[]>().default([]),
  // 自优化默认开启
  selfImprove: integer('self_improve').notNull().default(1), // boolean as int
  // Program.md 指令
  programMd: text('program_md').notNull().default(''),
  // 基准测试任务
  benchmark: text('benchmark').notNull().default(''),
  systemPrompt: text('system_prompt').notNull().default(''),
});

// ── Company Employees (hired agents) ────────────────────────────────────────
export const companyEmployees = sqliteTable('company_employees', {
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull(),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  hiredAt: text('hired_at').notNull(),
});

// ── Custom Agents (user-created) ────────────────────────────────────────────
export const customAgents = sqliteTable('custom_agents', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dept: text('dept').notNull().default(''),
  description: text('description').notNull().default(''),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  systemPrompt: text('system_prompt').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

// ── Chat Conversations ──────────────────────────────────────────────────────
export const chatConversations = sqliteTable('chat_conversations', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('agent'),       // 'agent' | 'group' | 'department'
  targetId: text('target_id').notNull().default(''),    // agent id or dept name
  name: text('name').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

// ── Chat Messages ───────────────────────────────────────────────────────────
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  senderType: text('sender_type').notNull(),            // 'user' | 'agent'
  senderId: text('sender_id').notNull().default(''),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  createdAt: text('created_at').notNull(),
});

// ── Tasks ───────────────────────────────────────────────────────────────────
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('pending'),  // 'pending' | 'running' | 'completed' | 'failed'
  dag: text('dag', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});

// ── Task Steps ──────────────────────────────────────────────────────────────
export const taskSteps = sqliteTable('task_steps', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull(),
  label: text('label').notNull().default(''),
  status: text('status').notNull().default('pending'),
  orderIndex: integer('order_index').notNull().default(0),
  input: text('input', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  output: text('output', { mode: 'json' }).$type<Record<string, unknown>>(),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

// ── API Keys ────────────────────────────────────────────────────────────────
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),                 // 'openai' | 'deepseek' | 'claude' | 'gemini' | 'ollama' | 'custom'
  encryptedKey: text('encrypted_key').notNull().default(''),
  baseUrl: text('base_url').notNull().default(''),
  createdAt: text('created_at').notNull(),
});
