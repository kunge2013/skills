export {}

declare global {
  interface Window {
    api: {
      listMarketplacePlugins: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      listSkills: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      searchSkills: (query: string, filters: any) => Promise<{ success: boolean; data?: any[]; error?: string }>
      readSkillContent: (skillPath: string) => Promise<{ success: boolean; data?: any; error?: string }>
      saveSkillContent: (skillPath: string, content: string, expectedMtime?: number) => Promise<any>
      validateSkillMd: (content: string) => Promise<{ success: boolean; data?: any; error?: string }>
      installSkill: (skillName: string, projectPath: string) => Promise<any>
      uninstallSkill: (skillName: string, projectPath: string) => Promise<any>
      checkSkillStatus: (skillName: string) => Promise<any>
      initMarketplace: () => Promise<any>
      updateMarketplace: () => Promise<any>
      checkCacheStatus: () => Promise<{ success: boolean; data?: any; error?: string }>
      onFileChanged: (callback: (data: { path: string }) => void) => () => void
    }
  }
}
