// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08

import { IStorageProvider } from '../../storage/types'
import { TemplateTestRecord } from './types'
import { v4 as uuidv4 } from 'uuid'

// [AGC:START] tool=Cc author=fangkun
export class TemplateTestHistoryManager {
  private storage: IStorageProvider
  private baseDir: string

  constructor(storage: IStorageProvider, baseDir: string = 'template-tests') {
    this.storage = storage
    this.baseDir = baseDir
  }

  // 获取测试历史
  async getRecords(templateId?: string): Promise<TemplateTestRecord[]> {
    if (templateId) {
      // 单个模板的历史
      const key = `${this.baseDir}/${templateId}`
      const raw = await this.storage.getItem(key)
      return raw ? JSON.parse(raw) : []
    } else {
      // 所有模板的历史(合并)
      const allRecords: TemplateTestRecord[] = []

      // 尝试列出所有文件(简化实现,基于已知模板ID)
      // 实际实现需要扩展 IStorageProvider.listItems
      // 这里暂时返回空数组,后续通过其他方式获取
      return allRecords.sort((a, b) => b.timestamp - a.timestamp)
    }
  }

  // 添加测试记录
  async addRecord(record: TemplateTestRecord): Promise<void> {
    const key = `${this.baseDir}/${record.templateId}`
    const raw = await this.storage.getItem(key)
    const records: TemplateTestRecord[] = raw ? JSON.parse(raw) : []

    records.unshift(record)

    // 限制每个模板最多保留100条记录
    if (records.length > 100) {
      records.length = 100
    }

    await this.storage.setItem(key, JSON.stringify(records))
  }

  // 删除记录
  async deleteRecord(recordId: string): Promise<void> {
    // 简化实现: 需要扫描所有模板文件
    // 实际项目应该建立索引或使用数据库
    throw new Error('Not implemented - requires scanning all template files')
  }

  // 清空模板历史
  async clearHistory(templateId: string): Promise<void> {
    const key = `${this.baseDir}/${templateId}`
    await this.storage.setItem(key, '[]')
  }
}
// [AGC:END]
