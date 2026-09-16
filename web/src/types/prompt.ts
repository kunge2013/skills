export interface TextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerId?: string;
  protocol?: 'openai' | 'anthropic' | 'nano-banana';
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

  // ϵͳ�����б�,����ʱ�Զ���������
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
  defaultProtocol?: 'openai' | 'anthropic' | 'nano-banana';
}

// [AGC:START] tool=Cc author=fangkun
export interface TemplateTestRecord {
  id: string;
  templateId: string;
  templateName: string;

  // �û�����ı���ֵ
  variables: Record<string, string>;

  // �滻�����ʾ��
  processedSystemPrompt: string;
  processedUserPrompt: string;

  // ģ����Ϣ
  modelKey: string;
  modelInfo: {
    id: string;
    name: string;
    providerId: string;
  };

  // ���Խ��
  output: string;
  timestamp: number;
  duration?: number;  // ����
}
// [AGC:END]
