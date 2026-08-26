'use strict';

// [AGC:FILE] tool=Cc author=fangkun date=2026-08-16
/**
 * External skill source management.
 *
 * Supports adding skills from GitHub repositories (like mattpocock/skills).
 * Structure: owner/repo with optional subdirectory paths for skills.
 *
 * Directory layout in cache:
 *   ~/.kungeskills/cache/external/<owner>/<repo>/...
 *
 * Skills can be organized in two ways:
 *   1. Single-level: skills/<skillName>/SKILL.md
 *   2. Multi-level (project-based): <projectName>/skills/<skillName>/SKILL.md
 *
 * Symlinks in user skills dir:
 *   ~/.claude/skills/<owner>__<project>__<skillName> -> <cachePath>
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getConfig, updateConfig, getExternalSourceCacheDir, getProviderByName, ALL_PROVIDERS } = require('./config');
const { cloneRepo, pullRepo } = require('../utils/git');
const { createSkillSymlink } = require('./symlink');

const EXTERNAL_SOURCE_MARKER = '.external-source.json';
const DEFAULT_PROVIDER = 'claude-code';

/**
 * Parse a GitHub source string.
 * Supports formats:
 *   - "owner/repo" or "owner/repo/subdir"
 *   - "https://github.com/owner/repo" (with or without .git)
 * @param {string} sourceStr - Source identifier
 * @returns {{owner: string, repo: string, subdir: string}}
 */
function parseSourceString(sourceStr) {
  let str = sourceStr.trim();

  // Handle full URL: https://github.com/owner/repo[.git][/subdir]
  const urlMatch = str.match(/^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/(.+))?$/i);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      subdir: urlMatch[3] || ''
    };
  }

  // Handle owner/repo format
  const parts = str.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid source format: "${sourceStr}". Expected "owner/repo" or "https://github.com/owner/repo"`);
  }
  return {
    owner: parts[0],
    repo: parts[1].replace(/\.git$/, ''),
    subdir: parts.slice(2).join('/')
  };
}

/**
 * Build GitHub URL from owner/repo.
 * @param {string} owner
 * @param {string} repo
 * @returns {string}
 */
function buildGitHubUrl(owner, repo) {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Get the cache directory for an external source.
 * @param {string} owner
 * @param {string} repo
 * @returns {string}
 */
function getSourceCacheDir(owner, repo) {
  return getExternalSourceCacheDir(owner, repo);
}

/**
 * Check if an external source is cached (cloned).
 * @param {string} owner
 * @param {string} repo
 * @returns {boolean}
 */
function isSourceCached(owner, repo) {
  const cacheDir = getSourceCacheDir(owner, repo);
  return fs.existsSync(path.join(cacheDir, '.git'));
}

/**
 * Clone or update an external source repository.
 * @param {string} owner
 * @param {string} repo
 * @param {string} [branch='main']
 * @returns {Promise<{success: boolean, cacheDir: string, error?: string}>}
 */
async function syncExternalSource(owner, repo, branch = 'main') {
  const cacheDir = getSourceCacheDir(owner, repo);
  const url = buildGitHubUrl(owner, repo);

  try {
    if (isSourceCached(owner, repo)) {
      // Pull latest changes
      await pullRepo(cacheDir);
      return { success: true, cacheDir };
    }

    // Clone fresh
    fs.mkdirSync(path.dirname(cacheDir), { recursive: true });
    await cloneRepo(url, cacheDir, branch);
    return { success: true, cacheDir };
  } catch (err) {
    // Clean up on failure
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
    return { success: false, cacheDir: '', error: err.message };
  }
}

/**
 * Find all SKILL.md files in a directory tree.
 * Supports both single-level and multi-level layouts.
 * @param {string} rootDir - Root directory to search
 * @param {string} [subdir=''] - Optional subdirectory within repo
 * @returns {{skillName: string, path: string, projectPath: string}[]}
 */
function findSkillsInSource(rootDir, subdir = '') {
  const searchDir = subdir ? path.join(rootDir, subdir) : rootDir;
  const skills = [];

  if (!fs.existsSync(searchDir)) {
    return skills;
  }

  /**
   * Recursively find SKILL.md files.
   * @param {string} dir
   * @param {string[]} projectParts - Accumulated path segments (for project name)
   */
  function findSkillsRecursive(dir, projectParts) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const entryPath = path.join(dir, entry.name);
      const skillMdPath = path.join(entryPath, 'SKILL.md');

      if (fs.existsSync(skillMdPath)) {
        // Found a skill
        skills.push({
          skillName: entry.name,
          path: entryPath,
          projectPath: projectParts.join('/')
        });
      }

      // Check for nested skills directory
      if (entry.name === 'skills' && projectParts.length === 0) {
        // Single-level layout: <repo>/skills/<skillName>
        findSkillsRecursive(entryPath, []);
      } else if (!entry.name.includes('skill') && entry.name !== 'node_modules') {
        // Multi-level layout: <repo>/<project>/skills/<skillName>
        findSkillsRecursive(entryPath, [...projectParts, entry.name]);
      }
    }
  }

  findSkillsRecursive(searchDir, []);
  return skills;
}

/**
 * Generate a symlink name for an external skill.
 * Format: <owner>__<project>__<skillName> or <owner>__<skillName>
 * @param {string} owner
 * @param {string} projectPath - Empty string for single-level
 * @param {string} skillName
 * @returns {string}
 */
function generateSymlinkName(owner, projectPath, skillName) {
  if (projectPath) {
    return `${owner}__${projectPath.replace(/\//g, '__')}__${skillName}`;
  }
  return `${owner}__${skillName}`;
}

