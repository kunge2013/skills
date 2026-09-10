// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// web/src/stores/llmCallLogs.ts
import { defineStore } from 'pinia'

const API_BASE = '/api/v1'

export type LLMCallSource = 'apiTester' | 'prompt' | 'stream' | 'test-connection'

export interface LLMCallLogRecord {
  id: string
  timestamp: number
  durationMs: number
  source: LLMCallSource
  modelKey: string
  protocol: string
  modelParams: Record<string, unknown>
  request: Record<string, unknown>
  response: Record<string, unknown> | null
  status: number
  error: string | null
}

export interface LLMCallLogFilter {
  from?: number
  to?: number
  modelKey?: string
  source?: LLMCallSource
  status?: number
}

// [AGC:START] tool=Cc author=fangkun
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
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

export const useLLMCallLogsStore = defineStore('llmCallLogs', {
  state: () => ({
    items: [] as LLMCallLogRecord[],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    filters: {} as LLMCallLogFilter,
  }),
  actions: {
    setFilters(partial: Partial<LLMCallLogFilter>) {
      this.filters = { ...this.filters, ...partial }
      this.page = 1
    },
    setPage(p: number) {
      this.page = p
    },
    async fetchList() {
      this.loading = true
      try {
        const params = new URLSearchParams()
        params.set('page', String(this.page))
        params.set('pageSize', String(this.pageSize))
        if (this.filters.from !== undefined) params.set('from', String(this.filters.from))
        if (this.filters.to !== undefined) params.set('to', String(this.filters.to))
        if (this.filters.modelKey) params.set('modelKey', this.filters.modelKey)
        if (this.filters.source) params.set('source', this.filters.source)
        if (this.filters.status !== undefined) params.set('status', String(this.filters.status))
        const data = await apiGet<{ items: LLMCallLogRecord[]; total: number }>(`/llm-call-logs?${params.toString()}`)
        this.items = data.items
        this.total = data.total
      } finally {
        this.loading = false
      }
    },
    async clearRange(from: number, to: number): Promise<{ deleted: number }> {
      return apiDelete<{ deleted: number }>(`/llm-call-logs?from=${from}&to=${to}`)
    },
  },
})
// [AGC:END]
