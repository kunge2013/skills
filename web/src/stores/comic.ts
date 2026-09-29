// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// web/src/stores/comic.ts

import { defineStore } from 'pinia'
import type { Novel, ComicTemplate, ComicCallLog, ComicCallLogFilter, ComicCategory, Paginated } from '../types/comic'
import i18n from '../i18n'

const API_BASE = '/api/v1'

// [AGC:START] tool=Cc author=fangkun
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.success === false && json.error) throw new Error(json.error.message)
  return json.data !== undefined ? json.data : json
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
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

async function apiPut<T>(path: string, body?: unknown): Promise<T> {
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

export const useComicStore = defineStore('comic', {
  state: () => ({
    // Novels
    novels: [] as Novel[],
    novelsTotal: 0,
    novelsPage: 1,
    selectedNovelId: '',

    // Templates
    templates: [] as ComicTemplate[],

    // Call logs
    callLogs: [] as ComicCallLog[],
    callLogsTotal: 0,
    callLogsPage: 1,
    callLogsFilter: {} as ComicCallLogFilter,

    // UI state
    loading: false,
    error: '',
    activeTab: 'novels' as 'novels' | 'templates' | 'pipeline' | 'logs',

    // Pipeline execution state
    executingTemplateId: '',
    executing: false,
    executeOutput: '',
    executeError: '',
  }),
  getters: {
    selectedNovel: (state): Novel | null => {
      return state.novels.find(n => n.id === state.selectedNovelId) || null
    },
    templatesByCategory: (state) => (category: ComicCategory): ComicTemplate[] => {
      return state.templates.filter(t => t.category === category)
    },
  },
  actions: {
    // ============ Novels ============
    async loadNovels(page = 1) {
      this.loading = true
      try {
        const result = await apiGet<Paginated<Novel>>(`/comic/novels?page=${page}&pageSize=20`)
        this.novels = result.items
        this.novelsTotal = result.total
        this.novelsPage = page
      } catch (e: any) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },

    async createNovel(data: { name: string; original_text?: string; content?: string }) {
      try {
        const novel = await apiPost<Novel>('/comic/novels', data)
        await this.loadNovels()
        return novel
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async updateNovel(id: string, data: Partial<Novel>) {
      try {
        const novel = await apiPut<Novel>(`/comic/novels/${id}`, data)
        await this.loadNovels(this.novelsPage)
        return novel
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async deleteNovel(id: string) {
      try {
        await apiDelete(`/comic/novels/${id}`)
        await this.loadNovels(this.novelsPage)
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    // ============ Templates ============
    async loadTemplates() {
      try {
        const templates = await apiGet<ComicTemplate[]>('/comic/templates')
        this.templates = templates
      } catch (e: any) {
        this.error = e.message
      }
    },

    async createTemplate(data: Omit<ComicTemplate, 'id' | 'created_at' | 'updated_at'>) {
      try {
        const template = await apiPost<ComicTemplate>('/comic/templates', data)
        await this.loadTemplates()
        return template
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async updateTemplate(id: string, data: Partial<ComicTemplate>) {
      try {
        const template = await apiPut<ComicTemplate>(`/comic/templates/${id}`, data)
        await this.loadTemplates()
        return template
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async deleteTemplate(id: string) {
      try {
        await apiDelete(`/comic/templates/${id}`)
        await this.loadTemplates()
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    // ============ Call Logs ============
    async loadCallLogs(page = 1) {
      this.loading = true
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', '20')
        if (this.callLogsFilter.novel_id) params.set('novel_id', this.callLogsFilter.novel_id)
        if (this.callLogsFilter.stage) params.set('stage', this.callLogsFilter.stage)
        if (this.callLogsFilter.status !== undefined) params.set('status', String(this.callLogsFilter.status))

        const result = await apiGet<Paginated<ComicCallLog>>(`/comic/call-logs?${params.toString()}`)
        this.callLogs = result.items
        this.callLogsTotal = result.total
        this.callLogsPage = page
      } catch (e: any) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },

    async createCallLog(data: Omit<ComicCallLog, 'id' | 'created_at'>) {
      try {
        const log = await apiPost<ComicCallLog>('/comic/call-logs', data)
        return log
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async deleteCallLogs(filter?: ComicCallLogFilter) {
      try {
        const params = new URLSearchParams()
        if (filter?.novel_id) params.set('novel_id', filter.novel_id)
        await apiDelete(`/comic/call-logs?${params.toString()}`)
        await this.loadCallLogs(this.callLogsPage)
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    setCallLogsFilter(filter: Partial<ComicCallLogFilter>) {
      this.callLogsFilter = { ...this.callLogsFilter, ...filter }
      this.loadCallLogs(1)
    },

    // ============ Pipeline ============
    setActiveTab(tab: 'novels' | 'templates' | 'pipeline' | 'logs') {
      this.activeTab = tab
    },

    setSelectedNovel(id: string) {
      this.selectedNovelId = id
    },

    // ============ Load All ============
    async loadAll() {
      await Promise.all([
        this.loadNovels(),
        this.loadTemplates(),
        this.loadCallLogs(),
      ])
    },
  },
})
// [AGC:END]
