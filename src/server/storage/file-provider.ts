import fs from 'fs';
import path from 'path';
import { IStorageProvider } from './types';

export class FileStorageProvider implements IStorageProvider {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
  }

  private filePath(key: string): string {
    return path.join(this.dataDir, `${key}.json`);
  }

  async getItem(key: string): Promise<string | null> {
    const file = this.filePath(key);
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf-8');
  }

  async setItem(key: string, value: string): Promise<void> {
    const file = this.filePath(key);
    fs.writeFileSync(file, value, 'utf-8');
  }

  async removeItem(key: string): Promise<void> {
    const file = this.filePath(key);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  async clearAll(): Promise<void> {
    const files = fs.readdirSync(this.dataDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(this.dataDir, file));
      }
    }
  }

  async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
    const raw = await this.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as T) : null;
    const modified = modifier(parsed);
    await this.setItem(key, JSON.stringify(modified, null, 2));
  }

  async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    for (const op of operations) {
      if (op.operation === 'set' && op.value !== undefined) {
        await this.setItem(op.key, op.value);
      } else if (op.operation === 'remove') {
        await this.removeItem(op.key);
      }
    }
  }

  async getAllKeys(): Promise<string[]> {
    const files = fs.readdirSync(this.dataDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  async getAllData(): Promise<Record<string, string>> {
    const keys = await this.getAllKeys();
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = await this.getItem(key);
      if (value !== null) {
        result[key] = value;
      }
    }
    return result;
  }

  async importAll(data: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.setItem(key, value);
    }
  }
}
