'use strict';

const fs = require('fs');
const path = require('path');
const { getMarketplaceSourceDir, isCacheValid, hasBundledPlugins, getAllMarketplaceDirs } = require('../core/cache');
const { parseMarketplace, listAllSkillsMerged } = require('../core/registry');
const { findProjectSkillsDir } = require('./shared');
const logger = require('../utils/logger');

function cmdList(opts) {
  if (!isCacheValid() && !hasBundledPlugins()) {
    logger.error('Marketplace not available. Run "kungeskill init" first.');
    process.exit(1);
  }

  const showInstalled = opts.installed;

  if (showInstalled) {
    // Show only installed skills
    const skillsDir = findProjectSkillsDir();
    if (!fs.existsSync(skillsDir)) {
      logger.info('No skills installed in this project.');
      return;
    }

    const installed = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() || e.isSymbolicLink())
      .map(e => e.name);

    if (installed.length === 0) {
      logger.info('No skills installed in this project.');
      return;
    }

    logger.header('Installed skills in this project:');
    console.log();
    for (const name of installed) {
      console.log(`  ${name}`);
    }
    return;
  }

  // Show all available skills merged from all sources (git cache + bundled)
  const sourceDirs = getAllMarketplaceDirs();
  const skills = listAllSkillsMerged(sourceDirs);

  if (skills.length === 0) {
    logger.info('No skills found in marketplace.');
    return;
  }

  // Group by plugin
  const grouped = {};
  for (const skill of skills) {
    if (!grouped[skill.pluginName]) {
      grouped[skill.pluginName] = [];
    }
    grouped[skill.pluginName].push(skill.skillName);
  }

  logger.header('Available skills:');
  console.log();

  const headers = ['PLUGIN', 'SKILLS'];
  const rows = [];

  let first = true;
  for (const [plugin, skillNames] of Object.entries(grouped)) {
    if (!first) {
      rows.push(['', '']);
    }
    rows.push([plugin, skillNames[0]]);
    for (let i = 1; i < skillNames.length; i++) {
      rows.push(['', skillNames[i]]);
    }
    first = false;
  }

  logger.table(headers, rows);
}

module.exports = { cmdList };
