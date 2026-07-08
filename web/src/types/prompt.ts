export interface TextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerId?: string;
  protocol?: 'openai' | 'anthropic';
  modelId?: string;
  providerMeta: any;
  modelMeta: any;
  connectionConfig: Record<string, any>;
  paramOverrides?: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

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
}

// [AGC:START] tool=Cc author=fangkun
export interface Template {
  id: string;
  name: string;
  description?: string;
  type: string;
  templateType: 'simple' | 'advanced';
  content: { system: string; user?: string };
  category?: string;

  // 系统变量列表,测试时自动填充或隐藏
  systemVariables?: string[];
}
// [AGC:END]

export interface LLMProvider {
  id: string;
  name: string;
  corsRestricted?: boolean;
  requiresApiKey?: boolean;
  defaultBaseURL?: string;
  supportsDynamicModels?: boolean;
  apiKeyUrl?: string;
  defaultProtocol?: 'openai' | 'anthropic';
}

// [AGC:START] tool=Cc author=fangkun
export interface TemplateTestRecord {
  id: string;
  templateId: string;
  templateName: string;

  // 用户输入的变量值
  variables: Record<string, string>;

  // 替换后的提示词
  processedSystemPrompt: string;
  processedUserPrompt: string;

  // 模型信息
  modelKey: string;
  modelInfo: {
    id: string;
    name: string;
    providerId: string;
  };

  // 测试结果
  output: string;
  timestamp: number;
  duration?: number;  // 毫秒
}
// [AGC:END]
