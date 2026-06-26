// electron/main/handlers/marketplace.js
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { getAllMarketplaceDirs } = require('../../../src/core/cache.js');
const { parseMarketplace } = require('../../../src/core/registry.js');

function listAllSkills() {
  const sourceDirs = getAllMarketplaceDirs();
  const allSkills = [];
  const seen = new Set();
  for (const sourceDir of sourceDirs) {
    const marketplace = parseMarketplace(sourceDir);
    if (!marketplace || !marketplace.plugins) continue;
    for (const plugin of marketplace.plugins) {
      const skillsDir = path.join(sourceDir, plugin.source, 'skills');
      if (!fs.existsSync(skillsDir)) continue;
      const skillDirs = fs.readdirSync(skillsDir).filter((d) => {
        const full = path.join(skillsDir, d);
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
      });
      for (const skillName of skillDirs) {
        if (seen.has(skillName)) continue;
        seen.add(skillName);
        allSkills.push({
          skillName, pluginName: plugin.name, sourcePath: path.join(skillsDir, skillName),
          pluginDescription: plugin.description, pluginAuthor: plugin.author?.name || 'Unknown',
          pluginLicense: plugin.license || 'Unknown', pluginCategory: plugin.category || 'other',
          pluginKeywords: plugin.keywords || [],
        });
      }
    }
  }
  return allSkills;
}

function listPlugins() {
  const sourceDirs = getAllMarketplaceDirs();
  const allPlugins = [];
  const seen = new Set();
  for (const sourceDir of sourceDirs) {
    const marketplace = parseMarketplace(sourceDir);
    if (!marketplace || !marketplace.plugins) continue;
    for (const plugin of marketplace.plugins) {
      if (seen.has(plugin.name)) continue;
      seen.add(plugin.name);
      const skillsDir = path.join(sourceDir, plugin.source, 'skills');
      let skillCount = 0;
      if (fs.existsSync(skillsDir)) {
        skillCount = fs.readdirSync(skillsDir).filter((d) => {
          const full = path.join(skillsDir, d);
          return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
        }).length;
      }
      allPlugins.push({
        name: plugin.name, source: plugin.source, description: plugin.description,
        author: plugin.author?.name || 'Unknown', license: plugin.license || 'Unknown',
        category: plugin.category || 'other', keywords: plugin.keywords || [],
        skillCount, sourceDir: path.join(sourceDir, plugin.source),
      });
    }
  }
  return allPlugins;
}

function searchSkills(query, filters = {}) {
  let skills = listAllSkills();
  if (query) {
    const q = query.toLowerCase();
    skills = skills.filter((s) => s.skillName.toLowerCase().includes(q) || s.pluginName.toLowerCase().includes(q) || s.pluginDescription?.toLowerCase().includes(q) || s.pluginKeywords?.some((kw) => kw.toLowerCase().includes(q)));
  }
  if (filters.category) skills = skills.filter((s) => s.pluginCategory === filters.category);
  if (filters.plugin) skills = skills.filter((s) => s.pluginName === filters.plugin);
  return skills;
}

ipcMain.handle('marketplace:list-plugins', () => {
  try { return { success: true, data: listPlugins() }; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('marketplace:list-skills', () => {
  try { return { success: true, data: listAllSkills() }; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('marketplace:search', (_event, query, filters) => {
  try { return { success: true, data: searchSkills(query, filters) }; }
  catch (err) { return { success: false, error: err.message }; }
});
