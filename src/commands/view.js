'use strict';

const fs = require('fs');
const path = require('path');
const { getSymlinkStatus } = require('../core/symlink');
const { findProjectSkillsDir } = require('./shared');
const logger = require('../utils/logger');

function cmdView() {
  const skillsDir = findProjectSkillsDir();

  if (!fs.existsSync(skillsDir)) {
    logger.info('No skills installed in this project.');
    return;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills = entries
    .filter(e => e.isDirectory() || e.isSymbolicLink())
    .map(e => e.name);

  if (skills.length === 0) {
    logger.info('No skills installed in this project.');
    return;
  }

  logger.header(`Skills installed in this project:`);
  console.log();

  const headers = ['NAME', 'STATUS', 'TARGET'];
  const rows = [];

  for (const name of skills) {
    const linkPath = path.join(skillsDir, name);
    const status = getSymlinkStatus(linkPath);

    let statusIcon;
    if (!status.exists) {
      statusIcon = '\u2717 broken'; // ✗
    } else if (status.isValid && status.hasSkillMd) {
      statusIcon = '\u2713 ok'; // ✓
    } else if (status.isValid) {
      statusIcon = '\u26a0 no SKILL.md'; // ⚠
    } else {
      statusIcon = '? unknown';
    }

    const target = status.target || '(not found)';
    // Show relative path for readability
    const homeDir = require('os').homedir();
    const displayTarget = target.startsWith(homeDir)
      ? target.replace(homeDir, '~')
      : target;

    rows.push([name, statusIcon, displayTarget]);
  }

  logger.table(headers, rows);
}

module.exports = { cmdView };
