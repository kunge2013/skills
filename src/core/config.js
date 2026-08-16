'use strict';

// [AGC:START] tool=Cc author=fangkun
const fs = require('fs');
const path = require('path');
const os = require('os');

const KUNGESKILLS_DIR = path.join(os.homedir(), '.kungeskills');
const CONFIG_PATH = path.join(KUNGESKILLS_DIR, 'config.json');

const DEFAULT_CONFIG = {
  marketplace: {
    url: 'https://github.com/kunge2013/skills',
    branch: 'main',
    cloned: false,
    lastSync: null
  },
  // Git proxy configuration (disabled by default)
  git: {
    proxy: {
      enabled: false,
      url: '' // e.g., 'http://127.0.0.1:7890'
    }
  },
  // External skill sources (GitHub repos)
  // Format: [{ owner: 'mattpocock', repo: 'skills', url: '...', branch: 'main', alias: 'mattpocock' }]
  externalSources: []
};

function getKungeskillsDir() {
  return KUNGESKILLS_DIR;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveConfig(config) {
  if (!fs.existsSync(KUNGESKILLS_DIR)) {
    fs.mkdirSync(KUNGESKILLS_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function getConfig() {
  const existing = loadConfig();
  if (existing) {
    // Merge with defaults to ensure new fields exist
    return {
      marketplace: { ...DEFAULT_CONFIG.marketplace, ...existing.marketplace },
      git: {
        proxy: {
          ...DEFAULT_CONFIG.git.proxy,
          ...(existing.git && existing.git.proxy || {})
        }
      },
      externalSources: existing.externalSources || DEFAULT_CONFIG.externalSources
    };
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Update partial config fields (shallow merge at top level).
 * @param {object} updates
 */
function updateConfig(updates) {
  const current = getConfig();
  const merged = { ...current, ...updates };
  saveConfig(merged);
  return merged;
}

/**
 * Get the directory where external skills are cached.
 * @param {string} owner - GitHub owner/org name
 * @param {string} repo - Repository name
 * @returns {string} Absolute path
 */
function getExternalSourceCacheDir(owner, repo) {
  return path.join(KUNGESKILLS_DIR, 'cache', 'external', owner, repo);
}

module.exports = {
  getKungeskillsDir,
  loadConfig,
  saveConfig,
  getConfig,
  updateConfig,
  getExternalSourceCacheDir,
  CONFIG_PATH,
  KUNGESKILLS_DIR
};
// [AGC:END]
