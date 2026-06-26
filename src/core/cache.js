'use strict';

const fs = require('fs');
const path = require('path');
const { getKungeskillsDir } = require('./config');

// Bundled plugins directory (shipped with the npm package)
const BUNDLED_DIR = path.resolve(__dirname, '..', '..', 'plugins');
const BUNDLED_MANIFEST = path.resolve(__dirname, '..', '..', '.claude-plugin', 'marketplace.json');

function getCacheDir() {
  return path.join(getKungeskillsDir(), 'cache', 'marketplace');
}

function ensureCacheDir() {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function isCacheValid() {
  const cacheDir = getCacheDir();
  const gitDir = path.join(cacheDir, '.git');
  return fs.existsSync(gitDir);
}

/**
 * Check if bundled plugins exist (shipped with npm package).
 * @returns {boolean}
 */
function hasBundledPlugins() {
  return fs.existsSync(BUNDLED_MANIFEST) && fs.existsSync(BUNDLED_DIR);
}

/**
 * Get the bundled plugins directory path.
 * @returns {string}
 */
function getBundledDir() {
  return path.resolve(__dirname, '..', '..');
}

/**
 * Get the effective marketplace source directory.
 * Priority: git cache > bundled plugins
 * @returns {string}
 */
function getMarketplaceSourceDir() {
  if (isCacheValid()) {
    return getCacheDir();
  }
  if (hasBundledPlugins()) {
    return getBundledDir();
  }
  return getCacheDir();
}

/**
 * Get all marketplace source directories (for merging skills from multiple sources).
 * Returns both git cache and bundled if both exist.
 * @returns {string[]}
 */
function getAllMarketplaceDirs() {
  const dirs = [];
  if (isCacheValid()) {
    dirs.push(getCacheDir());
  }
  if (hasBundledPlugins()) {
    const bundled = getBundledDir();
    if (!dirs.includes(bundled)) {
      dirs.push(bundled);
    }
  }
  return dirs;
}

module.exports = {
  getCacheDir,
  ensureCacheDir,
  isCacheValid,
  hasBundledPlugins,
  getBundledDir,
  getMarketplaceSourceDir,
  getAllMarketplaceDirs
};
