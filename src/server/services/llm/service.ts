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

export interface IModelManager {
  getModel(key: string): Promise<TextModelConfig | undefined>;
  getAllModels(): Promise<TextModelConfig[]>;
  getEnabledModels(): Promise<TextModelConfig[]>;
}

// [AGC:START] tool=Cc author=fangkun
function resolveProtocol(config: TextModelConfig): string {
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
  ) {}

  private async getModelConfig(provider: string): Promise<TextModelConfig> {
    const model = await this.modelManager.getModel(provider);
    if (!model) {
      throw new Error(`Model config not found for provider: "${provider}"`);
    }
    return model;
  }

  async sendMessage(messages: Message[], provider: string): Promise<string> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    const response = await adapter.sendMessage(messages, config);
    return response.content;
  }

  async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    return adapter.sendMessage(messages, config);
  }

  async sendMessageStream(messages: Message[], provider: string, callbacks: StreamHandlers): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    await adapter.sendMessageStream(messages, config, callbacks);
  }

  async sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    await adapter.sendMessageStreamWithTools(messages, config, tools, callbacks);
  }

  async testConnection(provider: string): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);

    await adapter.sendMessage(
      [{ role: 'user', content: 'Hello, this is a connection test.' }],
      config
    );
  }

  async fetchModelList(provider: string, customConfig?: Partial<TextModelConfig>): Promise<ModelOption[]> {
    const adapter = this.registry.getAdapter(provider);
    const models = await this.registry.getModels(
      provider,
      customConfig as TextModelConfig | undefined
    );
    return models.map(m => ({ value: m.id, label: m.name }));
  }
}

export interface IModelManager {
  getModel(key: string): Promise<TextModelConfig | undefined>;
  getAllModels(): Promise<TextModelConfig[]>;
  getEnabledModels(): Promise<TextModelConfig[]>;
}
