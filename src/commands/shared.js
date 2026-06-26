'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Find the project's .claude/skills/ directory.
 * Walks up from cwd until it finds a .git boundary or existing .claude/skills/.
 * Will not cross project boundaries (stops at .git root).
 *
 * @param {string} [cwd] - Starting directory (defaults to process.cwd())
 * @returns {string} Absolute path to .claude/skills/
 */
function findProjectSkillsDir(cwd) {
  cwd = cwd || process.cwd();
  let dir = path.resolve(cwd);
  const root = path.parse(dir).root;

  // First pass: find the project root (directory with .git)
  let projectRoot = null;
  let searchDir = dir;
  while (searchDir !== root) {
    if (fs.existsSync(path.join(searchDir, '.git'))) {
      projectRoot = searchDir;
      break;
    }
    searchDir = path.dirname(searchDir);
  }

  // If no .git found, use cwd as project root
  if (!projectRoot) {
    projectRoot = cwd;
  }

  // Use .claude/skills/ at the project root
  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
  return skillsDir;
}

module.exports = {
  findProjectSkillsDir
};
