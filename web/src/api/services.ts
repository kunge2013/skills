import { ApiClient, SSEHandlers } from './api-client';

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

export function createModelManager(client: ApiClient) {
  return {
    getAllModels: () => client.get<TextModelConfig[]>('/models'),
    getEnabledModels: () => client.get<TextModelConfig[]>('/models/enabled'),
    addModel: (key: string, config: TextModelConfig) => client.post('/models', { key, config }),
    updateModel: (key: string, config: Partial<TextModelConfig>) => client.put(`/models/${key}`, config),
    deleteModel: (key: string) => client.delete(`/models/${key}`),
    ensureInitialized: () => client.post('/models/ensure-init'),
  };
}

export function createLLMService(client: ApiClient) {
  return {
    sendMessage: (messages: Message[], provider: string) =>
      client.post<{ content: string }>('/llm/send', { messages, provider }).then(r => r.content),

    sendMessageStream: (messages: Message[], provider: string, callbacks: SSEHandlers) =>
      client.sse('/llm/send-stream', { messages, provider }, callbacks),

    testConnection: (provider: string) =>
      client.post('/llm/test-connection', { modelKey: provider }),

    getProviders: () => client.get('/llm/providers'),
  };
}

export function createPromptService(client: ApiClient) {
  return {
    optimizePrompt: (req: any) => client.post('/prompts/optimize', req),
    optimizePromptStream: (req: any, callbacks: SSEHandlers) =>
      client.sse('/prompts/optimize-stream', req, callbacks),

    iteratePrompt: (req: any) => client.post('/prompts/iterate', req),
    iteratePromptStream: (req: any, callbacks: SSEHandlers) =>
      client.sse('/prompts/iterate-stream', req, callbacks),

    testPrompt: (systemPrompt: string, userPrompt: string, modelKey: string) =>
      client.post('/prompts/test', { systemPrompt, userPrompt, modelKey }),

    testPromptStream: (systemPrompt: string, userPrompt: string, modelKey: string, callbacks: SSEHandlers) =>
      client.sse('/prompts/test-stream', { systemPrompt, userPrompt, modelKey }, callbacks),

    getHistory: () => client.get<PromptRecord[]>('/history'),
    getIterationChain: (recordId: string) => client.get<PromptRecord[]>(`/history/chain/${recordId}`),
  };
}

export function createTemplateService(client: ApiClient) {
  return {
    getAllTemplates: () => client.get<Template[]>('/templates'),
    getTemplatesByType: (type: string) => client.get<Template[]>(`/templates/by-type/${type}`),
  };
}

export function createFavoriteService(client: ApiClient) {
  return {
    getFavorites: () => client.get('/favorites'),
    addFavorite: (fav: any) => client.post('/favorites', fav),
    deleteFavorite: (id: string) => client.delete(`/favorites/${id}`),
    getCategories: () => client.get('/favorites/categories'),
    searchFavorites: (query: string) => client.post('/favorites/search', { query }),
  };
}

export function createPreferenceService(client: ApiClient) {
  return {
    getPreference: (key: string) => client.get(`/preferences/${key}`),
    setPreference: (key: string, value: any) => client.put(`/preferences/${key}`, { value }),
    getAllPreferences: () => client.get('/preferences'),
    batchUpdate: (prefs: Record<string, any>) => client.put('/preferences', prefs),
  };
}
