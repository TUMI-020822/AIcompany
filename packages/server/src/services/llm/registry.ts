import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config.js';
import type { LLMProvider, LLMOptions, ChatMessage } from './provider.js';

// ── OpenAI-compatible adapter (works for OpenAI, DeepSeek, Ollama, custom) ──
class OpenAICompatibleProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, baseURL: string, defaultModel: string) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.defaultModel = defaultModel;
  }

  async chat(options: LLMOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: options.model || this.defaultModel,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: false,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async *chatStream(options: LLMOptions): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: options.model || this.defaultModel,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}

// ── Anthropic (Claude) adapter ──────────────────────────────────────────────
class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'claude-3-5-sonnet-20241022') {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = defaultModel;
  }

  async chat(options: LLMOptions): Promise<string> {
    const systemMsg = options.messages.find((m) => m.role === 'system');
    const nonSystemMsgs = options.messages.filter((m) => m.role !== 'system');

    const response = await this.client.messages.create({
      model: options.model || this.defaultModel,
      max_tokens: options.maxTokens ?? 4096,
      system: systemMsg?.content ?? '',
      messages: nonSystemMsgs.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  async *chatStream(options: LLMOptions): AsyncIterable<string> {
    const systemMsg = options.messages.find((m) => m.role === 'system');
    const nonSystemMsgs = options.messages.filter((m) => m.role !== 'system');

    const stream = this.client.messages.stream({
      model: options.model || this.defaultModel,
      max_tokens: options.maxTokens ?? 4096,
      system: systemMsg?.content ?? '',
      messages: nonSystemMsgs.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}

// ── Google Gemini adapter ───────────────────────────────────────────────────
class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'gemini-1.5-pro') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.defaultModel = defaultModel;
  }

  async chat(options: LLMOptions): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: options.model || this.defaultModel });

    const systemMsg = options.messages.find((m) => m.role === 'system');
    const history = options.messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: m.content }],
      }));

    const lastMsg = options.messages[options.messages.length - 1];

    const chat = model.startChat({
      history,
      systemInstruction: systemMsg ? { role: 'user' as const, parts: [{ text: systemMsg.content }] } : undefined,
    });

    const result = await chat.sendMessage(lastMsg.content);
    return result.response.text();
  }

  async *chatStream(options: LLMOptions): AsyncIterable<string> {
    const model = this.genAI.getGenerativeModel({ model: options.model || this.defaultModel });

    const systemMsg = options.messages.find((m) => m.role === 'system');
    const history = options.messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: m.content }],
      }));

    const lastMsg = options.messages[options.messages.length - 1];

    const chat = model.startChat({
      history,
      systemInstruction: systemMsg ? { role: 'user' as const, parts: [{ text: systemMsg.content }] } : undefined,
    });

    const result = await chat.sendMessageStream(lastMsg.content);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
}

// ── Provider Registry ───────────────────────────────────────────────────────

export type ProviderId = 'deepseek' | 'openai' | 'claude' | 'gemini' | 'ollama' | 'custom';

interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

const DEFAULT_MODELS: Record<ProviderId, string> = {
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o',
  claude: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-pro',
  ollama: 'llama3',
  custom: 'gpt-3.5-turbo',
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434/v1',
};

export function createProvider(providerId: ProviderId, providerConfig?: ProviderConfig): LLMProvider {
  const apiKey = providerConfig?.apiKey || '';
  const model = providerConfig?.model || DEFAULT_MODELS[providerId];

  switch (providerId) {
    case 'deepseek':
      return new OpenAICompatibleProvider(
        apiKey || config.DEEPSEEK_API_KEY,
        providerConfig?.baseUrl || DEFAULT_BASE_URLS.deepseek,
        model,
      );

    case 'openai':
      return new OpenAICompatibleProvider(
        apiKey || config.OPENAI_API_KEY,
        providerConfig?.baseUrl || DEFAULT_BASE_URLS.openai,
        model,
      );

    case 'claude':
      return new ClaudeProvider(apiKey || config.ANTHROPIC_API_KEY, model);

    case 'gemini':
      return new GeminiProvider(apiKey || config.GOOGLE_AI_API_KEY, model);

    case 'ollama':
      return new OpenAICompatibleProvider(
        'ollama',
        providerConfig?.baseUrl || config.OLLAMA_BASE_URL + '/v1',
        model,
      );

    case 'custom':
      if (!providerConfig?.baseUrl) {
        throw new Error('Custom provider requires a baseUrl');
      }
      return new OpenAICompatibleProvider(apiKey, providerConfig.baseUrl, model);

    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

export function getDefaultModel(providerId: ProviderId): string {
  return DEFAULT_MODELS[providerId] || 'gpt-3.5-turbo';
}
