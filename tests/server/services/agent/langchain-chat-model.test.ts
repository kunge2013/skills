import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LangChainChatModel } from '../../../../src/server/services/agent/langchain-chat-model';
import type { ITextProviderAdapter, TextModelConfig, LLMResponse, StreamHandlers, Message } from '../../../../src/server/services/llm/types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('LangChainChatModel', () => {
  let mockAdapter: ITextProviderAdapter;
  let mockConfig: TextModelConfig;
  let model: LangChainChatModel;

  beforeEach(() => {
    mockAdapter = {
      sendMessage: vi.fn(),
      sendMessageStream: vi.fn(),
      getProvider: vi.fn(),
      getModels: vi.fn(),
      buildDefaultModel: vi.fn(),
      sendImageUnderstanding: vi.fn(),
      sendImageUnderstandingStream: vi.fn(),
    } as unknown as ITextProviderAdapter;

    mockConfig = {
      id: 'test-model',
      name: 'Test Model',
      enabled: true,
      providerId: 'anthropic',
      providerMeta: { id: 'anthropic', name: 'Anthropic' } as any,
      modelMeta: {} as any,
      connectionConfig: { apiKey: 'test-key' },
    };

    model = new LangChainChatModel(mockConfig, mockAdapter);
  });

  it('converts LangChain messages and calls adapter.sendMessage', async () => {
    const mockResponse: LLMResponse = {
      content: 'Hello back!',
      metadata: { model: 'test-model' },
    };
    vi.mocked(mockAdapter.sendMessage).mockResolvedValue(mockResponse);

    const messages = [new HumanMessage('Hello')];
    const result = await model.invoke(messages);

    expect(mockAdapter.sendMessage).toHaveBeenCalled();
    expect(result.content).toBe('Hello back!');
  });

  it('streams tokens via adapter.sendMessageStream', async () => {
    vi.mocked(mockAdapter.sendMessageStream).mockImplementation(
      (_msgs: Message[], _cfg: TextModelConfig, callbacks: StreamHandlers) => {
        callbacks.onToken('Hel');
        callbacks.onToken('lo!');
        callbacks.onComplete({ content: 'Hello!', metadata: {} });
        return Promise.resolve();
      }
    );

    const messages = [new HumanMessage('Stream test')];
    const chunks: string[] = [];

    for await (const chunk of model._streamResponseChunks(messages, {})) {
      if (chunk.text) chunks.push(chunk.text);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('handles adapter errors in stream', async () => {
    vi.mocked(mockAdapter.sendMessageStream).mockImplementation(
      (_msgs: Message[], _cfg: TextModelConfig, callbacks: StreamHandlers) => {
        callbacks.onError(new Error('API timeout'));
        return Promise.resolve();
      }
    );

    const messages = [new HumanMessage('Test')];

    await expect(async () => {
      for await (const _ of model._streamResponseChunks(messages, {})) {
        // consume
      }
    }).rejects.toThrow('API timeout');
  });
});
