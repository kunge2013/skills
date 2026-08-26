'use strict';

// [AGC:START] tool=Cc author=fangkun
/**
 * Skill enable/disable management (User-scope only).
 *
 * Supports multiple providers (Claude Code and Pi Agent).
 * Each provider has its own skills directory.
 *
 * Skills are enabled/disabled by moving directories between:
 *   enabled:  <provider.skillsDir>/<skillName>/
 *   disabled: <provider.disabledDir>/<skillName>/
 *
 * External skills (from GitHub) use a special naming convention:
 *   <owner>__<project>__<skillName>  (multi-level: owner/project/skill)
 *   <owner>__<skillName>             (single-level: owner/skill)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseSymlinkName, EXTERNAL_SOURCE_MARKER } = require('./external-source');
const { getProviderByName } = require('./config');

const DISABLED_DIR_NAME = '.kungeskill-disabled';
const UNKNOWN_AUTHOR = 'Unknown';
const DEFAULT_PROVIDER = 'claude-code';

// ---------- helpers ----------

function readJsonSafe(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}

/** Absolute path of provider's skills directory */
function getUserSkillsDir(providerName = DEFAULT_PROVIDER) {
  const provider = getProviderByName(providerName);
  if (provider) {
    return provider.skillsDir;
  }
  // Fallback for backward compatibility
  return path.join(os.homedir(), '.claude', 'skills');
}

/** Hidden folder inside a skills dir where disabled skills are parked. */
function getDisabledDir(skillsDir) {
  return path.join(skillsDir, DISABLED_DIR_NAME);
}

/** Get the disabled directory for a provider */
function getProviderDisabledDir(providerName = DEFAULT_PROVIDER) {
  const provider = getProviderByName(providerName);
  if (provider) {
    return provider.disabledDir;
  }
  // Fallback for backward compatibility
  return path.join(os.homedir(), '.claude', 'skills', '.kungeskill-disabled');
}

/**
 * Parse a skill name to extract owner/project/skill structure.
 * External skills use format: owner__project__skill or owner__skill
 * @param {string} skillName
 * @returns {{isExternal: boolean, owner: string, projectPath: string, skillName: string}}
 */
function parseSkillStructure(skillName) {
  const parsed = parseSymlinkName(skillName);
  if (parsed) {
    return {
      isExternal: true,
      owner: parsed.owner,
      projectPath: parsed.projectPath,
      skillName: parsed.skillName
    };
  }
  return {
    isExternal: false,
    owner: UNKNOWN_AUTHOR,
    projectPath: '',
    skillName: skillName
  };
}

/**
 * Extract a top-level field from SKILL.md YAML frontmatter.
 * @returns {string|null}
 */
function frontmatterField(skillPath, field) {
  try {
    let content = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf-8');
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // strip UTF-8 BOM
    const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fm) return null;
    const m = fm[1].match(new RegExp('^' + field + ':\\s*(.+)$', 'm'));
    if (!m) return null;
    return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    return null;
  }
}

/** Read author (name) from a plugin.json. */
function authorFromPluginJson(pluginDir) {
  const j = readJsonSafe(path.join(pluginDir, 'plugin.json'));
  if (!j) return null;
  if (typeof j.author === 'string') return j.author;
  if (j.author && typeof j.author.name === 'string') return j.author.name;
  return null;
}

/**
 * Given a skill source directory, find its owning plugin directory when the
 * layout is `<plugin>/skills/<skillName>` (marketplace layout).
 * @returns {string|null}
 */
function pluginDirFromSkillSource(sourcePath) {
  const parent = path.dirname(path.resolve(sourcePath));
  if (path.basename(parent) === 'skills') {
    return path.dirname(parent);
  }
  return null;
}

/**
 * Resolve where an installed skill came from.
 * Symlink installs resolve through the link; copy installs read the manifest.
 * @returns {string|null} absolute source path, or null
 */
function resolveSourcePath(skillPath) {
  try {
    const st = fs.lstatSync(skillPath);
    if (st.isSymbolicLink()) {
      return fs.realpathSync(skillPath);
    }
  } catch {
    /* fall through to manifest */
  }
  const manifest = readJsonSafe(path.join(skillPath, '.skills-manifest.json'));
  if (manifest && typeof manifest.sourcePath === 'string' && fs.existsSync(manifest.sourcePath)) {
    return manifest.sourcePath;
  }
  // Check external source marker
  const extMarker = readJsonSafe(path.join(skillPath, EXTERNAL_SOURCE_MARKER));
  if (extMarker && typeof extMarker.sourcePath === 'string') {
    return extMarker.sourcePath;
  }
  return null;
}

/**
 * Determine the author/owner of an installed skill:
 *   1. External source marker (owner field)
 *   2. plugin.json of the marketplace plugin that owns the source
 *   3. `author:` field in SKILL.md frontmatter
 *   4. 'Unknown'
 */
