export interface TextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerId?: string;
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

export interface Template {
  id: string;
  name: string;
  description?: string;
  type: string;
  templateType: 'simple' | 'advanced';
  content: { system: string; user?: string };
  category?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  corsRestricted?: boolean;
  requiresApiKey?: boolean;
  defaultBaseURL?: string;
  supportsDynamicModels?: boolean;
  apiKeyUrl?: string;
}
