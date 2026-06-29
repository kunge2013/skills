export type InstallMode = 'symlink' | 'copy'
export interface SkillInfo { skillName: string; pluginName: string; sourcePath: string; pluginDescription?: string; pluginAuthor?: string; pluginLicense?: string; pluginCategory?: string; pluginKeywords?: string[] }
export interface PluginInfo { name: string; source: string; description: string; author: string; license: string; category: string; keywords: string[]; skillCount: number; sourceDir: string }
export interface SkillContent { content: string; path: string; lastModified: number }
export interface SkillValidation { valid: boolean; errors: string[]; frontmatter?: string; body?: string }
export interface CacheStatus { valid: boolean; cacheDir: string; hasBundled: boolean; lastSync: string | null; repoUrl: string }
export interface InstallStatus { installed: boolean; skillName: string; mode?: InstallMode; linkPath?: string; installPath?: string; targetPath?: string; sourcePath?: string; installedAt?: string; isValid?: boolean; hasSkillMd?: boolean }

// [AGC:START] tool=Cc author=fangkun
export interface DirectoryNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  isLeaf?: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  lastModified: number;
  isDirectory: boolean;
  extension?: string;
}

export interface LinkedFileReference {
  type: 'image' | 'link' | 'include';
  altText?: string;
  relativePath: string;
  resolvedPath: string;
  originalLine: string;
}

export interface BatchSaveResult {
  success: boolean;
  saved: string[];
  failed: { path: string; error: string }[];
  conflicts: { path: string; currentContent: string }[];
}
// [AGC:END]
