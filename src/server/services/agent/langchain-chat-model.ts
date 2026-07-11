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
    const chunks: string[] = [];
    const reasoningChunks: string[] = [];

    await new Promise<void>((resolve, reject) => {
      this.adapter.sendMessageStream(convertedMessages(messages), this.config, {
        onToken: (token: string) => {
          chunks.push(token);
        },
        onReasoningToken: (token: string) => {
          reasoningChunks.push(token);
        },
        onComplete: (response?: LLMResponse) => {
          // If reasoning wasn't streamed, check for it in the complete response
          if (reasoningChunks.length === 0 && response?.reasoning) {
            reasoningChunks.push(response.reasoning);
          }
          resolve();
        },
        onError: (err: Error) => {
          reject(err);
        },
      });
    });

    const fullText = chunks.join('');
    const fullReasoning = reasoningChunks.join('');
    const additional: Record<string, unknown> = {};
    if (fullReasoning) additional.reasoning = fullReasoning;

    yield new ChatGenerationChunk({
      text: fullText,
      message: new AIMessageChunk({ content: fullText, additional_kwargs: additional }),
    });
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

function convertedMessages(messages: BaseMessage[]): Message[] {
  return messages.map((msg) => ({
    role: msg._getType() === 'human' ? 'user' : msg._getType() === 'ai' ? 'assistant' : msg._getType() === 'system' ? 'system' : 'user',
    content: typeof msg.content === 'string' ? msg.content : '',
  }));
}