/**
 * Parse a symlink name back into components.
 * @param {string} symlinkName
 * @returns {{owner: string, projectPath: string, skillName: string} | null}
 */
function parseSymlinkName(symlinkName) {
  const parts = symlinkName.split('__');
  if (parts.length < 2) return null;

  const owner = parts[0];
  const skillName = parts[parts.length - 1];
  const projectPath = parts.length > 2 ? parts.slice(1, -1).join('/') : '';

  return { owner, projectPath, skillName };
}

/**
 * Get the user-level skills directory for a provider.
 * @param {string} [providerName='claude-code'] - Provider name
 * @returns {string}
 */
function getUserSkillsDir(providerName = DEFAULT_PROVIDER) {
  const provider = getProviderByName(providerName);
  if (provider) {
    return provider.skillsDir;
  }
  // Fallback for backward compatibility
  return path.join(os.homedir(), '.claude', 'skills');
}

/**
 * Get the disabled skills directory for a provider.
 * @param {string} [providerName='claude-code'] - Provider name
 * @returns {string}
 */
function getDisabledSkillsDir(providerName = DEFAULT_PROVIDER) {
  const provider = getProviderByName(providerName);
  if (provider) {
    return provider.disabledDir;
  }
  // Fallback for backward compatibility
  return path.join(os.homedir(), '.claude', 'skills', '.kungeskill-disabled');
}

/**
 * Install an external skill to one or more providers via symlink.
 * @param {string} owner
 * @param {string} repo
 * @param {string} skillName
 * @param {string} sourcePath - Absolute path to skill in cache
 * @param {string} projectPath - Project path (for multi-level)
 * @param {string[]} [providers=ALL_PROVIDERS] - Provider names to install to
 * @returns {{success: boolean, results: Array<{provider: string, linkPath: string, error?: string}>, error?: string}}
 */
