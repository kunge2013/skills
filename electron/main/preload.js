// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
const { contextBridge, ipcRenderer } = require('electron');

// [AGC:START] tool=Cc author=fangkun
contextBridge.exposeInMainWorld('api', {
  // Marketplace
  listMarketplacePlugins: () => ipcRenderer.invoke('marketplace:list-plugins'),
  listSkills: () => ipcRenderer.invoke('marketplace:list-skills'),
  searchSkills: (query, filters) => ipcRenderer.invoke('marketplace:search', query, filters),

  // Skill CRUD
  readSkillContent: (skillPath) => ipcRenderer.invoke('skill:read', skillPath),
  saveSkillContent: (skillPath, content) => ipcRenderer.invoke('skill:save', skillPath, content),
  validateSkillMd: (content) => ipcRenderer.invoke('skill:validate', content),

  // Symlink management
  installSkill: (skillName, projectPath) => ipcRenderer.invoke('symlink:install', skillName, projectPath),
  uninstallSkill: (skillName, projectPath) => ipcRenderer.invoke('symlink:uninstall', skillName, projectPath),
  checkSkillStatus: (skillName) => ipcRenderer.invoke('symlink:status', skillName),

  // Git operations
  initMarketplace: () => ipcRenderer.invoke('git:init'),
  updateMarketplace: () => ipcRenderer.invoke('git:update'),
  checkCacheStatus: () => ipcRenderer.invoke('git:cache-status'),

  // File watching
  onFileChanged: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('file:changed', subscription);
    return () => ipcRenderer.removeListener('file:changed', subscription);
  },
});
// [AGC:END]
