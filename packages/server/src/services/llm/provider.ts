export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMProvider {
  chat(options: LLMOptions): Promise<string>;
  chatStream(options: LLMOptions): AsyncIterable<string>;
}
