import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { ChatMessage } from './provider.js';

interface LangChainOptions {
  provider: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface LangChainChatOptions {
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export class LangChainService {
  private llm: BaseLanguageModel;
  private options: LangChainOptions;

  constructor(options: LangChainOptions) {
    this.options = options;
    this.llm = this.createLLM(options);
  }

  private createLLM(options: LangChainOptions): BaseLanguageModel {
    const { provider, apiKey, model, temperature = 0.7, maxTokens = 4096 } = options;

    switch (provider.toLowerCase()) {
      case 'openai':
        return new ChatOpenAI({
          apiKey,
          model,
          temperature,
          maxTokens,
        });
      case 'azure':
        return new AzureChatOpenAI({
          azureOpenAIApiKey: apiKey,
          azureOpenAIApiVersion: '2024-02-15-preview',
          azureOpenAIApiDeploymentName: model,
          temperature,
          maxTokens,
        });
      case 'google':
        return new ChatGoogleGenerativeAI({
          apiKey,
          model,
          temperature,
          maxOutputTokens: maxTokens,
        });
      default:
        // Default to OpenAI
        return new ChatOpenAI({
          apiKey,
          model,
          temperature,
          maxTokens,
        });
    }
  }

  async chat(options: LangChainChatOptions): Promise<string> {
    const { messages, temperature = this.options.temperature, maxTokens = this.options.maxTokens } = options;

    // Convert our chat messages to LangChain format
    const langchainMessages = messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return { role: 'system', content: msg.content };
        case 'user':
          return { role: 'user', content: msg.content };
        case 'assistant':
          return { role: 'assistant', content: msg.content };
        default:
          return { role: 'user', content: msg.content };
      }
    });

    // Use simple chain
    const prompt = ChatPromptTemplate.fromMessages(langchainMessages);
    const chain = prompt.pipe(this.llm);

    const result = await chain.invoke({});
    return result.content as string;
  }

  async *chatStream(options: LangChainChatOptions): AsyncGenerator<string> {
    const { messages, temperature = this.options.temperature, maxTokens = this.options.maxTokens } = options;

    // Convert our chat messages to LangChain format
    const langchainMessages = messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return { role: 'system', content: msg.content };
        case 'user':
          return { role: 'user', content: msg.content };
        case 'assistant':
          return { role: 'assistant', content: msg.content };
        default:
          return { role: 'user', content: msg.content };
      }
    });

    // Use simple chain
    const prompt = ChatPromptTemplate.fromMessages(langchainMessages);
    const chain = prompt.pipe(this.llm);

    const stream = await chain.stream({});
    
    // Convert the stream to our expected format
    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content as string;
      }
    }
  }

  // Get the underlying LLM instance for more advanced usage
  getLLM(): BaseLanguageModel {
    return this.llm;
  }
}

export function createLangChainService(options: LangChainOptions): LangChainService {
  return new LangChainService(options);
}
