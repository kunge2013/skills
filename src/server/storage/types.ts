// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08
// [AGC:START] tool=Cc author=fangkun
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

  // 新增可选方法 - 用于测试历史管理等功能
  listItems?(dir: string): Promise<string[]>;
  deleteItem?(key: string): Promise<void>;
}
// [AGC:END]
