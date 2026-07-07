export interface IStorageProvider {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clearAll(): Promise<void>;

  updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void>;
  batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void>;
}
