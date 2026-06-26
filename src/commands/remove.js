'use strict';

const fs = require('fs');
const path = require('path');
const { removeSkillSymlink } = require('../core/symlink');
const { findProjectSkillsDir } = require('./shared');
const logger = require('../utils/logger');

function cmdRemove(skillName) {
  const skillsDir = findProjectSkillsDir();
  const linkPath = path.join(skillsDir, skillName);

  if (!fs.existsSync(linkPath)) {
    logger.error(`Skill '${skillName}' is not installed in this project.`);
    process.exit(1);
  }

  // Check if it's a symlink
  const stat = fs.lstatSync(linkPath);
  if (stat.isSymbolicLink()) {
    // Safe to remove — it's a symlink
    try {
      removeSkillSymlink(linkPath);
      logger.success(`Removed ${skillName}`);
    } catch (err) {
      logger.error(`Failed to remove '${skillName}': ${err.message}`);
      process.exit(1);
    }
  } else if (stat.isDirectory()) {
    // Not a symlink — could be a copied directory. Remove with warning.
    logger.warn(`'${skillName}' is not a symlink (copied directory). Removing anyway.`);
    fs.rmSync(linkPath, { recursive: true, force: true });
    logger.success(`Removed ${skillName}`);
  } else {
    logger.error(`'${skillName}' is an unexpected file type, refusing to remove.`);
    process.exit(1);
  }
}

module.exports = { cmdRemove };
