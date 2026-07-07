'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse marketplace.json from a source directory.
 * @param {string} sourceDir - Path to the marketplace source root
 * @returns {object|null} Parsed marketplace data or null
 */
function parseMarketplace(sourceDir) {
  const manifestPath = path.join(sourceDir, '.claude-plugin', 'marketplace.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * List all skills from a single source directory.
 * @param {object} marketplace - Parsed marketplace.json
 * @param {string} sourceDir - Path to the marketplace source root
 * @returns {Array<{skillName: string, pluginName: string, sourcePath: string}>}
 */
function listSkillsFromSource(marketplace, sourceDir) {
  if (!marketplace || !marketplace.plugins) return [];

  const skills = [];
  for (const plugin of marketplace.plugins) {
    const skillsDir = path.resolve(sourceDir, plugin.source, 'skills');
    if (!fs.existsSync(skillsDir)) continue;

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name);
        if (fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
          skills.push({
            skillName: entry.name,
            pluginName: plugin.name,
            sourcePath: skillPath
          });
        }
      }
    }
  }
  return skills;
}

/**
 * List all skills from a parsed marketplace manifest (single source).
 * @param {object} marketplace - Parsed marketplace.json
 * @param {string} cacheDir - Path to the marketplace cache root (for resolving source paths)
 * @returns {Array<{skillName: string, pluginName: string, sourcePath: string}>}
 */
function listAllSkills(marketplace, cacheDir) {
  return listSkillsFromSource(marketplace, cacheDir);
}

/**
 * List all skills merged from multiple source directories.
 * Later sources add skills not already found in earlier sources (no duplicates).
 * @param {string[]} sourceDirs - Array of marketplace source directories
 * @returns {Array<{skillName: string, pluginName: string, sourcePath: string}>}
 */
function listAllSkillsMerged(sourceDirs) {
  const seen = new Set();
  const merged = [];

  for (const dir of sourceDirs) {
    const marketplace = parseMarketplace(dir);
    if (!marketplace) continue;

    const skills = listSkillsFromSource(marketplace, dir);
    for (const skill of skills) {
      if (!seen.has(skill.skillName)) {
        seen.add(skill.skillName);
        merged.push(skill);
      }
    }
  }
  return merged;
}

/**
 * Find a specific skill by name across multiple sources.
 * @param {string[]} sourceDirs - Array of marketplace source directories
 * @param {string} skillName - Skill name to find
 * @returns {object|null} { skillName, pluginName, sourcePath } or null
 */
function findSkillMerged(sourceDirs, skillName) {
  for (const dir of sourceDirs) {
    const marketplace = parseMarketplace(dir);
    if (!marketplace) continue;

    const skills = listSkillsFromSource(marketplace, dir);
    const found = skills.find(s => s.skillName === skillName);
    if (found) return found;
  }
  return null;
}

/**
 * Find a specific skill by name (single source).
 * @param {object} marketplace - Parsed marketplace.json
 * @param {string} cacheDir - Path to the marketplace cache root
 * @param {string} skillName - Skill name to find
 * @returns {object|null} { skillName, pluginName, sourcePath } or null
 */
function findSkill(marketplace, cacheDir, skillName) {
  const skills = listAllSkills(marketplace, cacheDir);
  return skills.find(s => s.skillName === skillName) || null;
}

module.exports = {
  parseMarketplace,
  listSkillsFromSource,
  listAllSkills,
  listAllSkillsMerged,
  findSkill,
  findSkillMerged
};
