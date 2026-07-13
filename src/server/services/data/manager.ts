import { IStorageProvider } from '../../storage/types';

export class DataManager {
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  async exportAll(): Promise<Record<string, any>> {
    const keys = [
      'models', 'templates', 'history', 'favorites',
      'image_models', 'images', '__all_preferences__',
    ];

    const data: Record<string, any> = {};
    for (const key of keys) {
      const raw = await this.storage.getItem(key);
      if (raw) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }

    // Export all preference key-value pairs
    const prefs = await this.storage.getItem('__all_preferences__');
    if (prefs) {
      data.preferences = JSON.parse(prefs);
    }

    return data;
  }

  async importAll(data: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        await this.storage.setItem(key, value);
      } else {
        await this.storage.setItem(key, JSON.stringify(value));
      }
    }
  }
}
