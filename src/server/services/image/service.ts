import { IStorageProvider } from '../../storage/types';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// [AGC:START] tool=Cc author=fangkun
/**
 * Save a base64 image (with or without data URI prefix) or a remote URL to local disk.
 * Returns the relative URL path (e.g. "/images/abc123.png") that can be served statically.
 */
export async function saveImageToDisk(
  dataDir: string,
  imageData: string,
  prompt: string,
): Promise<string> {
  const imagesDir = path.join(dataDir, 'generated-images');
  fs.mkdirSync(imagesDir, { recursive: true });

  const id = uuidv4().replace(/-/g, '').slice(0, 12);
  const safePrompt = prompt.slice(0, 40).replace(/[^a-zA-Z0-9一-龥_-]/g, '_');
  const filename = `${id}_${safePrompt}.png`;
  const filePath = path.join(imagesDir, filename);

  if (imageData.startsWith('data:')) {
    // data URI — extract base64 portion
    const base64Data = imageData.split(',')[1];
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    // Remote URL — download and save
    const response = await fetch(imageData);
    if (!response.ok) throw new Error(`Failed to download image: HTTP ${response.status}`);
    const buf = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buf);
  } else {
    // Assume raw base64
    fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));
  }

  return `/images/generated/${filename}`;
}

/**
 * Detect whether a string is image data (base64 or data URI) vs a plain URL/relative path.
 */
export function isImageData(s: string): boolean {
  return s.startsWith('data:image/') || /^[A-Za-z0-9+/=]{100,}$/.test(s);
}
// [AGC:END]

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
  readonly dataDir: string;

  constructor(storage: IStorageProvider, dataDir: string) {
    this.storage = storage;
    this.dataDir = dataDir;
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

  // [AGC:START] tool=Cc author=fangkun
  /**
   * Save an image (base64/URL) to local disk, persist record, return GeneratedImage.
   */
  async saveImageFromResponse(
    imageData: string,
    prompt: string,
    modelKey: string,
    width?: number,
    height?: number,
  ): Promise<GeneratedImage> {
    const localUrl = await saveImageToDisk(this.dataDir, imageData, prompt);
    const image: GeneratedImage = {
      id: uuidv4(),
      url: localUrl,
      prompt,
      modelKey,
      width: width || 1024,
      height: height || 1024,
      createdAt: Date.now(),
    };
    await this.saveImage(image);
    return image;
  }
  // [AGC:END]

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
