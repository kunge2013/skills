import { IStorageProvider } from '../../storage/types';

export interface ImageGenerationRequest {
  prompt: string;
  modelKey: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  count?: number;
  seed?: number;
  steps?: number;
  cfgScale?: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  modelKey: string;
  seed?: number;
  width: number;
  height: number;
  createdAt: number;
}

export class ImageService {
  private storageKey = 'images';
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  async getGeneratedImages(): Promise<GeneratedImage[]> {
    const raw = await this.storage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }

  async saveImage(image: GeneratedImage): Promise<void> {
    const images = await this.getGeneratedImages();
    images.unshift(image);
    // Keep last 500
    if (images.length > 500) images.length = 500;
    await this.storage.setItem(this.storageKey, JSON.stringify(images));
  }

  async deleteImage(id: string): Promise<void> {
    const images = await this.getGeneratedImages();
    const filtered = images.filter(img => img.id !== id);
    await this.storage.setItem(this.storageKey, JSON.stringify(filtered));
  }
}

// Image model manager
export interface ImageModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerId: string;
  modelId: string;
  connectionConfig: {
    apiKey?: string;
    baseURL?: string;
    [key: string]: any;
  };
}

export class ImageModelManager {
  private storageKey = 'image_models';
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  async getAllModels(): Promise<ImageModelConfig[]> {
    const raw = await this.storage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }

  async addModel(config: ImageModelConfig): Promise<void> {
    const models = await this.getAllModels();
    models.push(config);
    await this.storage.setItem(this.storageKey, JSON.stringify(models));
  }

  async updateModel(id: string, updates: Partial<ImageModelConfig>): Promise<void> {
    const models = await this.getAllModels();
    const index = models.findIndex(m => m.id === id);
    if (index < 0) throw new Error(`Image model "${id}" not found`);
    models[index] = { ...models[index], ...updates };
    await this.storage.setItem(this.storageKey, JSON.stringify(models));
  }

  async deleteModel(id: string): Promise<void> {
    const models = await this.getAllModels();
    const filtered = models.filter(m => m.id !== id);
    await this.storage.setItem(this.storageKey, JSON.stringify(filtered));
  }

  async getEnabledModels(): Promise<ImageModelConfig[]> {
    const models = await this.getAllModels();
    return models.filter(m => m.enabled);
  }
}
