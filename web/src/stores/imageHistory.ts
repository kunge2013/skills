// [AGC:FILE] tool=Cc author=fangkun date=2026-09-16
import { defineStore } from 'pinia'

const API_BASE = '/api/v1'

export interface GeneratedImage {
  id: string
  url: string
  prompt: string
  modelKey: string
  width: number
  height: number
  createdAt: number
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

export const useImageHistoryStore = defineStore('imageHistory', {
  state: () => ({
    items: [] as GeneratedImage[],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
  }),
  actions: {
    setPage(p: number) {
      this.page = p
    },
    async fetchList() {
      this.loading = true
      try {
        const params = new URLSearchParams()
        params.set('page', String(this.page))
        params.set('pageSize', String(this.pageSize))
        const data = await apiGet<{ items: GeneratedImage[]; total: number }>(`/images?${params.toString()}`)
        this.items = data.items
        this.total = data.total
      } finally {
        this.loading = false
      }
    },
    async deleteImage(id: string) {
      await apiDelete(`/images/${id}`)
      this.items = this.items.filter(img => img.id !== id)
      this.total = Math.max(0, this.total - 1)
    },
  },
})
// [AGC:END]
