import { IStorageProvider } from '../../storage/types';

export interface ContextRecord {
  id: string;
  name: string;
  variables: Record<string, string>;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export class ContextManager {
  private storageKey = 'contexts';
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  async getAllContexts(): Promise<ContextRecord[]> {
    const raw = await this.storage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }

  async getContext(id: string): Promise<ContextRecord | undefined> {
    const contexts = await this.getAllContexts();
    return contexts.find(c => c.id === id);
  }

  async createContext(context: ContextRecord): Promise<void> {
    const contexts = await this.getAllContexts();
    contexts.unshift(context);
    await this.storage.setItem(this.storageKey, JSON.stringify(contexts));
  }

  async updateContext(id: string, updates: Partial<ContextRecord>): Promise<void> {
    const contexts = await this.getAllContexts();
    const index = contexts.findIndex(c => c.id === id);
    if (index < 0) throw new Error(`Context "${id}" not found`);
    contexts[index] = { ...contexts[index], ...updates, updatedAt: Date.now() };
    await this.storage.setItem(this.storageKey, JSON.stringify(contexts));
  }

  async deleteContext(id: string): Promise<void> {
    const contexts = await this.getAllContexts();
    const filtered = contexts.filter(c => c.id !== id);
    await this.storage.setItem(this.storageKey, JSON.stringify(filtered));
  }
}
