'use strict';

const fs = require('fs');
const path = require('path');
const { getConfig } = require('../core/config');
const { getCacheDir, isCacheValid } = require('../core/cache');
const { parseMarketplace, listAllSkills } = require('../core/registry');
const { getSymlinkStatus } = require('../core/symlink');
const { findProjectSkillsDir } = require('./shared');
const logger = require('../utils/logger');

function cmdDoctor() {
  const config = getConfig();
  const cacheDir = getCacheDir();
  let issues = 0;
  let warnings = 0;

  logger.header('kungeskill doctor');
  console.log();

  // Check 1: Cache directory
  logger.header('Cache:');
  if (isCacheValid()) {
    logger.status('  \u2713', `Cache directory: ${cacheDir}`);
  } else {
    logger.status('  \u2717', `Cache directory missing or not a git repo`);
    issues++;
    logger.warn('  Run "kungeskill init" to initialize.');
  }
  console.log();

  // Check 2: Marketplace manifest
  logger.header('Marketplace:');
  if (isCacheValid()) {
    const marketplace = parseMarketplace(cacheDir);
    if (marketplace && marketplace.plugins) {
      const pluginCount = marketplace.plugins.length;
      const skills = listAllSkills(marketplace, cacheDir);
      logger.status('  \u2713', `Manifest valid (${pluginCount} plugins, ${skills.length} skills)`);
    } else {
      logger.status('  \u2717', 'Invalid marketplace manifest');
      issues++;
    }
  } else {
    logger.status('  \u2717', 'Cannot check manifest (cache not initialized)');
    issues++;
  }

  if (config.marketplace.lastSync) {
    logger.status('  ', `Last synced: ${new Date(config.marketplace.lastSync).toLocaleString()}`);
  } else {
    logger.status('  ', 'Never synced');
  }
  console.log();

  // Check 3: Project skills
  logger.header('Project Skills:');
  const skillsDir = findProjectSkillsDir();

  if (!fs.existsSync(skillsDir)) {
    logger.status('  ', 'No skills installed in this project');
    console.log();
    logger.header('Summary:');
    logger.status('  ', `${issues} issues, ${warnings} warnings`);
    return;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills = entries
    .filter(e => e.isDirectory() || e.isSymbolicLink())
    .map(e => e.name);

  let okCount = 0;
  let brokenCount = 0;

  for (const name of skills) {
    const linkPath = path.join(skillsDir, name);
    const status = getSymlinkStatus(linkPath);

    if (!status.exists) {
      logger.status('  \u2717', `${name}: BROKEN (target not found)`);
      brokenCount++;
      issues++;
    } else if (!status.isLink) {
      logger.status('  \u26a0', `${name}: not a symlink (may be a copied directory)`);
      warnings++;
    } else if (status.isValid && status.hasSkillMd) {
      okCount++;
    } else {
      logger.status('  \u26a0', `${name}: SKILL.md missing`);
      warnings++;
    }
  }

  if (skills.length > 0 && brokenCount === 0) {
    logger.status('  \u2713', `${okCount} skills installed, all valid`);
  }
  console.log();

  // Summary
  logger.header('Summary:');
  logger.status('  ', `${skills.length} total, ${okCount} ok, ${brokenCount} broken, ${warnings} warnings, ${issues} issues`);

  if (issues > 0 || warnings > 0) {
    console.log();
    if (brokenCount > 0) {
      logger.info('Run "kungeskill remove <name>" to clean broken links');
    }
    if (!isCacheValid()) {
      logger.info('Run "kungeskill init" to initialize the marketplace cache');
    }
  }
}

module.exports = { cmdDoctor };
