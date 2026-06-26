'use strict';

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
  }
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
      marketplace: { ...DEFAULT_CONFIG.marketplace, ...existing.marketplace }
    };
  }
  return { ...DEFAULT_CONFIG };
}

module.exports = {
  getKungeskillsDir,
  loadConfig,
  saveConfig,
  getConfig,
  CONFIG_PATH,
  KUNGESKILLS_DIR
};