function resolveSkillAuthor(skillPath, skillName) {
  // Check parsed structure first (for external skills)
  const parsed = parseSkillStructure(skillName);
  if (parsed.isExternal) {
    return parsed.owner;
  }

  const src = resolveSourcePath(skillPath);
  if (src) {
    const pluginDir = pluginDirFromSkillSource(src);
    if (pluginDir) {
      const author = authorFromPluginJson(pluginDir);
      if (author) return author;
    }
  }
  const localPluginDir = pluginDirFromSkillSource(skillPath);
  if (localPluginDir) {
    const author = authorFromPluginJson(localPluginDir);
    if (author) return author;
  }
  return frontmatterField(skillPath, 'author') || UNKNOWN_AUTHOR;
}

/** Detect install mode of a skill directory. */
function detectInstallMode(skillPath) {
  try {
    const st = fs.lstatSync(skillPath);
    if (st.isSymbolicLink()) return 'symlink';
  } catch {
    return 'unknown';
  }
  if (fs.existsSync(path.join(skillPath, '.skills-manifest.json'))) return 'copy';
  if (fs.existsSync(path.join(skillPath, EXTERNAL_SOURCE_MARKER))) return 'external';
  return 'manual';
}

// ---------- listing ----------

function makeSkillEntry(skillName, currentPath, skillsDir, enabled) {
  const parsed = parseSkillStructure(skillName);
  return {
    skillName,
    enabled,
    path: currentPath,
    skillsDir,
    installMode: detectInstallMode(currentPath),
    author: resolveSkillAuthor(currentPath, skillName),
    description: frontmatterField(currentPath, 'description') || '',
    // For external skills
    isExternal: parsed.isExternal,
    owner: parsed.owner,
    projectPath: parsed.projectPath
  };
}

/**
 * List all skills in user scope for a provider (enabled + disabled).
 * A directory qualifies as a skill when it contains SKILL.md.
 * Symlinks/junctions are followed; broken links are skipped.
 * @param {string} [providerName='claude-code'] - Provider name
 */
