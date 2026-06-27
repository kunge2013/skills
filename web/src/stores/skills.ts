import { defineStore } from 'pinia'
import type { SkillInfo, PluginInfo, SkillContent, SkillValidation, CacheStatus } from '../types/skill'
import i18n from '../i18n'
interface ApiResponse<T> { success: boolean; data?: T; error?: string }

export const useSkillsStore = defineStore('skills', {
  state: () => ({
    plugins: [] as PluginInfo[], skills: [] as SkillInfo[], filteredSkills: [] as SkillInfo[],
    selectedSkill: null as SkillInfo | null, skillContent: null as SkillContent | null,
    searchQuery: '', selectedCategory: '', selectedPlugin: '',
    sortBy: 'name' as 'name' | 'plugin' | 'author',
    currentView: 'list' as 'list' | 'detail' | 'editor',
    cacheStatus: null as CacheStatus | null, loading: false, error: null as string | null,
  }),
  getters: {
    categories: (state) => Array.from(new Set(state.plugins.map(p => p.category))).sort(),
    hasCache: (state) => state.cacheStatus?.valid ?? false,
  },
  actions: {
    async loadPlugins() { this.loading = true; this.error = null; try { const r = await window.api.listMarketplacePlugins(); if (r.success && r.data) this.plugins = r.data; else this.error = r.error || i18n.global.t('message.failed') } catch(e: any) { this.error = e.message } finally { this.loading = false } },
    async loadSkills() { this.loading = true; this.error = null; try { const r = await window.api.listSkills(); if (r.success && r.data) { this.skills = r.data; this.applyFilters() } else this.error = r.error || i18n.global.t('message.failed') } catch(e: any) { this.error = e.message } finally { this.loading = false } },
    async searchSkills(query: string) { this.searchQuery = query; this.loading = true; try { const f: any = {}; if (this.selectedCategory) f.category = this.selectedCategory; if (this.selectedPlugin) f.plugin = this.selectedPlugin; const r = await window.api.searchSkills(query, f); if (r.success && r.data) this.filteredSkills = r.data } catch(e: any) { this.error = e.message } finally { this.loading = false } },
    applyFilters() { let f = [...this.skills]; if (this.selectedCategory) f = f.filter(s => s.pluginCategory === this.selectedCategory); if (this.selectedPlugin) f = f.filter(s => s.pluginName === this.selectedPlugin); if (this.sortBy === 'name') f.sort((a, b) => a.skillName.localeCompare(b.skillName)); else if (this.sortBy === 'plugin') f.sort((a, b) => a.pluginName.localeCompare(b.pluginName)); else if (this.sortBy === 'author') f.sort((a, b) => (a.pluginAuthor || '').localeCompare(b.pluginAuthor || '')); this.filteredSkills = f },
    selectSkill(skill: SkillInfo) { this.selectedSkill = skill; this.currentView = 'detail' },
    async loadSkillContent(p: string) { this.loading = true; try { const r = await window.api.readSkillContent(p); if (r.success && r.data) { this.skillContent = r.data; return r.data } else this.error = r.error || i18n.global.t('message.failed') } catch(e: any) { this.error = e.message } finally { this.loading = false } },
    async saveSkillContent(p: string, c: string, m?: number) { this.loading = true; try { return await window.api.saveSkillContent(p, c, m) } catch(e: any) { this.error = e.message; return { success: false, error: e.message } } finally { this.loading = false } },
    async validateSkillMd(c: string) { const r = await window.api.validateSkillMd(c); if (r.success && r.data) return r.data; return { valid: false, errors: ['Validation failed'] } },
    async installSkill(n: string, p: string) { this.loading = true; try { return await window.api.installSkill(n, p) } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    async uninstallSkill(n: string, p: string) { this.loading = true; try { return await window.api.uninstallSkill(n, p) } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    async checkCacheStatus() { try { const r = await window.api.checkCacheStatus(); if (r.success && r.data) this.cacheStatus = r.data } catch(e: any) { this.error = e.message } },
    async initMarketplace() { this.loading = true; try { const r = await window.api.initMarketplace(); if (r.success) { await this.checkCacheStatus(); await this.loadPlugins(); await this.loadSkills() } return r } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    async updateMarketplace() { this.loading = true; try { const r = await window.api.updateMarketplace(); if (r.success) { await this.loadPlugins(); await this.loadSkills() } return r } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    setView(v: 'list' | 'detail' | 'editor') { this.currentView = v },
    clearSelection() { this.selectedSkill = null; this.skillContent = null; this.currentView = 'list' },
  },
})
