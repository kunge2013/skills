'use strict';

const path = require('path');
const { getConfig, saveConfig } = require('../core/config');
const { getCacheDir, ensureCacheDir, isCacheValid } = require('../core/cache');
const { cloneRepo } = require('../utils/git');
const logger = require('../utils/logger');

async function cmdInit() {
  const config = getConfig();

  if (isCacheValid()) {
    logger.success('Marketplace cache already initialized');
    logger.dim(`  Location: ${getCacheDir()}`);
    return;
  }

  const { url, branch } = config.marketplace;
  logger.info(`Cloning marketplace from ${url} (${branch})...`);

  ensureCacheDir();

  try {
    await cloneRepo(url, getCacheDir(), branch);

    config.marketplace.cloned = true;
    config.marketplace.lastSync = new Date().toISOString();
    saveConfig(config);

    logger.success('Marketplace cached');
    logger.dim(`  Location: ${getCacheDir()}`);
  } catch (err) {
    // Clean up on failure
    const fs = require('fs');
    const cacheDir = getCacheDir();
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
    logger.error(`Failed to clone marketplace: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { cmdInit };
