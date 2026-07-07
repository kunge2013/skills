import { IStorageProvider } from '../../storage/types';

export class PreferenceService {
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  async getPreference(key: string): Promise<any> {
    const raw = await this.storage.getItem(`pref:${key}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setPreference(key: string, value: any): Promise<void> {
    await this.storage.setItem(`pref:${key}`, JSON.stringify(value));
  }

  async deletePreference(key: string): Promise<void> {
    await this.storage.removeItem(`pref:${key}`);
  }

  async getAllPreferences(): Promise<Record<string, any>> {
    // Since FileStorageProvider stores each key as a separate file,
    // we need to track preference keys. For simplicity, store all prefs in one file.
    const raw = await this.storage.getItem('__all_preferences__');
    return raw ? JSON.parse(raw) : {};
  }

  async batchUpdate(prefs: Record<string, any>): Promise<void> {
    const all = await this.getAllPreferences();
    for (const [key, value] of Object.entries(prefs)) {
      all[key] = value;
    }
    await this.storage.setItem('__all_preferences__', JSON.stringify(all));
  }
}
