export {}
import type { InstallStatus, DirectoryNode, FileInfo, LinkedFileReference } from './skill'

declare global {
  interface Window {
    api: {
      listMarketplacePlugins: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      listSkills: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      searchSkills: (q: string, f: any) => Promise<{ success: boolean; data?: any[]; error?: string }>
      readSkillContent: (p: string) => Promise<{ success: boolean; data?: any; error?: string }>
      saveSkillContent: (p: string, c: string, m?: number) => Promise<any>
      validateSkillMd: (c: string) => Promise<{ success: boolean; data?: any; error?: string }>
      installSkill: (n: string, p: string) => Promise<any>
      installSkillWithMode: (n: string, p: string, mode: 'symlink' | 'copy', targetDir: string) => Promise<any>
      uninstallSkill: (n: string, p: string) => Promise<any>
      checkSkillStatus: (n: string) => Promise<any>
      checkInstallStatus: (n: string, p: string) => Promise<{ success: boolean; data?: InstallStatus | null; error?: string }>
      getDefaultDir: (p: string) => Promise<{ success: boolean; data?: { defaultDir: string }; error?: string }>
      listDrives: () => Promise<{ success: boolean; data?: { drives: { label: string; value: string; available: boolean }[] }; error?: string }>
      listDirs: (p: string) => Promise<{ success: boolean; data?: { path: string; children: any[]; parent: string }; error?: string }>
      initMarketplace: () => Promise<any>
      updateMarketplace: () => Promise<any>
      checkCacheStatus: () => Promise<{ success: boolean; data?: any; error?: string }>
      listInstalledSkills: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      listSkillDirectory: (p: string) => Promise<{ success: boolean; data?: DirectoryNode; error?: string }>
      listSkillFiles: (p: string) => Promise<{ success: boolean; data?: FileInfo[]; error?: string }>
      readSkillFile: (p: string) => Promise<{ success: boolean; data?: { content: string; path: string; lastModified: number }; error?: string }>
      saveSkillFile: (p: string, c: string, m?: number) => Promise<{ success: boolean; error?: string; conflict?: boolean; currentContent?: string }>
      batchSaveFiles: (files: { path: string; content: string; expectedMtime?: number }[]) => Promise<{ success: boolean; data?: any; error?: string }>
      listSkillToggleState: (provider?: string) => Promise<{ success: boolean; data?: any; error?: string }>
      setSkillEnabled: (n: string, e: boolean, provider?: string) => Promise<any>
      setOwnerSkillsEnabled: (o: string, e: boolean, provider?: string) => Promise<any>
      setProjectSkillsEnabled: (o: string, p: string, e: boolean, provider?: string) => Promise<any>
      listExternalSources: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      addExternalSource: (s: string, b?: string, providers?: string[]) => Promise<any>
      updateExternalSource: (o: string, r: string, updates: { providers?: string[]; branch?: string }) => Promise<any>
      removeExternalSource: (o: string, r: string) => Promise<any>
      syncExternalSource: (o: string, r: string) => Promise<any>
      discoverExternalSkills: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      installExternalSkill: (o: string, r: string, sn: string, sp: string, pp?: string, providers?: string[]) => Promise<any>
      getGitProxy: () => Promise<{ success: boolean; data?: { enabled: boolean; url: string }; error?: string }>
      setGitProxy: (enabled: boolean, url: string) => Promise<{ success: boolean; data?: { enabled: boolean; url: string }; error?: string }>
      listManagedSkills: (provider?: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
      toggleManagedSkill: (owner: string, repo: string, category: string, skillName: string, enabled: boolean, provider?: string) => Promise<any>
      enableCategory: (owner: string, repo: string, category: string, provider?: string) => Promise<any>
      disableCategory: (owner: string, category: string, provider?: string) => Promise<any>
      enableAllManagedSkills: (owner: string, repo: string, provider?: string) => Promise<any>
      disableAllManagedSkills: (owner: string, provider?: string) => Promise<any>
      onFileChanged: (cb: (d: { path: string }) => void) => () => void
    }
  }
}
