import {
  ILLMService,
  ITextAdapterRegistry,
  Message,
  StreamHandlers,
  LLMResponse,
  ToolDefinition,
  ModelInfo,
  ModelOption,
  TextModelConfig,
} from './types';
import { LLMCallLogger } from '../llm-call/logger';

export interface IModelManager {
  getModel(key: string): Promise<TextModelConfig | undefined>;
  getAllModels(): Promise<TextModelConfig[]>;
  getEnabledModels(): Promise<TextModelConfig[]>;
}

// [AGC:START] tool=Cc author=fangkun
function resolveProtocol(config: TextModelConfig): 'openai' | 'anthropic' {
  if (config.protocol) return config.protocol;
  // Legacy configs without protocol: derive from providerId
  if (config.providerId === 'anthropic') return 'anthropic';
  // All others (openai/gemini/deepseek/maas/custom) -> openai-compatible
  return 'openai';
}
// [AGC:END]

export class LLMService implements ILLMService {
  constructor(
    private registry: ITextAdapterRegistry,
    private modelManager: IModelManager,
    private logger?: LLMCallLogger,
  ) {}

  private async getModelConfig(provider: string): Promise<TextModelConfig> {
    const model = await this.modelManager.getModel(provider);
    if (!model) {
      throw new Error(`Model config not found for provider: "${provider}"`);
    }
    return model;
  }

  // [AGC:START] tool=Cc author=fangkun
  private modelParamsOf(config: TextModelConfig): Record<string, unknown> {
    return { modelId: config.modelId || config.modelMeta?.id, ...(config.paramOverrides || {}) };
  }

  private protocolOf(config: TextModelConfig): 'openai' | 'anthropic' {
    return resolveProtocol(config);
  }
  // [AGC:END]

  // [AGC:START] tool=Cc author=fangkun
  async sendMessage(messages: Message[], provider: string): Promise<string> {
    const config = await this.getModelConfig(provider);
    const protocol = this.protocolOf(config);
    const adapter = this.registry.getAdapter(protocol);
    const handle = this.logger?.start({
      source: 'prompt', modelKey: config.id, protocol,
      modelParams: this.modelParamsOf(config), request: { messages },
    });
    try {
      const response = await adapter.sendMessage(messages, config);
      handle?.complete({
        response: { content: response.content, ...(response.metadata ? { metadata: response.metadata } : {}) },
        status: 200,
      });
      return response.content;
    } catch (e: any) {
      handle?.complete({ status: 500, error: e.message });
      throw e;
    }
  }

  async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
    const config = await this.getModelConfig(provider);
    const protocol = this.protocolOf(config);
    const adapter = this.registry.getAdapter(protocol);
    const handle = this.logger?.start({
      source: 'prompt', modelKey: config.id, protocol,
      modelParams: this.modelParamsOf(config), request: { messages },
    });
    try {
      const response = await adapter.sendMessage(messages, config);
      handle?.complete({ response: response as unknown as Record<string, unknown>, status: 200 });
      return response;
    } catch (e: any) {
      handle?.complete({ status: 500, error: e.message });
      throw e;
    }
  }

  async sendRaw(payload: Record<string, any>, provider: string): Promise<Record<string, any>> {
    const config = await this.getModelConfig(provider);
    const protocol = this.protocolOf(config);
    const adapter = this.registry.getAdapter(protocol);
    if (!adapter.sendRaw) {
      throw new Error(`Provider "${provider}" does not support raw invocation`);
    }
    const handle = this.logger?.start({
      source: 'apiTester', modelKey: config.id, protocol,
      modelParams: this.modelParamsOf(config), request: payload,
    });
    try {
      const result = await adapter.sendRaw(payload, config);
      handle?.complete({ response: result, status: 200 });
      return result;
    } catch (e: any) {
      handle?.complete({ status: 500, error: e.message });
      throw e;
    }
  }

  async testConnection(provider: string): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = this.protocolOf(config);
    const adapter = this.registry.getAdapter(protocol);
    const testMessages: Message[] = [{ role: 'user', content: 'Hello, this is a connection test.' }];
    const handle = this.logger?.start({
      source: 'test-connection', modelKey: config.id, protocol,
      modelParams: this.modelParamsOf(config), request: { messages: testMessages },
    });
    try {
      const response = await adapter.sendMessage(testMessages, config);
      handle?.complete({ response: { content: response.content }, status: 200 });
    } catch (e: any) {
      handle?.complete({ status: 500, error: e.message });
      throw e;
    }
  }

  async sendMessageStream(messages: Message[], provider: string, callbacks: StreamHandlers): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = this.protocolOf(config);
    const adapter = this.registry.getAdapter(protocol);
    const handle = this.logger?.start({
      source: 'stream', modelKey: config.id, protocol,
      modelParams: this.modelParamsOf(config), request: { messages },
    });
    const wrapped: StreamHandlers = {
      onToken: callbacks.onToken,
      onReasoningToken: callbacks.onReasoningToken,
      onToolCall: callbacks.onToolCall,
      onComplete: (response) => {
        handle?.complete({
          response: response
            ? { content: response.content, reasoning: response.reasoning, ...(response.metadata ? { metadata: response.metadata } : {}) }
            : undefined,
          status: 200,
        });
        callbacks.onComplete(response);
      },
      onError: (error) => {
        handle?.complete({ status: 500, error: error.message });
        callbacks.onError(error);
      },
    };
    await adapter.sendMessageStream(messages, config, wrapped);
  }

  async sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = this.protocolOf(config);
    const adapter = this.registry.getAdapter(protocol);
    const handle = this.logger?.start({
      source: 'stream', modelKey: config.id, protocol,
      modelParams: this.modelParamsOf(config), request: { messages, tools },
    });
    const wrapped: StreamHandlers = {
      onToken: callbacks.onToken,
      onReasoningToken: callbacks.onReasoningToken,
      onToolCall: callbacks.onToolCall,
      onComplete: (response) => {
        handle?.complete({
          response: response
            ? { content: response.content, reasoning: response.reasoning, ...(response.metadata ? { metadata: response.metadata } : {}) }
            : undefined,
          status: 200,
        });
        callbacks.onComplete(response);
      },
      onError: (error) => {
        handle?.complete({ status: 500, error: error.message });
        callbacks.onError(error);
      },
    };
    await adapter.sendMessageStreamWithTools(messages, config, tools, wrapped);
  }
  // [AGC:END]

  async fetchModelList(provider: string, customConfig?: Partial<TextModelConfig>): Promise<ModelOption[]> {
    const adapter = this.registry.getAdapter(provider);
    const models = await this.registry.getModels(
      provider,
      customConfig as TextModelConfig | undefined
    );
    return models.map(m => ({ value: m.id, label: m.name }));
  }
}
