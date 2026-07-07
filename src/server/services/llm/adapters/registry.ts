import { ITextAdapterRegistry, ITextProviderAdapter, TextProvider, TextModel, TextModelConfig } from '../types';

export class TextAdapterRegistry implements ITextAdapterRegistry {
  private adapters = new Map<string, ITextProviderAdapter>();
  private modelCache = new Map<string, TextModel[]>();

  register(adapter: ITextProviderAdapter): void {
    const provider = adapter.getProvider();
    this.adapters.set(provider.id, adapter);
    // Cache static models
    this.modelCache.set(provider.id, adapter.getModels());
  }

  getAdapter(providerId: string): ITextProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Unknown LLM provider: "${providerId}". Available: ${Array.from(this.adapters.keys()).join(', ')}`);
    }
    return adapter;
  }

  getAllProviders(): TextProvider[] {
    return Array.from(this.adapters.values()).map(a => a.getProvider());
  }

  getStaticModels(providerId: string): TextModel[] {
    return this.modelCache.get(providerId) || [];
  }

  async getDynamicModels(providerId: string, config: TextModelConfig): Promise<TextModel[]> {
    const adapter = this.getAdapter(providerId);
    if (!adapter.getModelsAsync) {
      throw new Error(`Provider "${providerId}" does not support dynamic model fetching`);
    }
    const models = await adapter.getModelsAsync(config);
    this.modelCache.set(providerId, models);
    return models;
  }

  async getModels(providerId: string, config?: TextModelConfig): Promise<TextModel[]> {
    const adapter = this.getAdapter(providerId);

    if (config && adapter.getModelsAsync) {
      try {
        return await this.getDynamicModels(providerId, config);
      } catch {
        // Fallback to static
        return this.getStaticModels(providerId);
      }
    }

    return this.getStaticModels(providerId);
  }

  supportsDynamicModels(providerId: string): boolean {
    const adapter = this.adapters.get(providerId);
    return !!adapter?.getModelsAsync;
  }

  validateProviderModel(providerId: string, modelId: string): boolean {
    const models = this.getStaticModels(providerId);
    if (models.length === 0) return true; // Unknown provider, allow
    return models.some(m => m.id === modelId);
  }
}
