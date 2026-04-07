import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  chatMessages,
  chatConversations,
  agentsCatalog,
  customAgents,
  companyEmployees,
  apiKeys,
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createProvider, type ProviderId } from './llm/registry.js';
import type { ChatMessage } from './llm/provider.js';

interface SendMessageOptions {
  conversationId: string;
  content: string;
  senderId?: string;
  onToken?: (token: string) => void;
}

interface ChatResponse {
  userMessage: {
    id: string;
    content: string;
    createdAt: string;
  };
  assistantMessage: {
    id: string;
    content: string;
    createdAt: string;
    agentId: string;
  };
}

/**
 * Get an agent's system prompt and config by looking up the conversation target,
 * then the catalog/custom agents and company_employees config.
 */
function resolveAgentContext(conversationId: string) {
  const conv = db.select().from(chatConversations)
    .where(eq(chatConversations.id, conversationId))
    .get();

  if (!conv) {
    throw new Error('Conversation not found');
  }

  const agentId = conv.targetId;
  const companyId = conv.companyId;

  // Look up agent definition
  const catalogAgent = db.select().from(agentsCatalog)
    .where(eq(agentsCatalog.id, agentId)).get();
  const custom = catalogAgent
    ? null
    : db.select().from(customAgents)
        .where(and(eq(customAgents.id, agentId), eq(customAgents.companyId, companyId))).get();

  const agent = catalogAgent || custom;
  if (!agent) {
    throw new Error(`Agent "${agentId}" not found`);
  }

  // Look up hired config
  const employee = db.select().from(companyEmployees)
    .where(and(eq(companyEmployees.companyId, companyId), eq(companyEmployees.agentId, agentId)))
    .get();

  const agentConfig = (employee?.config as Record<string, unknown>) || {};

  // Look up company API key for the provider
  const provider = (agentConfig.provider as string) || 'deepseek';
  const companyKey = db.select().from(apiKeys)
    .where(and(eq(apiKeys.companyId, companyId), eq(apiKeys.provider, provider)))
    .get();

  return {
    agent,
    agentConfig,
    companyId,
    agentId,
    provider,
    apiKey: companyKey?.encryptedKey || '',
    baseUrl: companyKey?.baseUrl || '',
    systemPrompt: agent.systemPrompt || '',
  };
}

/**
 * Load recent conversation history as ChatMessage[]
 */
function loadHistory(conversationId: string, maxMessages: number = 20): ChatMessage[] {
  const messages = db.select().from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt)
    .all();

  // Take last N messages
  const recent = messages.slice(-maxMessages);

  return recent.map((m) => ({
    role: m.senderType === 'user' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }));
}

/**
 * Send a message to an agent and get a response.
 * Stores both user and assistant messages in the database.
 */
export async function sendMessage(options: SendMessageOptions): Promise<ChatResponse> {
  const { conversationId, content, senderId, onToken } = options;

  // Store user message
  const userMsgId = nanoid();
  const userMsgTime = new Date().toISOString();
  db.insert(chatMessages).values({
    id: userMsgId,
    conversationId,
    senderType: 'user',
    senderId: senderId || 'user',
    content,
    metadata: {},
    createdAt: userMsgTime,
  }).run();

  // Resolve agent context
  const ctx = resolveAgentContext(conversationId);

  // Build messages array
  const history = loadHistory(conversationId);
  const messages: ChatMessage[] = [
    { role: 'system', content: ctx.systemPrompt },
    ...history,
  ];

  // Create LLM provider
  const llm = createProvider(ctx.provider as ProviderId, {
    apiKey: ctx.apiKey,
    baseUrl: ctx.baseUrl || undefined,
    model: ctx.agentConfig.model as string | undefined,
  });

  let responseContent = '';

  if (onToken) {
    // Streaming mode
    const stream = llm.chatStream({
      model: (ctx.agentConfig.model as string) || '',
      messages,
      temperature: (ctx.agentConfig.temperature as number) || 0.7,
      maxTokens: (ctx.agentConfig.maxTokens as number) || 4096,
      stream: true,
    });

    for await (const token of stream) {
      responseContent += token;
      onToken(token);
    }
  } else {
    // Non-streaming mode
    responseContent = await llm.chat({
      model: (ctx.agentConfig.model as string) || '',
      messages,
      temperature: (ctx.agentConfig.temperature as number) || 0.7,
      maxTokens: (ctx.agentConfig.maxTokens as number) || 4096,
    });
  }

  // Store assistant message
  const assistantMsgId = nanoid();
  const assistantMsgTime = new Date().toISOString();
  db.insert(chatMessages).values({
    id: assistantMsgId,
    conversationId,
    senderType: 'agent',
    senderId: ctx.agentId,
    content: responseContent,
    metadata: {
      provider: ctx.provider,
      model: ctx.agentConfig.model || '',
    },
    createdAt: assistantMsgTime,
  }).run();

  return {
    userMessage: {
      id: userMsgId,
      content,
      createdAt: userMsgTime,
    },
    assistantMessage: {
      id: assistantMsgId,
      content: responseContent,
      createdAt: assistantMsgTime,
      agentId: ctx.agentId,
    },
  };
}
