'use strict';

const fs = require('fs');
const path = require('path');
const { getMarketplaceSourceDir, isCacheValid, hasBundledPlugins, getAllMarketplaceDirs } = require('../core/cache');
const { findSkillMerged } = require('../core/registry');
const { createSkillSymlink, canCreateJunction, copyDirRecursive } = require('../core/symlink');
const { findProjectSkillsDir } = require('./shared');
const logger = require('../utils/logger');

async function cmdAdd(skillName, opts) {
  const force = opts.force || false;

  // Ensure cache or bundled plugins are available
  if (!isCacheValid() && !hasBundledPlugins()) {
    logger.info('Marketplace cache not initialized. Running init...');
    const { cmdInit } = require('./init');
    await cmdInit();
  }

  // Find the skill across all sources (git cache + bundled)
  const sourceDirs = getAllMarketplaceDirs();
  const skill = findSkillMerged(sourceDirs, skillName);

  if (!skill) {
    logger.error(`Skill '${skillName}' not found in marketplace.`);
    logger.info('Run "kungeskill list" to see available skills.');
    process.exit(1);
  }

  // Verify source has SKILL.md
  const skillMdPath = path.join(skill.sourcePath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    logger.error(`Skill source directory is missing SKILL.md: ${skill.sourcePath}`);
    process.exit(1);
  }

  // Find or create project skills directory
  const skillsDir = findProjectSkillsDir();
  const linkPath = path.join(skillsDir, skillName);

  // Check if already installed
  if (fs.existsSync(linkPath)) {
    if (force) {
      logger.info(`Skill '${skillName}' already installed. Reinstalling (--force)...`);
      fs.rmSync(linkPath, { recursive: true, force: true });
    } else {
      logger.warn(`Skill '${skillName}' is already installed.`);
      logger.info('Use --force to reinstall.');
      return;
    }
  }

  // Try symlink first, fallback to copy on cross-drive Windows
  try {
    createSkillSymlink(skill.sourcePath, linkPath);
    logger.success(`Installed ${skillName}`);
    logger.dim(`  Link: ${linkPath}`);
    logger.dim(`  Source: ${skill.sourcePath} (symlink)`);
  } catch (err) {
    // Fallback: copy directory if symlink fails (cross-drive on Windows)
    if (err.message.includes('across drives')) {
      logger.warn(`Cannot create symlink (cross-drive). Falling back to copy mode.`);
      logger.warn(`  Updates will NOT auto-sync. Run "kungeskill add --force ${skillName}" after update.`);
      copyDirRecursive(skill.sourcePath, linkPath);
      logger.success(`Installed ${skillName} (copied)`);
      logger.dim(`  Path: ${linkPath}`);
    } else {
      logger.error(`Failed to install '${skillName}': ${err.message}`);
      process.exit(1);
    }
  }
}

module.exports = { cmdAdd };
