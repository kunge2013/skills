import {
  BaseChatModel,
} from '@langchain/core/language_models/chat_models';
import {
  type BaseMessage,
  AIMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import {
  type ChatGeneration,
  type ChatResult,
  ChatGenerationChunk,
} from '@langchain/core/outputs';
import type { ITextProviderAdapter, TextModelConfig, Message, StreamHandlers, LLMResponse } from '../llm/types';

export class LangChainChatModel extends BaseChatModel {
  private readonly config: TextModelConfig;
  private readonly adapter: ITextProviderAdapter;

  constructor(config: TextModelConfig, adapter: ITextProviderAdapter) {
    super({});
    this.config = config;
    this.adapter = adapter;
  }

  _llmType(): string {
    return this.config?.providerId || 'custom';
  }

  async _generate(
    messages: BaseMessage[],
    _options?: Record<string, unknown>,
    _runManager?: unknown
  ): Promise<ChatResult> {
    const converted = this.convertMessages(messages);
    const response = await this.adapter.sendMessage(converted, this.config);
    const generation = this.buildGeneration(response);
    return { generations: [generation] };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options?: Record<string, unknown>
  ): AsyncGenerator<ChatGenerationChunk> {
    const converted = this.convertMessages(messages);
    const chunks: string[] = [];

    await new Promise<void>((resolve, reject) => {
      this.adapter.sendMessageStream(converted, this.config, {
        onToken: (token: string) => {
          chunks.push(token);
        },
        onComplete: (_response?: LLMResponse) => {
          resolve();
        },
        onError: (err: Error) => {
          reject(err);
        },
      });
    });

    const fullText = chunks.join('');
    yield new ChatGenerationChunk({ text: fullText, message: new AIMessageChunk({ content: fullText }) });
  }

  _combineLLMOutput?(): Record<string, unknown> | undefined {
    return undefined;
  }

  private convertMessages(messages: BaseMessage[]): Message[] {
    return messages.map((msg) => {
      const role = this.mapRole(msg._getType());
      const content = typeof msg.content === 'string' ? msg.content : '';
      return { role, content };
    });
  }

  private mapRole(type: string): Message['role'] {
    switch (type) {
      case 'human':
        return 'user';
      case 'ai':
        return 'assistant';
      case 'system':
        return 'system';
      case 'tool':
        return 'tool';
      default:
        return 'user';
    }
  }

  private buildGeneration(response: LLMResponse): ChatGeneration {
    const message = new AIMessage(response.content);
    return { message, text: response.content };
  }
}
