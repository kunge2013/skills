export {}
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
      uninstallSkill: (n: string, p: string) => Promise<any>
      checkSkillStatus: (n: string) => Promise<any>
      initMarketplace: () => Promise<any>
      updateMarketplace: () => Promise<any>
      checkCacheStatus: () => Promise<{ success: boolean; data?: any; error?: string }>
      onFileChanged: (cb: (d: { path: string }) => void) => () => void
    }
  }
}
