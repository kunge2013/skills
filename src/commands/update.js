'use strict';

const { getConfig, saveConfig } = require('../core/config');
const { getCacheDir, isCacheValid } = require('../core/cache');
const { pullRepo } = require('../utils/git');
const logger = require('../utils/logger');

async function cmdUpdate() {
  if (!isCacheValid()) {
    logger.error('Marketplace cache not initialized. Run "kungeskill init" first.');
    process.exit(1);
  }

  const config = getConfig();
  logger.info('Updating marketplace cache...');

  try {
    const result = await pullRepo(getCacheDir());

    config.marketplace.lastSync = new Date().toISOString();
    saveConfig(config);

    // Parse output for summary
    const output = (result.stdout || '').trim();
    if (output) {
      logger.dim(`  ${output}`);
    }

    logger.success('Marketplace updated');
    logger.info('Symlinks automatically point to updated content. No reinstallation needed.');
  } catch (err) {
    logger.error(`Failed to update marketplace: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { cmdUpdate };
