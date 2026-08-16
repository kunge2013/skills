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
const { getConfig, updateConfig, getExternalSourceCacheDir } = require('./config');
const { cloneRepo, pullRepo } = require('../utils/git');
const { createSkillSymlink } = require('./symlink');

const EXTERNAL_SOURCE_MARKER = '.external-source.json';

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
 * Get the user-level skills directory.
 * @returns {string}
 */
function getUserSkillsDir() {
  return path.join(os.homedir(), '.claude', 'skills');
}

/**
 * Install an external skill to user scope via symlink.
 * @param {string} owner
 * @param {string} repo
 * @param {string} skillName
 * @param {string} sourcePath - Absolute path to skill in cache
 * @param {string} projectPath - Project path (for multi-level)
 * @returns {{success: boolean, linkPath: string, error?: string}}
 */
function installExternalSkill(owner, repo, skillName, sourcePath, projectPath = '') {
  const userSkillsDir = getUserSkillsDir();
  const symlinkName = generateSymlinkName(owner, projectPath, skillName);
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
            return { success: true, linkPath, alreadyInstalled: true };
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
      installedAt: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(linkPath, EXTERNAL_SOURCE_MARKER),
      JSON.stringify(marker, null, 2),
      'utf-8'
    );

    return { success: true, linkPath };
  } catch (err) {
    return { success: false, linkPath: '', error: err.message };
  }
}

/**
 * Uninstall an external skill.
 * @param {string} symlinkName
 * @returns {{success: boolean, error?: string}}
 */
function uninstallExternalSkill(symlinkName) {
  const userSkillsDir = getUserSkillsDir();
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
 * List all external skills installed in user scope.
 * @returns {{owner: string, repo: string, projectPath: string, skillName: string, symlinkName: string, enabled: boolean, path: string}[]}
 */
function listExternalSkills() {
  const userSkillsDir = getUserSkillsDir();
  const disabledDir = path.join(userSkillsDir, '.kungeskill-disabled');
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
          path: entryPath
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
 * @returns {Promise<{success: boolean, source: object, error?: string}>}
 */
async function addExternalSource(sourceStr, branch = 'main') {
  const { owner, repo, subdir } = parseSourceString(sourceStr);
  const config = getConfig();

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
 * List all configured external sources with their cached status.
 * @returns {{owner: string, repo: string, url: string, branch: string, cached: boolean, cacheDir: string}[]}
 */
function listExternalSources() {
  const config = getConfig();
  return config.externalSources.map(s => ({
    owner: s.owner,
    repo: s.repo,
    subdir: s.subdir || '',
    url: s.url,
    branch: s.branch,
    cached: isSourceCached(s.owner, s.repo),
    cacheDir: getSourceCacheDir(s.owner, s.repo)
  }));
}

/**
 * Discover all skills from all external sources.
 * @returns {{owner: string, repo: string, projectPath: string, skillName: string, sourcePath: string, installed: boolean, symlinkName?: string}[]}
 */
function discoverExternalSkills() {
  const sources = listExternalSources();
  const installed = listExternalSkills();
  const skills = [];

  for (const source of sources) {
    if (!source.cached) continue;

    const found = findSkillsInSource(source.cacheDir, source.subdir);
    for (const skill of found) {
      const symlinkName = generateSymlinkName(source.owner, skill.projectPath, skill.skillName);
      const isInstalled = installed.some(s => s.symlinkName === symlinkName);

      skills.push({
        owner: source.owner,
        repo: source.repo,
        projectPath: skill.projectPath,
        skillName: skill.skillName,
        sourcePath: skill.path,
        installed: isInstalled,
        symlinkName
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
  installExternalSkill,
  uninstallExternalSkill,
  listExternalSkills,
  addExternalSource,
  removeExternalSource,
  listExternalSources,
  discoverExternalSkills,
  EXTERNAL_SOURCE_MARKER
};
// [AGC:END]