function installExternalSkill(owner, repo, skillName, sourcePath, projectPath = '', providers = ALL_PROVIDERS) {
  const symlinkName = generateSymlinkName(owner, projectPath, skillName);
  const results = [];

  // Validate providers array is not empty
  if (!providers || providers.length === 0) {
    return {
      success: false,
      results: [],
      error: 'At least one provider is required'
    };
  }

  for (const providerName of providers) {
    const userSkillsDir = getUserSkillsDir(providerName);
    const linkPath = path.join(userSkillsDir, symlinkName);

    try {
      if (!fs.existsSync(userSkillsDir)) {
        fs.mkdirSync(userSkillsDir, { recursive: true });
      }

      if (fs.existsSync(linkPath)) {
        // Check if already linked to same source
        try {
          const stat = fs.lstatSync(linkPath);
          if (stat.isSymbolicLink()) {
            const target = fs.realpathSync(linkPath);
            if (target === fs.realpathSync(sourcePath)) {
              results.push({ provider: providerName, linkPath, alreadyInstalled: true });
              continue;
            }
          }
        } catch { /* ignore */ }

        // Remove existing
        fs.rmSync(linkPath, { recursive: true, force: true });
      }

      createSkillSymlink(sourcePath, linkPath);

      // Write marker file for tracking
      const marker = {
        owner,
        repo,
        skillName,
        projectPath,
        sourcePath,
        providers,
        installedAt: new Date().toISOString()
      };
      fs.writeFileSync(
        path.join(linkPath, EXTERNAL_SOURCE_MARKER),
        JSON.stringify(marker, null, 2),
        'utf-8'
      );

      results.push({ provider: providerName, linkPath });
    } catch (err) {
      results.push({ provider: providerName, linkPath: '', error: err.message });
    }
  }

  const allSuccess = results.every(r => !r.error);
  return { success: allSuccess, results, error: allSuccess ? undefined : 'Some providers failed' };
}

/**
 * Uninstall an external skill from a specific provider.
 * @param {string} symlinkName
 * @param {string} [providerName='claude-code'] - Provider name
 * @returns {{success: boolean, error?: string}}
 */
