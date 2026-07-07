import { defineStore } from 'pinia'
import type { SkillInfo, PluginInfo, SkillContent, SkillValidation, CacheStatus, InstallMode, InstallStatus, DirectoryNode, LinkedFileReference, BatchSaveResult } from '../types/skill'
import i18n from '../i18n'
interface ApiResponse<T> { success: boolean; data?: T; error?: string }

export const useSkillsStore = defineStore('skills', {
  state: () => ({
    plugins: [] as PluginInfo[], skills: [] as SkillInfo[], filteredPlugins: [] as PluginInfo[], filteredSkills: [] as SkillInfo[],
    installedSkills: [] as SkillInfo[],
    selectedSkill: null as SkillInfo | null, skillContent: null as SkillContent | null,
    searchQuery: '', selectedCategory: '', selectedPlugin: '',
    sortBy: 'name' as 'name' | 'plugin' | 'author',
    currentView: 'list' as 'list' | 'detail' | 'editor' | 'manage' | 'prompt',
    cacheStatus: null as CacheStatus | null, loading: false, error: null as string | null,
    // Manage view state
    directoryTree: null as DirectoryNode | null,
    linkedFiles: [] as LinkedFileReference[],
    modifiedFiles: new Map<string, { content: string; originalMtime: number }>(),
    openFiles: [] as { path: string; name: string; content: string; mtime: number }[],
    activeFilePath: null as string | null,
    saveProgress: null as { total: number; current: number; status: string } | null,
  }),
  getters: {
    categories: (state) => Array.from(new Set(state.plugins.map(p => p.category))).sort(),
    hasCache: (state) => state.cacheStatus?.valid ?? false,
  },
  actions: {
    async loadPlugins() { this.loading = true; this.error = null; try { const r = await window.api.listMarketplacePlugins(); if (r.success && r.data) { this.plugins = r.data; this.applyFilters() } else this.error = r.error || i18n.global.t('message.failed') } catch(e: any) { this.error = e.message } finally { this.loading = false } },
    async loadSkills() { this.loading = true; this.error = null; try { const r = await window.api.listSkills(); if (r.success && r.data) { this.skills = r.data } else this.error = r.error || i18n.global.t('message.failed') } catch(e: any) { this.error = e.message } finally { this.loading = false } },
    async loadInstalledSkills() { this.loading = true; this.error = null; try { const r = await window.api.listInstalledSkills(); if (r.success && r.data) { this.installedSkills = r.data; return r.data } else this.error = r.error || i18n.global.t('message.failed'); return [] } catch(e: any) { this.error = e.message; return [] } finally { this.loading = false } },
    async searchSkills(query: string) { this.searchQuery = query; this.loading = true; try { const f: any = {}; if (this.selectedCategory) f.category = this.selectedCategory; if (this.selectedPlugin) f.plugin = this.selectedPlugin; if (this.sortBy) f.sortBy = this.sortBy; const r = await window.api.searchSkills(query, f); if (r.success && r.data) this.filteredSkills = r.data } catch(e: any) { this.error = e.message } finally { this.loading = false } },
    applyFilters() { let f = [...this.plugins]; if (this.searchQuery) { const q = this.searchQuery.toLowerCase(); f = f.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.keywords?.some(kw => kw.toLowerCase().includes(q)) || p.skills.some((s: { skillName: string }) => s.skillName.toLowerCase().includes(q))) } if (this.selectedCategory) f = f.filter(p => p.category === this.selectedCategory); if (this.sortBy === 'name') f.sort((a, b) => a.name.localeCompare(b.name)); else if (this.sortBy === 'plugin') f.sort((a, b) => a.name.localeCompare(b.name)); else if (this.sortBy === 'author') f.sort((a, b) => (a.author || '').localeCompare(b.author || '')); this.filteredPlugins = f },
    selectSkill(skill: SkillInfo) { this.selectedSkill = skill; this.currentView = 'detail' },
    async loadSkillContent(p: string) { this.loading = true; try { const r = await window.api.readSkillContent(p); if (r.success && r.data) { this.skillContent = r.data; return r.data } else this.error = r.error || i18n.global.t('message.failed') } catch(e: any) { this.error = e.message } finally { this.loading = false } },
    async saveSkillContent(p: string, c: string, m?: number) { this.loading = true; try { return await window.api.saveSkillContent(p, c, m) } catch(e: any) { this.error = e.message; return { success: false, error: e.message } } finally { this.loading = false } },
    async validateSkillMd(c: string) { const r = await window.api.validateSkillMd(c); if (r.success && r.data) return r.data; return { valid: false, errors: ['Validation failed'] } },
    async installSkill(n: string, p: string) { this.loading = true; try { return await window.api.installSkill(n, p) } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    async installSkillWithMode(n: string, p: string, mode: InstallMode, targetDir: string) { this.loading = true; try { return await window.api.installSkillWithMode(n, p, mode, targetDir) } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    async uninstallSkill(n: string, p: string) { this.loading = true; try { return await window.api.uninstallSkill(n, p) } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    async checkInstallStatus(n: string, p: string): Promise<InstallStatus | null> { try { const r = await window.api.checkInstallStatus(n, p); if (r.success && r.data) return r.data; return null } catch(e: any) { return null } },
    async getDefaultDir(p: string): Promise<string> { try { const r = await window.api.getDefaultDir(p); if (r.success && r.data) return r.data.defaultDir; return '' } catch(e: any) { return '' } },
    async checkCacheStatus() { try { const r = await window.api.checkCacheStatus(); if (r.success && r.data) this.cacheStatus = r.data } catch(e: any) { this.error = e.message } },
    async initMarketplace() { this.loading = true; try { const r = await window.api.initMarketplace(); if (r.success) { await this.checkCacheStatus(); await this.loadPlugins(); await this.loadSkills() } return r } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    async updateMarketplace() { this.loading = true; try { const r = await window.api.updateMarketplace(); if (r.success) { await this.loadPlugins(); await this.loadSkills() } return r } catch(e: any) { return { success: false, error: e.message } } finally { this.loading = false } },
    setView(v: 'list' | 'detail' | 'editor' | 'manage' | 'prompt') { this.currentView = v },
    clearSelection() { this.selectedSkill = null; this.skillContent = null; this.currentView = 'list' },
    // [AGC:START] tool=Cc author=fangkun
    // Manage view actions
    async fetchSkillDirectory(dirPath: string) {
      this.loading = true;
      try {
        const r = await window.api.listSkillDirectory(dirPath);
        if (r.success && r.data) { this.directoryTree = r.data; return r.data }
        else this.error = r.error || i18n.global.t('message.failed');
        return null;
      } catch(e: any) { this.error = e.message; return null }
      finally { this.loading = false }
    },
    async parseSkillReferences(content: string, basePath: string) {
      // Reference parsing is done on the frontend side (see utils/referenceParser)
      const { parseReferences } = await import('../utils/referenceParser');
      const refs = parseReferences(content, basePath);
      this.linkedFiles = refs;
      return refs;
    },
    async loadSkillFile(p: string) {
      this.loading = true;
      try {
        const r = await window.api.readSkillFile(p);
        if (r.success && r.data) {
          const existing = this.openFiles.find(f => f.path === p);
          if (!existing) {
            this.openFiles.push({ path: p, name: p.split('/').pop() || p, content: r.data.content, mtime: r.data.lastModified });
          }
          this.activeFilePath = p;
          return r.data;
        } else this.error = r.error || i18n.global.t('message.failed');
        return null;
      } catch(e: any) { this.error = e.message; return null }
      finally { this.loading = false }
    },
    trackFileChange(p: string, content: string, originalMtime: number) {
      this.modifiedFiles.set(p, { content, originalMtime });
      // Also update openFiles
      const idx = this.openFiles.findIndex(f => f.path === p);
      if (idx >= 0) this.openFiles[idx].content = content;
    },
    closeFile(p: string) {
      this.openFiles = this.openFiles.filter(f => f.path !== p);
      if (this.activeFilePath === p) {
        this.activeFilePath = this.openFiles.length > 0 ? this.openFiles[0].path : null;
      }
    },
    async saveModifiedFiles(): Promise<BatchSaveResult> {
      const files = Array.from(this.modifiedFiles.entries()).map(([path, data]) => ({
        path, content: data.content, expectedMtime: data.originalMtime
      }));
      this.saveProgress = { total: files.length, current: 0, status: 'Saving...' };
      try {
        const r = await window.api.batchSaveFiles(files);
        if (r.success && r.data) {
          const result = r.data as BatchSaveResult;
          // Clear saved files from modifiedFiles
          for (const savedPath of result.saved) {
            this.modifiedFiles.delete(savedPath);
          }
          this.saveProgress = null;
          return result;
        }
        this.saveProgress = null;
        return { success: false, saved: [], failed: [], conflicts: [] };
      } catch(e: any) {
        this.saveProgress = null;
        return { success: false, saved: [], failed: [{ path: '', error: e.message }], conflicts: [] };
      }
    },
    handleSaveConflict(_path: string) {
      // Remove from modified files on conflict (user chose to skip or reload)
      this.modifiedFiles.delete(_path);
    },
    clearManageState() {
      this.directoryTree = null;
      this.linkedFiles = [];
      this.modifiedFiles.clear();
      this.openFiles = [];
      this.activeFilePath = null;
      this.saveProgress = null;
    },
    // [AGC:END]
  },
})
