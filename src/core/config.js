'use strict';

// [AGC:START] tool=Cc author=fangkun
const fs = require('fs');
const path = require('path');
const os = require('os');

const KUNGESKILLS_DIR = path.join(os.homedir(), '.kungeskills');
const CONFIG_PATH = path.join(KUNGESKILLS_DIR, 'config.json');

const DEFAULT_PROVIDER = 'claude-code';
const ALL_PROVIDERS = ['claude-code', 'pi-agent', 'codex'];

/**
 * Get default providers configuration.
 * Paths are computed at runtime to support testing with mocked os.homedir().
 * @returns {Array<{name: string, skillsDir: string, disabledDir: string, enabled: boolean}>}
 */
function getDefaultProviders() {
  const homeDir = os.homedir();
  return [
    {
      name: 'claude-code',
      skillsDir: path.join(homeDir, '.claude', 'skills'),
      disabledDir: path.join(homeDir, '.claude', 'skills', '.kungeskill-disabled'),
      enabled: true
    },
    {
      name: 'pi-agent',
      skillsDir: path.join(homeDir, '.pi', 'agent', 'skills'),
      disabledDir: path.join(homeDir, '.pi', 'agent', 'skills', '.kungeskill-disabled'),
      enabled: true
    },
    {
      name: 'codex',
      skillsDir: path.join(homeDir, '.codex', 'skills'),
      disabledDir: path.join(homeDir, '.codex', 'skills', '.kungeskill-disabled'),
      enabled: true
    }
  ];
}

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
  // Agent providers (Claude Code + Pi Agent)
  // Note: providers field is computed at runtime via getDefaultProviders()
  // External skill sources (GitHub repos)
  // Format: [{ owner: 'mattpocock', repo: 'skills', url: '...', branch: 'main', providers: ['claude-code', 'pi-agent'] }]
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
  // Never persist providers — they are always computed at runtime.
  const { providers: _omit, ...rest } = config;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(rest, null, 2), 'utf-8');
}

function getConfig() {
  const existing = loadConfig();
  if (existing) {
    // Merge with defaults to ensure new fields exist
    const config = {
      marketplace: { ...DEFAULT_CONFIG.marketplace, ...existing.marketplace },
      git: {
        proxy: {
          ...DEFAULT_CONFIG.git.proxy,
          ...(existing.git && existing.git.proxy || {})
        }
      },
      // Providers are always computed at runtime (not persisted) to support
      // os.homedir() mocking in tests and to keep paths dynamic.
      providers: getDefaultProviders(),
      externalSources: existing.externalSources || DEFAULT_CONFIG.externalSources
    };
    return config;
  }
  return { ...DEFAULT_CONFIG, providers: getDefaultProviders() };
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

/**
 * Get all configured providers.
 * @returns {Array<{name: string, skillsDir: string, disabledDir: string, enabled: boolean}>}
 */
function getProviders() {
  const config = getConfig();
  return config.providers || getDefaultProviders();
}

/**
 * Get a provider by name.
 * @param {string} name - Provider name ("claude-code" | "pi-agent")
 * @returns {{name: string, skillsDir: string, disabledDir: string, enabled: boolean} | null}
 */
function getProviderByName(name) {
  const providers = getProviders();
  return providers.find(p => p.name === name) || null;
}

module.exports = {
  getKungeskillsDir,
  loadConfig,
  saveConfig,
  getConfig,
  updateConfig,
  getExternalSourceCacheDir,
  getProviders,
  getProviderByName,
  getDefaultProviders,
  CONFIG_PATH,
  KUNGESKILLS_DIR,
  DEFAULT_PROVIDER,
  ALL_PROVIDERS
};
// [AGC:END]
