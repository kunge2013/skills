import { defineStore } from 'pinia'
import type { TextModelConfig, Template, PromptRecord, LLMProvider, TemplateTestRecord } from '../types/prompt'
import i18n from '../i18n'

interface ApiResponse<T> { success: boolean; data?: T; error?: string }

// API base for prompt optimizer server (proxied through main web server)
const API_BASE = '/api/v1'

// Static provider definitions (these are fixed and don't need server fetch)
const LLM_PROVIDERS: LLMProvider[] = [
  { id: 'openai', name: 'OpenAI', requiresApiKey: true, defaultBaseURL: 'https://api.openai.com/v1', supportsDynamicModels: false, defaultProtocol: 'openai' },
  { id: 'anthropic', name: 'Anthropic', requiresApiKey: true, defaultBaseURL: 'https://api.anthropic.com', supportsDynamicModels: false, apiKeyUrl: 'https://console.anthropic.com/settings/keys', defaultProtocol: 'anthropic' },
  { id: 'gemini', name: 'Google Gemini', requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false, apiKeyUrl: 'https://aistudio.google.com/app/apikey', defaultProtocol: 'openai' },
  { id: 'deepseek', name: 'DeepSeek', requiresApiKey: true, defaultBaseURL: 'https://api.deepseek.com/v1', supportsDynamicModels: false, apiKeyUrl: 'https://platform.deepseek.com/api_keys', defaultProtocol: 'openai' },
  { id: 'custom', name: '�Զ���/MaaS', requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false, defaultProtocol: 'openai' },
]

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.success === false && json.error) throw new Error(json.error.message)
  return json.data !== undefined ? json.data : json
}

async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.success === false && json.error) throw new Error(json.error.message)
  return json.data !== undefined ? json.data : json
}

async function apiPut<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.success === false && json.error) throw new Error(json.error.message)
  return json.data !== undefined ? json.data : json
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.success === false && json.error) throw new Error(json.error.message)
  return json.data !== undefined ? json.data : json
}

interface SSEHandlers {
  onToken: (token: string) => void
  onComplete: (response?: any) => void
  onError: (error: Error) => void
}

async function apiSSE(path: string, body: any, handlers: SSEHandlers): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    handlers.onError(new Error(`HTTP ${response.status}`))
    return
  }
  const reader = response.body?.getReader()
  if (!reader) {
    handlers.onError(new Error('No response body'))
    return
  }
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) { handlers.onError(new Error(data.error)); return }
            if (data.done) { handlers.onComplete({ content: data.fullText }); return }
            if (data.token) handlers.onToken(data.token)
          } catch { /* skip malformed */ }
        }
      }
    }
  } catch (error) {
    handlers.onError(error as Error)
  }
}

