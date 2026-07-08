import { IStorageProvider } from '../../storage/types';
import { TextModelConfig } from '../llm/types';

export class ModelManager {
  private storageKey = 'models';
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  async getAllModels(): Promise<TextModelConfig[]> {
    const raw = await this.storage.getItem(this.storageKey);
    if (!raw) return [];
    return JSON.parse(raw);
  }

  async getModel(key: string): Promise<TextModelConfig | undefined> {
    const models = await this.getAllModels();
    return models.find(m => m.id === key);
  }

  async addModel(key: string, config: TextModelConfig): Promise<void> {
    const models = await this.getAllModels();
    const index = models.findIndex(m => m.id === key);
    if (index >= 0) {
      models[index] = config;
    } else {
      models.push(config);
    }
    await this.storage.setItem(this.storageKey, JSON.stringify(models));
  }

  async updateModel(key: string, updates: Partial<TextModelConfig>): Promise<void> {
    const models = await this.getAllModels();
    const index = models.findIndex(m => m.id === key);
    if (index < 0) throw new Error(`Model "${key}" not found`);
    models[index] = { ...models[index], ...updates };
    await this.storage.setItem(this.storageKey, JSON.stringify(models));
  }

  async deleteModel(key: string): Promise<void> {
    const models = await this.getAllModels();
    const filtered = models.filter(m => m.id !== key);
    await this.storage.setItem(this.storageKey, JSON.stringify(filtered));
  }

  async enableModel(key: string): Promise<void> {
    await this.updateModel(key, { enabled: true });
  }

  async disableModel(key: string): Promise<void> {
    await this.updateModel(key, { enabled: false });
  }

  async getEnabledModels(): Promise<TextModelConfig[]> {
    const models = await this.getAllModels();
    return models.filter(m => m.enabled);
  }

  async ensureInitialized(): Promise<void> {
    // Add default models from environment variables
    const defaults = buildDefaultModelsFromEnv();
    if (defaults.length > 0) {
      const existing = await this.getAllModels();
      const existingIds = new Set(existing.map(m => m.id));
      let hasNew = false;
      for (const d of defaults) {
        if (!existingIds.has(d.id)) {
          existing.push(d);
          hasNew = true;
        }
      }
      if (hasNew) {
        await this.storage.setItem(this.storageKey, JSON.stringify(existing));
      }
    }
  }

  async isInitialized(): Promise<boolean> {
    const models = await this.getAllModels();
    return models.length > 0;
  }

  async exportData(): Promise<string> {
    const models = await this.getAllModels();
    return JSON.stringify(models, null, 2);
  }

  async importData(data: string): Promise<void> {
    const models = JSON.parse(data) as TextModelConfig[];
    await this.storage.setItem(this.storageKey, JSON.stringify(models));
  }
}

function buildDefaultModelsFromEnv(): TextModelConfig[] {
  const defaults: TextModelConfig[] = [];

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    defaults.push({
      id: 'openai-gpt4o',
      name: 'GPT-4o',
      enabled: true,
      providerId: 'openai',
      protocol: 'openai',
      modelId: 'gpt-4o',
      providerMeta: { id: 'openai', name: 'OpenAI', requiresApiKey: true, defaultBaseURL: 'https://api.openai.com/v1', supportsDynamicModels: false },
      modelMeta: { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', capabilities: { supportsTools: true, maxContextLength: 128000 }, parameterDefinitions: [] },
      connectionConfig: { apiKey: process.env.OPENAI_API_KEY },
    });
  }

  // Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    defaults.push({
      id: 'anthropic-sonnet',
      name: 'Claude Sonnet 4',
      enabled: true,
      providerId: 'anthropic',
      protocol: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      providerMeta: { id: 'anthropic', name: 'Anthropic', requiresApiKey: true, defaultBaseURL: 'https://api.anthropic.com', supportsDynamicModels: false },
      modelMeta: { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', providerId: 'anthropic', capabilities: { supportsTools: true, maxContextLength: 200000 }, parameterDefinitions: [] },
      connectionConfig: { apiKey: process.env.ANTHROPIC_API_KEY },
    });
  }

  // DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    defaults.push({
      id: 'deepseek-v3',
      name: 'DeepSeek V3',
      enabled: true,
      providerId: 'deepseek',
      protocol: 'openai',
      modelId: 'deepseek-chat',
      providerMeta: { id: 'deepseek', name: 'DeepSeek', requiresApiKey: true, defaultBaseURL: 'https://api.deepseek.com/v1', supportsDynamicModels: false },
      modelMeta: { id: 'deepseek-chat', name: 'DeepSeek V3', providerId: 'deepseek', capabilities: { supportsTools: false, maxContextLength: 64000 }, parameterDefinitions: [] },
      connectionConfig: { apiKey: process.env.DEEPSEEK_API_KEY },
    });
  }

  return defaults;
}
