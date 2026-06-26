import { defineStore } from 'pinia'
import type { SkillInfo, PluginInfo, SkillContent, SkillValidation, CacheStatus } from '../types/skill'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const useSkillsStore = defineStore('skills', {
  state: () => ({
    plugins: [] as PluginInfo[],
    skills: [] as SkillInfo[],
    filteredSkills: [] as SkillInfo[],
    selectedSkill: null as SkillInfo | null,
    skillContent: null as SkillContent | null,
    searchQuery: '',
    selectedCategory: '',
    selectedPlugin: '',
    sortBy: 'name' as 'name' | 'plugin' | 'author',
    currentView: 'list' as 'list' | 'detail' | 'editor',
    cacheStatus: null as CacheStatus | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    categories: (state) => {
      const cats = new Set(state.plugins.map((p) => p.category))
      return Array.from(cats).sort()
    },
    hasCache: (state) => state.cacheStatus?.valid ?? false,
  },

  actions: {
    async loadPlugins() {
      this.loading = true
      this.error = null
      try {
        const res: ApiResponse<PluginInfo[]> = await window.api.listMarketplacePlugins()
        if (res.success && res.data) this.plugins = res.data
        else this.error = res.error || 'Failed to load plugins'
      } catch (err: any) { this.error = err.message }
      finally { this.loading = false }
    },

    async loadSkills() {
      this.loading = true
      this.error = null
      try {
        const res: ApiResponse<SkillInfo[]> = await window.api.listSkills()
        if (res.success && res.data) { this.skills = res.data; this.applyFilters() }
        else this.error = res.error || 'Failed to load skills'
      } catch (err: any) { this.error = err.message }
      finally { this.loading = false }
    },

    async searchSkills(query: string) {
      this.searchQuery = query
      this.loading = true
      try {
        const filters: any = {}
        if (this.selectedCategory) filters.category = this.selectedCategory
        if (this.selectedPlugin) filters.plugin = this.selectedPlugin
        const res: ApiResponse<SkillInfo[]> = await window.api.searchSkills(query, filters)
        if (res.success && res.data) this.filteredSkills = res.data
      } catch (err: any) { this.error = err.message }
      finally { this.loading = false }
    },

    applyFilters() {
      let filtered = [...this.skills]
      if (this.selectedCategory) filtered = filtered.filter((s) => s.pluginCategory === this.selectedCategory)
      if (this.selectedPlugin) filtered = filtered.filter((s) => s.pluginName === this.selectedPlugin)
      if (this.sortBy === 'name') filtered.sort((a, b) => a.skillName.localeCompare(b.skillName))
      else if (this.sortBy === 'plugin') filtered.sort((a, b) => a.pluginName.localeCompare(b.pluginName))
      else if (this.sortBy === 'author') filtered.sort((a, b) => (a.pluginAuthor || '').localeCompare(b.pluginAuthor || ''))
      this.filteredSkills = filtered
    },

    selectSkill(skill: SkillInfo) { this.selectedSkill = skill; this.currentView = 'detail' },

    async loadSkillContent(skillPath: string) {
      this.loading = true
      try {
        const res: ApiResponse<SkillContent> = await window.api.readSkillContent(skillPath)
        if (res.success && res.data) { this.skillContent = res.data; return res.data }
        else this.error = res.error || 'Failed to load skill content'
      } catch (err: any) { this.error = err.message }
      finally { this.loading = false }
    },

    async saveSkillContent(skillPath: string, content: string, expectedMtime?: number) {
      this.loading = true
      try {
        const res = await window.api.saveSkillContent(skillPath, content, expectedMtime)
        return res
      } catch (err: any) { this.error = err.message; return { success: false, error: err.message } }
      finally { this.loading = false }
    },

    async validateSkillMd(content: string) {
      const res: ApiResponse<SkillValidation> = await window.api.validateSkillMd(content)
      if (res.success && res.data) return res.data
      return { valid: false, errors: ['Validation failed'] }
    },

    async installSkill(skillName: string, projectPath: string) {
      this.loading = true
      try {
        const res = await window.api.installSkill(skillName, projectPath)
        return res
      } catch (err: any) { this.error = err.message; return { success: false, error: err.message } }
      finally { this.loading = false }
    },

    async uninstallSkill(skillName: string, projectPath: string) {
      this.loading = true
      try {
        const res = await window.api.uninstallSkill(skillName, projectPath)
        return res
      } catch (err: any) { this.error = err.message; return { success: false, error: err.message } }
      finally { this.loading = false }
    },

    async checkCacheStatus() {
      try {
        const res: ApiResponse<CacheStatus> = await window.api.checkCacheStatus()
        if (res.success && res.data) this.cacheStatus = res.data
      } catch (err: any) { this.error = err.message }
    },

    async initMarketplace() {
      this.loading = true
      try {
        const res = await window.api.initMarketplace()
        if (res.success) { await this.checkCacheStatus(); await this.loadPlugins(); await this.loadSkills() }
        return res
      } catch (err: any) { this.error = err.message; return { success: false, error: err.message } }
      finally { this.loading = false }
    },

    async updateMarketplace() {
      this.loading = true
      try {
        const res = await window.api.updateMarketplace()
        if (res.success) { await this.loadPlugins(); await this.loadSkills() }
        return res
      } catch (err: any) { this.error = err.message; return { success: false, error: err.message } }
      finally { this.loading = false }
    },

    setView(view: 'list' | 'detail' | 'editor') { this.currentView = view },

    clearSelection() {
      this.selectedSkill = null
      this.skillContent = null
      this.currentView = 'list'
    },
  },
})
