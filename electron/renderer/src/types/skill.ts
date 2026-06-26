// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
export interface SkillInfo {
  skillName: string;
  pluginName: string;
  sourcePath: string;
  pluginDescription?: string;
  pluginAuthor?: string;
  pluginLicense?: string;
  pluginCategory?: string;
  pluginKeywords?: string[];
}

export interface PluginInfo {
  name: string;
  source: string;
  description: string;
  author: string;
  license: string;
  category: string;
  keywords: string[];
  skillCount: number;
  sourceDir: string;
}

export interface SkillContent {
  content: string;
  path: string;
  lastModified: number;
}

export interface SkillValidation {
  valid: boolean;
  errors: string[];
  frontmatter?: string;
  body?: string;
}

export interface CacheStatus {
  valid: boolean;
  cacheDir: string;
  hasBundled: boolean;
  lastSync: string | null;
  repoUrl: string;
}
