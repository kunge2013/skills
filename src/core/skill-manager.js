'use strict';

// [AGC:START] tool=Cc author=fangkun
/**
 * Skill manager for external sources.
 *
 * Provides tree-view management of external skills with enable/disable state.
 * State is persisted to skill_manage_setting.json.
 *
 * Directory structure:
 *   ~/.kungeskills/skill_manage_setting.json - persisted state
 *   ~/.claude/skills/<owner>__<project>__<skill> -> symlink to cached skill
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getConfig, getExternalSourceCacheDir } = require('./config');
const { createSkillSymlink } = require('./symlink');

const SETTINGS_FILE = 'skill_manage_setting.json';
const USER_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');

// ========== Settings Management ==========

function getSettingsPath() {
  const configDir = path.join(os.homedir(), '.kungeskills');
  return path.join(configDir, SETTINGS_FILE);
}

function loadSettings() {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return { sources: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return { sources: {} };
  }
}

function saveSettings(settings) {
  const settingsPath = getSettingsPath();
  const configDir = path.dirname(settingsPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

// ========== Plugin.json Parsing ==========

function parsePluginJson(sourceDir) {
  const pluginPath = path.join(sourceDir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
  } catch {
    return null;
  }
}

function parseSkillPath(skillPath) {
  // skillPath format: ./skills/<category>/<skillName>
  const normalized = skillPath.replace(/^\.\//, '');
  const parts = normalized.split('/');

  if (parts.length >= 3 && parts[0] === 'skills') {
    return {
      category: parts[1],
      skillName: parts.slice(2).join('/')
    };
  } else if (parts.length === 2 && parts[0] === 'skills') {
    return {
      category: '_root',
      skillName: parts[1]
    };
  }

  return {
    category: '_root',
    skillName: parts.join('/')
  };
}

// ========== Tree Building ==========

function buildTreeFromPlugin(sourceDir, owner) {
  const plugin = parsePluginJson(sourceDir);
  const settings = loadSettings();
  const sourceKey = `${owner}`;
  const sourceSettings = settings.sources[sourceKey] || {};

  // Build tree structure
  const categories = {};

  // If plugin has skills array, use it
  if (plugin && plugin.skills && Array.isArray(plugin.skills)) {
    for (const skillPath of plugin.skills) {
      const parsed = parseSkillPath(skillPath);
      const { category, skillName } = parsed;

      if (!categories[category]) {
        categories[category] = [];
      }

      const skillKey = `${category}/${skillName}`;
      const enabled = sourceSettings[skillKey] === true;

      categories[category].push({
        name: skillName,
        path: skillPath,
        enabled,
        key: skillKey
      });
    }
  } else {
    // Scan skills directory to discover skills
    const skillsDir = path.join(sourceDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      scanSkillsDirectory(skillsDir, '', categories, sourceSettings);
    }
  }

  // Check if we found any skills
  const totalSkills = Object.values(categories).reduce((sum, skills) => sum + skills.length, 0);
  if (totalSkills === 0) {
    return null;
  }

  return {
    name: plugin?.name || owner,
    description: plugin?.description || '',
    author: plugin?.author?.name || 'Unknown',
    categories: Object.entries(categories).map(([catName, skills]) => ({
      name: catName,
      skills
    }))
  };
}

/**
 * Recursively scan a directory for skills (directories containing SKILL.md)
 */
function scanSkillsDirectory(dir, relativePath, categories, sourceSettings) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);
    const skillPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    // Check if this directory contains SKILL.md
    if (fs.existsSync(path.join(fullPath, 'SKILL.md'))) {
      // Determine category from path
      const parts = skillPath.split('/');
      let category, skillName;

      if (parts.length === 1) {
        category = '_root';
        skillName = parts[0];
      } else {
        category = parts[0];
        skillName = parts.slice(1).join('/');
      }

      if (!categories[category]) {
        categories[category] = [];
      }

      const skillKey = `${category}/${skillName}`;
      const enabled = sourceSettings[skillKey] === true;

      categories[category].push({
        name: skillName,
        path: `./skills/${skillPath}`,
        enabled,
        key: skillKey
      });
    } else {
      // Recurse into subdirectory
      scanSkillsDirectory(fullPath, skillPath, categories, sourceSettings);
    }
  }
}

// ========== Symlink Management ==========