function listUserSkills(providerName = DEFAULT_PROVIDER) {
  const dir = getUserSkillsDir(providerName);
  const out = [];
  if (!fs.existsSync(dir)) return out;

  // Enabled: direct children of the skills dir
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    let isDir = false;
    try {
      isDir = fs.statSync(p).isDirectory(); // follows links
    } catch {
      continue; // broken link
    }
    if (!isDir) continue;
    if (!fs.existsSync(path.join(p, 'SKILL.md'))) continue;
    out.push(makeSkillEntry(entry.name, p, dir, true));
  }

  // Disabled: children of the hidden disabled dir
  const disabledDir = getDisabledDir(dir);
  if (fs.existsSync(disabledDir)) {
    for (const entry of fs.readdirSync(disabledDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const p = path.join(disabledDir, entry.name);
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      let isDir = false;
      try {
        isDir = fs.statSync(p).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;
      if (!fs.existsSync(path.join(p, 'SKILL.md'))) continue;
      out.push(makeSkillEntry(entry.name, p, dir, false));
    }
  }

  return out;
}

/**
 * Group skills by owner, then by project (for external skills).
 *
 * @param {string} [providerName='claude-code'] - Provider name
 * @returns {{
 *   provider: string,
 *   userSkillsDir: string,
 *   groups: {owner: string, total: number, enabledCount: number,
 *            projects: {projectPath: string, total: number, enabledCount: number,
 *                       skills: object[]}[]}[]}
 */
function listSkillToggleState(providerName = DEFAULT_PROVIDER) {
  const userSkillsDir = getUserSkillsDir(providerName);
  const all = listUserSkills(providerName);

  // Group by owner
  const ownerMap = new Map();
  for (const skill of all) {
    // Use skill.author if skill.owner is 'Unknown' or empty
    const owner = (skill.owner && skill.owner !== UNKNOWN_AUTHOR) ? skill.owner : (skill.author || UNKNOWN_AUTHOR);
    if (!ownerMap.has(owner)) ownerMap.set(owner, []);
    ownerMap.get(owner).push(skill);
  }

  // Build grouped structure
  const groups = [];
  for (const [owner, skills] of ownerMap.entries()) {
    // Group by project
    const projectMap = new Map();
    for (const skill of skills) {
      const projectPath = skill.projectPath || '_local';
      if (!projectMap.has(projectPath)) projectMap.set(projectPath, []);
      projectMap.get(projectPath).push(skill);
    }

    const projects = [];
    let groupTotal = 0;
    let groupEnabled = 0;

    for (const [projectPath, projectSkills] of projectMap.entries()) {
      const enabledCount = projectSkills.filter(s => s.enabled).length;
      projects.push({
        projectPath: projectPath === '_local' ? '' : projectPath,
        total: projectSkills.length,
        enabledCount,
        skills: projectSkills.sort((a, b) => a.skillName.localeCompare(b.skillName))
      });
      groupTotal += projectSkills.length;
      groupEnabled += enabledCount;
    }

    groups.push({
      owner,
      total: groupTotal,
      enabledCount: groupEnabled,
      projects: projects.sort((a, b) => a.projectPath.localeCompare(b.projectPath))
    });
  }

  return {
    provider: providerName,
    userSkillsDir,
    exists: fs.existsSync(userSkillsDir),
    groups: groups.sort((a, b) => a.owner.localeCompare(b.owner))
  };
}

// ---------- toggling ----------

function isValidSkillName(skillName) {
  return (
    typeof skillName === 'string' &&
    skillName.length > 0 &&
    path.basename(skillName) === skillName &&
    !skillName.startsWith('.') &&
    skillName !== DISABLED_DIR_NAME
  );
}

/**
 * Enable or disable a single skill by moving its directory between
 * `<provider.skillsDir>/<name>` and `<provider.disabledDir>/<name>`.
 *
 * @param {string} skillName
 * @param {boolean} enabled - true to enable, false to disable
 * @param {string} [providerName='claude-code'] - Provider name
 * @returns {{success: boolean, error?: string, already?: boolean, path?: string}}
 */
function setSkillEnabled(skillName, enabled, providerName = DEFAULT_PROVIDER) {
  if (!isValidSkillName(skillName)) {
    return { success: false, error: 'Invalid skill name: ' + skillName };
  }

  const dir = getUserSkillsDir(providerName);
  const disabledDir = getProviderDisabledDir(providerName);
  const enabledPath = path.join(dir, skillName);
  const disabledPath = path.join(disabledDir, skillName);
  const hasEnabled = fs.existsSync(enabledPath);
  const hasDisabled = fs.existsSync(disabledPath);

  try {
    if (enabled) {
      if (!hasDisabled) {
        if (hasEnabled) return { success: true, already: true, path: enabledPath };
        return { success: false, error: `Skill not found: ${skillName}` };
      }
      if (hasEnabled) {
        return {
          success: false,
          error: `Conflict: "${skillName}" exists both enabled and disabled`,
        };
      }
      fs.mkdirSync(dir, { recursive: true });
      fs.renameSync(disabledPath, enabledPath);
      return { success: true, path: enabledPath };
    }

    // disable
    if (!hasEnabled) {
      if (hasDisabled) return { success: true, already: true, path: disabledPath };
      return { success: false, error: `Skill not found: ${skillName}` };
    }
    fs.mkdirSync(disabledDir, { recursive: true });
    fs.renameSync(enabledPath, disabledPath);
    return { success: true, path: disabledPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Enable or disable every skill of an owner (across all projects).
 * Skills already in the target state are skipped.
 *
 * @param {string} owner
 * @param {boolean} enabled
 * @param {string} [providerName='claude-code'] - Provider name
 * @returns {{success: boolean, data: {changed: number, results: any[]}, error?: string}}
 */
function setOwnerSkillsEnabled(owner, enabled, providerName = DEFAULT_PROVIDER) {
  if (!owner) return { success: false, error: 'owner is required', data: { changed: 0, results: [] } };
  const state = listSkillToggleState(providerName);
  const results = [];

  for (const group of state.groups) {
    if (group.owner !== owner) continue;
    for (const project of group.projects) {
      for (const skill of project.skills) {
        if (skill.enabled === enabled) continue;
        const r = setSkillEnabled(skill.skillName, enabled, providerName);
        results.push({ skillName: skill.skillName, success: r.success, error: r.error });
      }
    }
  }
  return {
    success: results.every(r => r.success),
    data: { changed: results.length, results },
  };
}

/**
 * Enable or disable every skill in a project (for a specific owner).
 *
 * @param {string} owner
 * @param {string} projectPath
 * @param {boolean} enabled
 * @param {string} [providerName='claude-code'] - Provider name
 * @returns {{success: boolean, data: {changed: number, results: any[]}, error?: string}}
 */
function setProjectSkillsEnabled(owner, projectPath, enabled, providerName = DEFAULT_PROVIDER) {
  if (!owner) return { success: false, error: 'owner is required', data: { changed: 0, results: [] } };
  const state = listSkillToggleState(providerName);
  const results = [];

  for (const group of state.groups) {
    if (group.owner !== owner) continue;
    for (const project of group.projects) {
      if (project.projectPath !== projectPath) continue;
      for (const skill of project.skills) {
        if (skill.enabled === enabled) continue;
        const r = setSkillEnabled(skill.skillName, enabled, providerName);
        results.push({ skillName: skill.skillName, success: r.success, error: r.error });
      }
    }
  }
  return {
    success: results.every(r => r.success),
    data: { changed: results.length, results },
  };
}

module.exports = {
  DISABLED_DIR_NAME,
  UNKNOWN_AUTHOR,
  DEFAULT_PROVIDER,
  getUserSkillsDir,
  getDisabledDir,
  getProviderDisabledDir,
  listSkillToggleState,
  setSkillEnabled,
  setOwnerSkillsEnabled,
  setProjectSkillsEnabled,
  resolveSkillAuthor,
  parseSkillStructure,
};
// [AGC:END]
