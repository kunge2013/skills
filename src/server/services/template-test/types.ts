// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08

export interface TemplateTestRecord {
  id: string
  templateId: string
  templateName: string

  // 用户输入的变量值
  variables: Record<string, string>

  // 替换后的提示词
  processedSystemPrompt: string
  processedUserPrompt: string

  // 模型信息
  modelKey: string
  modelInfo: {
    id: string
    name: string
    providerId: string
  }

  // 测试结果
  output: string
  timestamp: number
  duration?: number  // 毫秒
}