function getSymlinkPath(owner, category, skillName) {
  // Use double underscore as separator, omit _root category
  let safeName;
  if (category === '_root') {
    safeName = `${owner}__${skillName}`;
  } else {
    safeName = `${owner}__${category}__${skillName}`;
  }
  return path.join(USER_SKILLS_DIR, safeName.replace(/\//g, '__'));
}

function enableSkill(owner, category, skillName, sourceDir) {
  const settings = loadSettings();
  const sourceKey = owner;

  if (!settings.sources[sourceKey]) {
    settings.sources[sourceKey] = {};
  }

  const skillKey = `${category}/${skillName}`;
  settings.sources[sourceKey][skillKey] = true;

  // Create symlink - handle _root category (skills directly in skills/ directory)
  let skillPath;
  if (category === '_root') {
    skillPath = path.join(sourceDir, 'skills', skillName);
  } else {
    skillPath = path.join(sourceDir, 'skills', category, skillName);
  }
  const symlinkPath = getSymlinkPath(owner, category, skillName);

  try {
    if (!fs.existsSync(USER_SKILLS_DIR)) {
      fs.mkdirSync(USER_SKILLS_DIR, { recursive: true });
    }

    // Remove existing if any (including broken symlinks)
    let exists = false;
    try {
      fs.lstatSync(symlinkPath);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      fs.unlinkSync(symlinkPath);
    }

    // Create symlink
    if (fs.existsSync(skillPath)) {
      createSkillSymlink(skillPath, symlinkPath);
    }

    saveSettings(settings);
    return { success: true, path: symlinkPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function disableSkill(owner, category, skillName) {
  const settings = loadSettings();
  const sourceKey = owner;

  if (settings.sources[sourceKey]) {
    const skillKey = `${category}/${skillName}`;
    settings.sources[sourceKey][skillKey] = false;
  }

  // Remove symlink
  const symlinkPath = getSymlinkPath(owner, category, skillName);

  try {
    // Check if symlink exists (including broken symlinks)
    let exists = false;
    try {
      fs.lstatSync(symlinkPath);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      fs.unlinkSync(symlinkPath);
    }

    saveSettings(settings);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toggleSkill(owner, category, skillName, sourceDir, enabled) {
  if (enabled) {
    return enableSkill(owner, category, skillName, sourceDir);
  } else {
    return disableSkill(owner, category, skillName);
  }
}

// ========== Get All Sources ==========

function getAllManagedSources() {
  const config = getConfig();
  const externalSources = config.externalSources || [];
  const settings = loadSettings();

  const result = [];

  for (const source of externalSources) {
    const { owner, repo } = source;
    const sourceDir = getExternalSourceCacheDir(owner, repo);

    if (!fs.existsSync(sourceDir)) {
      continue;
    }

    const tree = buildTreeFromPlugin(sourceDir, owner);

    if (tree) {
      const sourceSettings = settings.sources[owner] || {};
      const totalSkills = tree.categories.reduce((sum, cat) => sum + cat.skills.length, 0);
      const enabledCount = tree.categories.reduce((sum, cat) =>
        sum + cat.skills.filter(s => s.enabled).length, 0);

      result.push({
        owner,
        repo,
        name: tree.name,
        description: tree.description,
        author: tree.author,
        totalSkills,
        enabledCount,
        categories: tree.categories
      });
    }
  }

  return result;
}

// ========== Enable/Disable All ==========

function enableCategory(owner, category, sourceDir) {
  const tree = buildTreeFromPlugin(sourceDir, owner);
  if (!tree) return { success: false, error: 'Plugin not found' };

  const cat = tree.categories.find(c => c.name === category);
  if (!cat) return { success: false, error: 'Category not found' };

  let enabledCount = 0;
  for (const skill of cat.skills) {
    const result = enableSkill(owner, category, skill.name, sourceDir);
    if (result.success) enabledCount++;
  }

  return { success: true, enabledCount };
}

function disableCategory(owner, category) {
  const tree = buildTreeFromPlugin(getExternalSourceCacheDir(owner, getRepoByOwner(owner)), owner);
  if (!tree) return { success: false, error: 'Plugin not found' };

  const cat = tree.categories.find(c => c.name === category);
  if (!cat) return { success: false, error: 'Category not found' };

  let disabledCount = 0;
  for (const skill of cat.skills) {
    const result = disableSkill(owner, category, skill.name);
    if (result.success) disabledCount++;
  }

  return { success: true, disabledCount };
}

function getRepoByOwner(owner) {
  const config = getConfig();
  const source = (config.externalSources || []).find(s => s.owner === owner);
  return source?.repo || '';
}

function enableAllSkills(owner, sourceDir) {
  const tree = buildTreeFromPlugin(sourceDir, owner);
  if (!tree) return { success: false, error: 'Plugin not found' };

  let enabledCount = 0;
  for (const cat of tree.categories) {
    for (const skill of cat.skills) {
      const result = enableSkill(owner, cat.name, skill.name, sourceDir);
      if (result.success) enabledCount++;
    }
  }

  return { success: true, enabledCount };
}

function disableAllSkills(owner) {
  const repo = getRepoByOwner(owner);
  if (!repo) return { success: false, error: 'Source not found' };

  const sourceDir = getExternalSourceCacheDir(owner, repo);
  const tree = buildTreeFromPlugin(sourceDir, owner);
  if (!tree) return { success: false, error: 'Plugin not found' };

  let disabledCount = 0;
  for (const cat of tree.categories) {
    for (const skill of cat.skills) {
      const result = disableSkill(owner, cat.name, skill.name);
      if (result.success) disabledCount++;
    }
  }

  return { success: true, disabledCount };
}

module.exports = {
  loadSettings,
  saveSettings,
  parsePluginJson,
  buildTreeFromPlugin,
  enableSkill,
  disableSkill,
  toggleSkill,
  getAllManagedSources,
  enableCategory,
  disableCategory,
  enableAllSkills,
  disableAllSkills,
  getSymlinkPath
};
// [AGC:END]
