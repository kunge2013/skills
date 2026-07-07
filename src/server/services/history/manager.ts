import { IStorageProvider } from '../../storage/types';

export interface PromptRecord {
  id: string;
  originalContent: string;
  optimizedContent: string;
  templateId: string;
  modelKey: string;
  optimizationMode: 'system' | 'user';
  createdAt: number;
  iterationCount: number;
  parentIds: string[];
  systemPrompt?: string;
}

export class HistoryManager {
  private storageKey = 'history';
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  async getRecords(): Promise<PromptRecord[]> {
    const raw = await this.storage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }

  async getRecord(id: string): Promise<PromptRecord | undefined> {
    const records = await this.getRecords();
    return records.find(r => r.id === id);
  }

  async addRecord(record: PromptRecord): Promise<void> {
    const records = await this.getRecords();
    records.unshift(record);
    // Keep last 1000 records to avoid file bloat
    if (records.length > 1000) {
      records.length = 1000;
    }
    await this.storage.setItem(this.storageKey, JSON.stringify(records));
  }

  async updateRecord(id: string, updates: Partial<PromptRecord>): Promise<void> {
    const records = await this.getRecords();
    const index = records.findIndex(r => r.id === id);
    if (index < 0) throw new Error(`History record "${id}" not found`);
    records[index] = { ...records[index], ...updates };
    await this.storage.setItem(this.storageKey, JSON.stringify(records));
  }

  async deleteRecord(id: string): Promise<void> {
    const records = await this.getRecords();
    const filtered = records.filter(r => r.id !== id);
    await this.storage.setItem(this.storageKey, JSON.stringify(filtered));
  }

  async clearHistory(): Promise<void> {
    await this.storage.setItem(this.storageKey, '[]');
  }

  async getIterationChain(recordId: string): Promise<PromptRecord[]> {
    const records = await this.getRecords();
    const chain: PromptRecord[] = [];
    const target = records.find(r => r.id === recordId);
    if (!target) return chain;

    chain.push(target);
    let current = target;
    while (current.parentIds.length > 0) {
      const parent = records.find(r => r.id === current.parentIds[current.parentIds.length - 1]);
      if (!parent) break;
      chain.push(parent);
      current = parent;
    }
    return chain.reverse();
  }

  async exportData(): Promise<string> {
    const records = await this.getRecords();
    return JSON.stringify(records, null, 2);
  }

  async importData(data: string): Promise<void> {
    const records = JSON.parse(data) as PromptRecord[];
    const existing = await this.getRecords();
    const merged = [...records, ...existing];
    // Deduplicate by id
    const seen = new Set<string>();
    const deduped = merged.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    await this.storage.setItem(this.storageKey, JSON.stringify(deduped));
  }
}