function uninstallExternalSkill(symlinkName, providerName = DEFAULT_PROVIDER) {
  const userSkillsDir = getUserSkillsDir(providerName);
  const linkPath = path.join(userSkillsDir, symlinkName);

  try {
    if (!fs.existsSync(linkPath)) {
      return { success: false, error: `Skill not found: ${symlinkName}` };
    }

    // Verify it's an external skill
    const markerPath = path.join(linkPath, EXTERNAL_SOURCE_MARKER);
    if (!fs.existsSync(markerPath)) {
      return { success: false, error: `Not an external skill: ${symlinkName}` };
    }

    fs.rmSync(linkPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * List all external skills installed in a provider's user scope.
 * @param {string} [providerName='claude-code'] - Provider name
 * @returns {{owner: string, repo: string, projectPath: string, skillName: string, symlinkName: string, enabled: boolean, path: string, providers: string[]}[]}
 */
function listExternalSkills(providerName = DEFAULT_PROVIDER) {
  const userSkillsDir = getUserSkillsDir(providerName);
  const disabledDir = getDisabledSkillsDir(providerName);
  const results = [];

  function scanDir(dir, enabled) {
    if (!fs.existsSync(dir)) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const entryPath = path.join(dir, entry.name);

      // Check if directory or symlink
      let isDir = false;
      try {
        isDir = fs.statSync(entryPath).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;

      // Check for external source marker
      const markerPath = path.join(entryPath, EXTERNAL_SOURCE_MARKER);
      if (!fs.existsSync(markerPath)) continue;

      try {
        const marker = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
        results.push({
          owner: marker.owner,
          repo: marker.repo,
          projectPath: marker.projectPath || '',
          skillName: marker.skillName,
          symlinkName: entry.name,
          enabled,
          path: entryPath,
          providers: marker.providers || ALL_PROVIDERS
        });
      } catch {
        // Skip invalid markers
      }
    }
  }

  scanDir(userSkillsDir, true);
  scanDir(disabledDir, false);

  return results;
}

/**
 * Add an external source to config and sync it.
 * @param {string} sourceStr - "owner/repo" or "owner/repo/subdir"
 * @param {string} [branch='main']
 * @param {string[]} [providers=ALL_PROVIDERS] - Provider names to install skills to
 * @returns {Promise<{success: boolean, source: object, error?: string}>}
 */
async function addExternalSource(sourceStr, branch = 'main', providers = ALL_PROVIDERS) {
  const { owner, repo, subdir } = parseSourceString(sourceStr);
  const config = getConfig();

  // Validate providers array is not empty
  if (!providers || providers.length === 0) {
    return { success: false, source: null, error: 'At least one provider is required' };
  }

  // Check if already exists
  const existing = config.externalSources.find(s => s.owner === owner && s.repo === repo);
  if (existing) {
    return { success: false, source: existing, error: 'Source already exists' };
  }

  const source = {
    owner,
    repo,
    subdir,
    url: buildGitHubUrl(owner, repo),
    branch,
    providers,
    addedAt: new Date().toISOString()
  };

  // Sync the repo
  const syncResult = await syncExternalSource(owner, repo, branch);
  if (!syncResult.success) {
    return { success: false, source: null, error: syncResult.error };
  }

  // Add to config
  config.externalSources.push(source);
  updateConfig(config);

  return { success: true, source };
}

/**
 * Remove an external source from config.
 * @param {string} owner
 * @param {string} repo
 * @returns {{success: boolean}}
 */
function removeExternalSource(owner, repo) {
  const config = getConfig();
  config.externalSources = config.externalSources.filter(
    s => !(s.owner === owner && s.repo === repo)
  );
  updateConfig(config);
  return { success: true };
}

/**
 * Update an external source's configuration (e.g., providers).
 * @param {string} owner
 * @param {string} repo
 * @param {object} updates - Fields to update (e.g., { providers: [...] })
 * @returns {{success: boolean, source?: object, error?: string}}
 */
function updateExternalSource(owner, repo, updates) {
  const config = getConfig();
  const source = config.externalSources.find(s => s.owner === owner && s.repo === repo);
  if (!source) {
    return { success: false, error: 'Source not found' };
  }

  // Validate providers if being updated
  if (updates.providers !== undefined) {
    if (!updates.providers || updates.providers.length === 0) {
      return { success: false, error: 'At least one provider is required' };
    }
    source.providers = updates.providers;
  }

  // Update branch if provided
  if (updates.branch !== undefined) {
    source.branch = updates.branch;
  }

  updateConfig(config);
  return { success: true, source: listExternalSources().find(s => s.owner === owner && s.repo === repo) };
}

/**
 * List all configured external sources with their cached status.
 * @returns {{owner: string, repo: string, url: string, branch: string, cached: boolean, cacheDir: string, providers: string[]}[]}
 */
function listExternalSources() {
  const config = getConfig();
  return config.externalSources.map(s => ({
    owner: s.owner,
    repo: s.repo,
    subdir: s.subdir || '',
    url: s.url,
    branch: s.branch,
    providers: s.providers || ALL_PROVIDERS,
    cached: isSourceCached(s.owner, s.repo),
    cacheDir: getSourceCacheDir(s.owner, s.repo)
  }));
}

/**
 * Discover all skills from all external sources.
 * @returns {{owner: string, repo: string, projectPath: string, skillName: string, sourcePath: string, installed: boolean, symlinkName?: string, providers: string[]}[]}
 */
function discoverExternalSkills() {
  const sources = listExternalSources();
  const skills = [];

  for (const source of sources) {
    if (!source.cached) continue;

    const found = findSkillsInSource(source.cacheDir, source.subdir);
    // Check installation status across all providers for this source
    const installedSkills = [];
    for (const providerName of source.providers) {
      const installed = listExternalSkills(providerName);
      installedSkills.push(...installed);
    }

    for (const skill of found) {
      const symlinkName = generateSymlinkName(source.owner, skill.projectPath, skill.skillName);
      const isInstalled = installedSkills.some(s => s.symlinkName === symlinkName);

      skills.push({
        owner: source.owner,
        repo: source.repo,
        projectPath: skill.projectPath,
        skillName: skill.skillName,
        sourcePath: skill.path,
        installed: isInstalled,
        symlinkName,
        providers: source.providers
      });
    }
  }

  return skills;
}

module.exports = {
  parseSourceString,
  buildGitHubUrl,
  getSourceCacheDir,
  isSourceCached,
  syncExternalSource,
  findSkillsInSource,
  generateSymlinkName,
  parseSymlinkName,
  getUserSkillsDir,
  getDisabledSkillsDir,
  installExternalSkill,
  uninstallExternalSkill,
  listExternalSkills,
  addExternalSource,
  updateExternalSource,
  removeExternalSource,
  listExternalSources,
  discoverExternalSkills,
  EXTERNAL_SOURCE_MARKER,
  DEFAULT_PROVIDER
};
// [AGC:END]
