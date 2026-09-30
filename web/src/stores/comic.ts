// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// web/src/stores/comic.ts

import { defineStore } from 'pinia'
import type {
  Novel, NovelContent, NovelCharacter, NovelCharacterTag,
  NovelScript, NovelScriptDialogue, NovelStoryboard,
  ComicTemplate, ComicCallLog, ComicCallLogFilter, ComicCategory, Paginated, PipelineRun, PipelineStepLog
} from '../types/comic'
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

    // Novel sub-resources (cached by novel_id)
    novelContent: {} as Record<string, NovelContent>,
    novelCharacters: {} as Record<string, NovelCharacter[]>,
    novelScripts: {} as Record<string, NovelScript[]>,
    novelStoryboards: {} as Record<string, NovelStoryboard[]>,

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

    // Pipeline run tracking
    latestRun: null as PipelineRun | null,
    pipelineRuns: [] as PipelineRun[],
    allPipelineRuns: [] as PipelineRun[],
    latestRunsByNovel: {} as Record<string, PipelineRun | null>,
    pendingRestoreRun: null as PipelineRun | null,

    // Pipeline step logs (per-step input/output)
    stepLogs: [] as PipelineStepLog[],
  }),
  getters: {
    selectedNovel: (state): Novel | null => {
      return state.novels.find(n => n.id === state.selectedNovelId) || null
    },
    templatesByCategory: (state) => (category: ComicCategory): ComicTemplate[] => {
      return state.templates.filter(t => t.category === category)
    },
    novelHasIncompleteRun: (state) => (novelId: string): boolean => {
      const run = state.latestRunsByNovel[novelId]
      if (!run) return false
      return run.completed_steps.length < state.templates.length || run.current_step !== null
    },
    novelLatestRun: (state) => (novelId: string): PipelineRun | null => {
      return state.latestRunsByNovel[novelId] || null
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
        // Clean up cached sub-resources
        delete this.novelContent[id]
        delete this.novelCharacters[id]
        delete this.novelScripts[id]
        delete this.novelStoryboards[id]
        await this.loadNovels(this.novelsPage)
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    // ============ Novel Content ============
    async loadNovelContent(novelId: string) {
      try {
        const content = await apiGet<NovelContent>(`/comic/novels/${novelId}/content`)
        this.novelContent[novelId] = content
      } catch (e: any) {
        this.error = e.message
      }
    },

    async updateNovelContent(novelId: string, data: Partial<NovelContent>) {
      try {
        const content = await apiPut<NovelContent>(`/comic/novels/${novelId}/content`, data)
        this.novelContent[novelId] = content
        return content
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    // ============ Novel Characters ============
    async loadNovelCharacters(novelId: string) {
      try {
        const characters = await apiGet<NovelCharacter[]>(`/comic/novels/${novelId}/characters`)
        this.novelCharacters[novelId] = characters
      } catch (e: any) {
        this.error = e.message
      }
    },

    async createNovelCharacter(novelId: string, data: Omit<NovelCharacter, 'id' | 'novel_id' | 'created_at' | 'updated_at'>) {
      try {
        const character = await apiPost<NovelCharacter>(`/comic/novels/${novelId}/characters`, data)
        await this.loadNovelCharacters(novelId)
        return character
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async updateNovelCharacter(novelId: string, charId: string, data: Partial<NovelCharacter>) {
      try {
        const character = await apiPut<NovelCharacter>(`/comic/novels/${novelId}/characters/${charId}`, data)
        await this.loadNovelCharacters(novelId)
        return character
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async deleteNovelCharacter(novelId: string, charId: string) {
      try {
        await apiDelete(`/comic/novels/${novelId}/characters/${charId}`)
        await this.loadNovelCharacters(novelId)
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async createNovelCharacterTag(novelId: string, charId: string, data: Omit<NovelCharacterTag, 'id' | 'character_id'>) {
      try {
        const tag = await apiPost<NovelCharacterTag>(`/comic/novels/${novelId}/characters/${charId}/tags`, data)
        return tag
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    // ============ Novel Scripts ============
    async loadNovelScripts(novelId: string) {
      try {
        const scripts = await apiGet<NovelScript[]>(`/comic/novels/${novelId}/scripts`)
        this.novelScripts[novelId] = scripts
      } catch (e: any) {
        this.error = e.message
      }
    },

    async createNovelScript(novelId: string, data: Omit<NovelScript, 'id' | 'novel_id' | 'created_at' | 'updated_at'>) {
      try {
        const script = await apiPost<NovelScript>(`/comic/novels/${novelId}/scripts`, data)
        await this.loadNovelScripts(novelId)
        return script
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async updateNovelScript(novelId: string, scriptId: string, data: Partial<NovelScript>) {
      try {
        const script = await apiPut<NovelScript>(`/comic/novels/${novelId}/scripts/${scriptId}`, data)
        await this.loadNovelScripts(novelId)
        return script
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async deleteNovelScript(novelId: string, scriptId: string) {
      try {
        await apiDelete(`/comic/novels/${novelId}/scripts/${scriptId}`)
        await this.loadNovelScripts(novelId)
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    // ============ Novel Script Dialogues ============
    async loadScriptDialogues(scriptId: string) {
      try {
        const dialogues = await apiGet<NovelScriptDialogue[]>(`/comic/scripts/${scriptId}/dialogues`)
        return dialogues
      } catch (e: any) {
        this.error = e.message
        return []
      }
    },

    async createNovelScriptDialogue(scriptId: string, data: Omit<NovelScriptDialogue, 'id' | 'script_id' | 'created_at' | 'updated_at'>) {
      try {
        const dialogue = await apiPost<NovelScriptDialogue>(`/comic/scripts/${scriptId}/dialogues`, data)
        return dialogue
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    // ============ Novel Storyboards ============
    async loadNovelStoryboards(novelId: string) {
      try {
        const storyboards = await apiGet<NovelStoryboard[]>(`/comic/novels/${novelId}/storyboards`)
        this.novelStoryboards[novelId] = storyboards
      } catch (e: any) {
        this.error = e.message
      }
    },

    async createNovelStoryboard(novelId: string, data: Omit<NovelStoryboard, 'id' | 'novel_id' | 'created_at' | 'updated_at'>) {
      try {
        const storyboard = await apiPost<NovelStoryboard>(`/comic/novels/${novelId}/storyboards`, data)
        await this.loadNovelStoryboards(novelId)
        return storyboard
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async updateNovelStoryboard(novelId: string, sbId: string, data: Partial<NovelStoryboard>) {
      try {
        const storyboard = await apiPut<NovelStoryboard>(`/comic/novels/${novelId}/storyboards/${sbId}`, data)
        await this.loadNovelStoryboards(novelId)
        return storyboard
      } catch (e: any) {
        this.error = e.message
        throw e
      }
    },

    async deleteNovelStoryboard(novelId: string, sbId: string) {
      try {
        await apiDelete(`/comic/novels/${novelId}/storyboards/${sbId}`)
        await this.loadNovelStoryboards(novelId)
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

    async loadLatestRun(novelId: string) {
      try {
        const run = await apiGet<PipelineRun | null>(`/comic/novels/${novelId}/latest-run`)
        this.latestRun = run
        this.latestRunsByNovel[novelId] = run
      } catch (e: any) {
        this.latestRun = null
        this.latestRunsByNovel[novelId] = null
      }
    },

    async loadLatestRunsForAllNovels() {
      const promises = this.novels.map(novel => this.loadLatestRun(novel.id))
      await Promise.all(promises)
    },

    async loadPipelineRuns(novelId?: string) {
      try {
        const query = novelId ? `?novel_id=${novelId}` : ''
        const runs = await apiGet<PipelineRun[]>(`/comic/pipeline-runs${query}`)
        this.pipelineRuns = runs
      } catch (e: any) {
        this.pipelineRuns = []
      }
    },

    async loadAllPipelineRuns() {
      try {
        const runs = await apiGet<PipelineRun[]>('/comic/pipeline-runs')
        this.allPipelineRuns = runs
      } catch (e: any) {
        this.allPipelineRuns = []
      }
    },

    setPendingRestoreRun(run: PipelineRun | null) {
      this.pendingRestoreRun = run
    },

    // ============ Pipeline Step Logs ============
    // [AGC:START] tool=Cc author=fangkun
    async loadStepLogs(runId: string) {
      try {
        const result = await apiGet<{ items: PipelineStepLog[]; total: number }>(
          `/comic/pipeline/step-logs?run_id=${runId}`
        )
        this.stepLogs = result.items
      } catch (e: any) {
        this.stepLogs = []
      }
    },

    async loadNovelStepLogs(novelId: string) {
      try {
        const result = await apiGet<{ items: PipelineStepLog[]; total: number }>(
          `/comic/pipeline/step-logs?novel_id=${novelId}`
        )
        this.stepLogs = result.items
      } catch (e: any) {
        this.stepLogs = []
      }
    },
    // [AGC:END]

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