export const usePromptStore = defineStore('prompt', {
  state: () => ({
    // Models
    allModels: [] as TextModelConfig[],
    llmProviders: [...LLM_PROVIDERS] as LLMProvider[],
    selectedModelKey: '',

    // Templates
    templates: [] as Template[],
    selectedTemplateId: '',
    customTemplateIds: [] as string[], // IDs of user-created templates (editable/deletable)

    // Tab navigation
    activePromptTab: 'optimize',

    // History
    history: [] as PromptRecord[],

    // Optimize state
    optimizeInput: '',
    optimizeOutput: '',
    optimizeError: '',
    optimizing: false,

    // Iterate state
    iterateOriginal: '',
    iterateLastOptimized: '',
    iterateInput: '',
    iterateOutput: '',
    iterateError: '',
    iterating: false,

    // Test state
    testSystemPrompt: '',
    testUserPrompt: '',
    testOutput: '',
    testError: '',
    testing: false,

    // Settings
    apiToken: '',
    serverStatus: 'checking' as 'online' | 'offline' | 'error',

    // Models management
    showAddModel: false,
    newModel: {
      id: '', name: '', providerId: '', protocol: 'openai' as 'openai' | 'anthropic', modelId: '', apiKey: '', baseURL: '',
    },
    // Edit state
    editingModelId: null as string | null,
    editForm: {
      id: '', name: '', providerId: '', protocol: 'openai' as 'openai' | 'anthropic', modelId: '', apiKey: '', baseURL: '',
    },

    // Template test history
    templateTestHistory: [] as TemplateTestRecord[],
    selectedHistoryTemplateId: '',
  }),
  getters: {
    enabledModels: (state) => state.allModels.filter((m: TextModelConfig) => m.enabled),
    canOptimize: (state) => !!state.selectedModelKey && !!state.optimizeInput && !state.optimizing,
    canIterate: (state) => !!state.selectedModelKey && !!state.iterateOriginal && !!state.iterateLastOptimized && !!state.iterateInput && !state.iterating,
    canTest: (state) => !!state.selectedModelKey && !!state.testUserPrompt && !state.testing,
  },
  actions: {
    // Models
    async loadModels() {
      try {
        this.allModels = await apiGet<TextModelConfig[]>('/models')
        if (this.enabledModels.length > 0 && !this.selectedModelKey) {
          this.selectedModelKey = this.enabledModels[0].id
        }
      } catch (e: any) {
        console.error('Failed to load models:', e)
      }
    },
    async loadProviders() {
      try {
        this.llmProviders = await apiGet<LLMProvider[]>('/llm/providers')
      } catch (e) {
        console.error('Failed to load providers:', e)
      }
    },
    async addModelEntry() {
      try {
        const config: TextModelConfig = {
          id: this.newModel.id,
          name: this.newModel.name,
          enabled: true,
          providerId: this.newModel.providerId,
          protocol: this.newModel.protocol,
          modelId: this.newModel.modelId,
          providerMeta: { id: this.newModel.providerId, name: this.newModel.providerId, requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false },
          modelMeta: { id: this.newModel.modelId, name: this.newModel.name, providerId: this.newModel.providerId, capabilities: { supportsTools: true, maxContextLength: 128000 }, parameterDefinitions: [] },
          connectionConfig: {
            apiKey: this.newModel.apiKey,
            baseURL: this.newModel.baseURL || undefined,
          },
        }
        await apiPost('/models', { key: this.newModel.id, config })
        this.newModel = { id: '', name: '', providerId: '', protocol: 'openai', modelId: '', apiKey: '', baseURL: '' }
        this.showAddModel = false
        await this.loadModels()
      } catch (e: any) {
        alert(e.message)
      }
    },
    async toggleModel(model: TextModelConfig) {
      try {
        await apiPut(`/models/${model.id}`, { enabled: !model.enabled })
        await this.loadModels()
      } catch (e: any) {
        alert(e.message)
      }
    },
    async deleteModel(id: string) {
      try {
        await apiDelete(`/models/${id}`)
        await this.loadModels()
      } catch (e: any) {
        alert(e.message)
      }
    },
    async updateModel(key: string, updates: Partial<TextModelConfig>) {
      try {
        await apiPut(`/models/${key}`, updates)
        await this.loadModels()
      } catch (e: any) {
        alert(e.message)
        throw e
      }
    },
    startEditModel(model: TextModelConfig) {
      this.editingModelId = model.id
      // Derive protocol from config or providerId for legacy configs
      const derivedProtocol = model.protocol || (model.providerId === 'anthropic' ? 'anthropic' : 'openai')
      this.editForm = {
        id: model.id,
        name: model.name,
        providerId: model.providerId || '',
        protocol: derivedProtocol as 'openai' | 'anthropic',
        modelId: model.modelId || '',
        apiKey: '',
        baseURL: model.connectionConfig?.baseURL || '',
      }
      this.showAddModel = false
    },
    cancelEditModel() {
      this.editingModelId = null
      this.editForm = { id: '', name: '', providerId: '', protocol: 'openai', modelId: '', apiKey: '', baseURL: '' }
    },
    async saveEditModel() {
      if (!this.editingModelId) return
      const updates: TextModelConfig = {
        id: this.editForm.id,
        name: this.editForm.name,
        enabled: true,
        providerId: this.editForm.providerId,
        protocol: this.editForm.protocol,
        modelId: this.editForm.modelId,
        providerMeta: { id: this.editForm.providerId, name: this.editForm.providerId, requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false },
        modelMeta: { id: this.editForm.modelId, name: this.editForm.name, providerId: this.editForm.providerId, capabilities: { supportsTools: true, maxContextLength: 128000 }, parameterDefinitions: [] },
        connectionConfig: {
          apiKey: this.editForm.apiKey || undefined,
          baseURL: this.editForm.baseURL || undefined,
        },
      }
      await this.updateModel(this.editingModelId, updates)
      this.cancelEditModel()
    },

    // Templates
    async loadTemplates() {
      try {
        this.templates = await apiGet<Template[]>('/templates')
        // Fetch custom template IDs (those stored on server, not built-in)
        const custom = await apiGet<Template[]>('/templates')
        this.customTemplateIds = custom.map((t: Template) => t.id)
        if (this.templates.length > 0 && !this.selectedTemplateId) {
          const optimizeTemplate = this.templates.find(t => t.type === 'optimize')
          if (optimizeTemplate) this.selectedTemplateId = optimizeTemplate.id
        }
      } catch (e) {
        console.error('Failed to load templates:', e)
      }
    },
    async createTemplate(template: Omit<Template, 'id'> & { id?: string }) {
      try {
        const id = template.id || template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const fullTemplate: Template = { ...template, id } as Template
        await apiPost('/templates', fullTemplate)
        await this.loadTemplates()
      } catch (e: any) {
        alert(e.message)
        throw e
      }
    },
    async updateTemplate(id: string, updates: Partial<Template>) {
      try {
        await apiPut(`/templates/${id}`, updates)
        await this.loadTemplates()
      } catch (e: any) {
        alert(e.message)
        throw e
      }
    },
    async deleteTemplate(id: string) {
      try {
        await apiDelete(`/templates/${id}`)
        await this.loadTemplates()
      } catch (e: any) {
        alert(e.message)
      }
    },
    isCustomTemplate(id: string): boolean {
      return this.customTemplateIds.includes(id)
    },
    selectAndOptimize(template: Template) {
      this.optimizeInput = template.content.system
      this.activePromptTab = 'optimize'
    },

    // History
    async loadHistory() {
      try {
        this.history = await apiGet<PromptRecord[]>('/history')
      } catch (e) {
        console.error('Failed to load history:', e)
      }
    },

    // Server status
    async checkServer() {
      try {
        const res = await fetch('/health')
        if (res.ok) this.serverStatus = 'online'
        else this.serverStatus = 'error'
      } catch {
        this.serverStatus = 'offline'
      }
    },

    // Optimize
    async handleOptimize() {
      this.optimizing = true
      this.optimizeError = ''
      this.optimizeOutput = ''
      try {
        this.optimizeOutput = await apiPost('/prompts/optimize', {
          optimizationMode: 'user',
          targetPrompt: this.optimizeInput,
          modelKey: this.selectedModelKey,
          templateId: this.selectedTemplateId || undefined,
        })
      } catch (e: any) {
        this.optimizeError = e.message
      } finally {
        this.optimizing = false
      }
    },
    async handleOptimizeStream() {
      this.optimizing = true
      this.optimizeError = ''
      this.optimizeOutput = ''
      await apiSSE('/prompts/optimize-stream', {
        optimizationMode: 'user',
        targetPrompt: this.optimizeInput,
        modelKey: this.selectedModelKey,
        templateId: this.selectedTemplateId || undefined,
      }, {
        onToken: (token) => { this.optimizeOutput += token },
        onComplete: () => { this.optimizing = false },
        onError: (error) => { this.optimizeError = error.message; this.optimizing = false },
      })
    },

    // Iterate
    async handleIterate() {
      this.iterating = true
      this.iterateError = ''
      this.iterateOutput = ''
      try {
        this.iterateOutput = await apiPost('/prompts/iterate', {
          originalPrompt: this.iterateOriginal,
          lastOptimizedPrompt: this.iterateLastOptimized,
          iterateInput: this.iterateInput,
          modelKey: this.selectedModelKey,
          templateId: this.selectedTemplateId || undefined,
        })
      } catch (e: any) {
        this.iterateError = e.message
      } finally {
        this.iterating = false
      }
    },
    async handleIterateStream() {
      this.iterating = true
      this.iterateError = ''
      this.iterateOutput = ''
      await apiSSE('/prompts/iterate-stream', {
        originalPrompt: this.iterateOriginal,
        lastOptimizedPrompt: this.iterateLastOptimized,
        iterateInput: this.iterateInput,
        modelKey: this.selectedModelKey,
        templateId: this.selectedTemplateId || undefined,
      }, {
        onToken: (token) => { this.iterateOutput += token },
        onComplete: () => { this.iterating = false },
        onError: (error) => { this.iterateError = error.message; this.iterating = false },
      })
    },

    // Test
    async handleTest() {
      this.testing = true
      this.testError = ''
      this.testOutput = ''
      try {
        this.testOutput = await apiPost('/prompts/test', {
          systemPrompt: this.testSystemPrompt,
          userPrompt: this.testUserPrompt,
          modelKey: this.selectedModelKey,
        })
      } catch (e: any) {
        this.testError = e.message
      } finally {
        this.testing = false
      }
    },
    async handleTestStream() {
      this.testing = true
      this.testError = ''
      this.testOutput = ''
      await apiSSE('/prompts/test-stream', {
        systemPrompt: this.testSystemPrompt,
        userPrompt: this.testUserPrompt,
        modelKey: this.selectedModelKey,
      }, {
        onToken: (token) => { this.testOutput += token },
        onComplete: () => { this.testing = false },
        onError: (error) => { this.testError = error.message; this.testing = false },
      })
    },

    // Settings
    async exportData() {
      try {
        const data = await apiPost('/data/export')
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'prompt-optimizer-export.json'
        a.click()
        URL.revokeObjectURL(url)
      } catch (e: any) {
        alert(e.message)
      }
    },
    async importData(file: File) {
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        await apiPost('/data/import', { data })
        await this.loadAll()
      } catch (e: any) {
        alert(e.message)
      }
    },

    // Load all
    async loadAll() {
      await this.loadModels()
      await this.loadTemplates()
      await this.loadHistory()
      await this.loadProviders()
      await this.checkServer()
    },

    // [AGC:START] tool=Cc author=fangkun
    // Template test history
    async loadTemplateTestHistory(templateId?: string) {
      try {
        const path = templateId
          ? `/template-test-history?templateId=${templateId}`
          : '/template-test-history'
        this.templateTestHistory = await apiGet<TemplateTestRecord[]>(path)
        this.selectedHistoryTemplateId = templateId || ''
      } catch (e: any) {
        console.error('Failed to load template test history:', e)
      }
    },

    async clearTemplateTestHistory(templateId: string) {
      try {
        await apiDelete(`/template-test-history/template/${templateId}`)
        await this.loadTemplateTestHistory(this.selectedHistoryTemplateId)
      } catch (e: any) {
        alert(e.message)
      }
    },
    // [AGC:END]
  },
})
