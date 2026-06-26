// electron/main/handlers/symlink.js
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { createSkillSymlink, removeSkillSymlink, getSymlinkStatus } = require('../../../src/core/symlink.js');
const { findProjectSkillsDir } = require('../../../src/commands/shared.js');

function installSkill(skillName, projectPath) {
  const skillsDir = findProjectSkillsDir(projectPath || undefined);
  const linkPath = path.join(skillsDir, skillName);
  const { getAllMarketplaceDirs } = require('../../../src/core/cache.js');
  const { findSkillMerged } = require('../../../src/core/registry.js');
  const sourceDirs = getAllMarketplaceDirs();
  const skill = findSkillMerged(sourceDirs, skillName);
  if (!skill) return { success: false, error: `Skill '${skillName}' not found in marketplace` };
  createSkillSymlink(skill.sourcePath, linkPath);
  return { success: true, linkPath, targetPath: skill.sourcePath };
}

function uninstallSkill(skillName, projectPath) {
  const skillsDir = findProjectSkillsDir(projectPath);
  const linkPath = path.join(skillsDir, skillName);
  removeSkillSymlink(linkPath);
  return { success: true };
}

function checkSkillStatus(skillName) {
  let cwd = process.cwd();
  let projectRoot = cwd;
  while (cwd !== path.parse(cwd).root) {
    if (fs.existsSync(path.join(cwd, '.git'))) { projectRoot = cwd; break; }
    cwd = path.dirname(cwd);
  }
  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  const linkPath = path.join(skillsDir, skillName);
  if (!fs.existsSync(linkPath)) return { success: true, data: { installed: false, skillName } };
  const status = getSymlinkStatus(linkPath);
  return { success: true, data: { installed: true, skillName, linkPath, isLink: status.isLink, isValid: status.isValid, hasSkillMd: status.hasSkillMd } };
}

ipcMain.handle('symlink:install', (_event, skillName, projectPath) => {
  try { const result = installSkill(skillName, projectPath); return result; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('symlink:uninstall', (_event, skillName, projectPath) => {
  try { const result = uninstallSkill(skillName, projectPath); return result; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('symlink:status', (_event, skillName) => {
  try { const result = checkSkillStatus(skillName); return result; }
  catch (err) { return { success: false, error: err.message }; }
});
