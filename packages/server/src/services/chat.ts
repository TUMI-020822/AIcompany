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
import { mcpManager } from './mcp/manager.js';
import { executeSkill } from './skills/executor.js';

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
 * Build a tool-use system prompt appendix describing available MCP tools and skills.
 */
function buildToolUsePrompt(mcpServers: any[], skills: string[]): string {
  const parts: string[] = [];

  // Collect MCP tools from running servers
  const mcpToolDescriptions: string[] = [];
  if (mcpServers && mcpServers.length > 0) {
    for (const srv of mcpServers) {
      const serverId = srv.id || srv;
      const runningServer = mcpManager.getServer(serverId);
      if (runningServer && runningServer.status === 'running') {
        for (const tool of runningServer.tools) {
          mcpToolDescriptions.push(`- ${serverId}::${tool.name}: ${tool.description || 'No description'}`);
        }
      }
    }
  }

  if (mcpToolDescriptions.length > 0 || (skills && skills.length > 0)) {
    parts.push('\n\n---\n## Available Tools\nYou have access to the following tools. To use a tool, include a tool call in your response using this format:\n```tool\n{"tool": "<tool_name>", "server": "<server_id or skill>", "args": {<arguments>}}\n```\n');

    if (mcpToolDescriptions.length > 0) {
      parts.push('### MCP Server Tools');
      parts.push(mcpToolDescriptions.join('\n'));
    }

    if (skills && skills.length > 0) {
      parts.push('\n### Built-in Skills');
      for (const skillId of skills) {
        parts.push(`- skill::${skillId}`);
      }
    }

    parts.push('\nAfter a tool result is returned, incorporate the result into your response to the user.');
  }

  return parts.join('\n');
}

/**
 * Parse tool calls from assistant response.
 * Looks for ```tool\n{...}\n``` blocks.
 */
function parseToolCalls(response: string): Array<{ tool: string; server: string; args: Record<string, unknown> }> {
  const toolCalls: Array<{ tool: string; server: string; args: Record<string, unknown> }> = [];
  const regex = /```tool\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool) {
        toolCalls.push({
          tool: parsed.tool,
          server: parsed.server || '',
          args: parsed.args || {},
        });
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  return toolCalls;
}

/**
 * Execute tool calls and return results.
 */
async function executeToolCalls(
  toolCalls: Array<{ tool: string; server: string; args: Record<string, unknown> }>,
): Promise<string> {
  const results: string[] = [];

  for (const call of toolCalls) {
    try {
      let resultText: string;

      if (call.server === 'skill' || call.server === '') {
        // Try as a built-in skill
        const skillResult = await executeSkill(call.tool, call.args);
        resultText = skillResult.success
          ? skillResult.output
          : `Error: ${skillResult.error}`;
      } else {
        // Try as MCP server tool
        const mcpResult = await mcpManager.callTool(call.server, call.tool, call.args);
        resultText = mcpResult.content
          ?.map((c) => c.text || '')
          .filter(Boolean)
          .join('\n') || 'Tool returned empty result';

        if (mcpResult.isError) {
          resultText = `Tool error: ${resultText}`;
        }
      }

      results.push(`### Tool Result: ${call.server}::${call.tool}\n${resultText}`);
    } catch (err) {
      results.push(`### Tool Error: ${call.server}::${call.tool}\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return results.join('\n\n');
}

/**
 * Send a message to an agent and get a response.
 * Stores both user and assistant messages in the database.
 * Supports a tool-use loop: if the LLM emits tool calls, execute them and re-prompt.
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

  // Build tool-use prompt if tools are available
  const mcpServers = (ctx.agentConfig.mcpServers as any[]) || [];
  const skills = (ctx.agentConfig.skills as string[]) || [];
  const toolPrompt = buildToolUsePrompt(mcpServers, skills);

  // Build messages array
  const history = loadHistory(conversationId);
  const systemContent = (ctx.systemPrompt || 'You are a helpful AI assistant.') + toolPrompt;
  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...history,
  ];

  // Create LLM provider
  const llm = createProvider(ctx.provider as ProviderId, {
    apiKey: ctx.apiKey,
    baseUrl: ctx.baseUrl || undefined,
    model: ctx.agentConfig.model as string | undefined,
  });

  const llmOptions = {
    model: (ctx.agentConfig.model as string) || '',
    temperature: (ctx.agentConfig.temperature as number) || 0.7,
    maxTokens: (ctx.agentConfig.maxTokens as number) || 4096,
  };

  let responseContent = '';
  const maxToolLoops = 3;
  let toolLoop = 0;

  // Initial LLM call
  if (onToken) {
    const stream = llm.chatStream({ ...llmOptions, messages, stream: true });
    for await (const token of stream) {
      responseContent += token;
      onToken(token);
    }
  } else {
    responseContent = await llm.chat({ ...llmOptions, messages });
  }

  // Tool-use loop: check for tool calls, execute, and re-prompt
  while (toolLoop < maxToolLoops) {
    const toolCalls = parseToolCalls(responseContent);
    if (toolCalls.length === 0) break;

    toolLoop++;
    const toolResults = await executeToolCalls(toolCalls);

    // Append tool results and re-prompt
    const continuationMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: responseContent },
      { role: 'user', content: `Tool execution results:\n\n${toolResults}\n\nPlease incorporate these results and provide your final response to the user.` },
    ];

    if (onToken) {
      onToken('\n\n---\n*[Tool results received, generating response...]*\n\n');
    }

    let continuation = '';
    if (onToken) {
      const stream = llm.chatStream({ ...llmOptions, messages: continuationMessages, stream: true });
      for await (const token of stream) {
        continuation += token;
        onToken(token);
      }
    } else {
      continuation = await llm.chat({ ...llmOptions, messages: continuationMessages });
    }

    responseContent = responseContent + '\n\n' + continuation;
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
      toolLoops: toolLoop,
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
