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
    _options?: Record<string, unknown>,
  ): AsyncGenerator<ChatGenerationChunk> {
    const chunks: ChatGenerationChunk[] = [];
    let finished = false;
    let error: Error | null = null;
    let wake: (() => void) | null = null;

    this.adapter.sendMessageStream(convertedMessages(messages), this.config, {
      onToken: (token: string) => {
        chunks.push(new ChatGenerationChunk({
          text: token,
          message: new AIMessageChunk({ content: token }),
        }));
        wake?.();
        wake = null;
      },
      onReasoningToken: (token: string) => {
        chunks.push(new ChatGenerationChunk({
          text: '',
          message: new AIMessageChunk({
            content: '',
            additional_kwargs: { reasoning: token },
          }),
        }));
        wake?.();
        wake = null;
      },
      onComplete: (response?: LLMResponse) => {
        if (chunks.length === 0 || !chunks.some(c => (c.message.additional_kwargs as Record<string, unknown>)?.reasoning)) {
          if (response?.reasoning) {
            chunks.push(new ChatGenerationChunk({
              text: '',
              message: new AIMessageChunk({
                content: '',
                additional_kwargs: { reasoning: response.reasoning },
              }),
            }));
          }
        }
        finished = true;
        wake?.();
        wake = null;
      },
      onError: (err: Error) => {
        error = err;
        finished = true;
        wake?.();
        wake = null;
      },
    });

    while (!finished) {
      if (chunks.length > 0) {
        yield chunks.shift()!;
      } else {
        await new Promise<void>(r => { wake = r; });
      }
    }

    while (chunks.length > 0) {
      yield chunks.shift()!;
    }

    if (error) throw error;
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
