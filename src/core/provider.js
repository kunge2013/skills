'use strict';

// [AGC:FILE] tool=Cc author=fangkun date=2026-08-26
/**
 * Provider abstraction layer for multi-agent skill management.
 *
 * Supports Claude Code and Pi Agent as fixed providers.
 * Each provider has its own skills directory and disabled directory.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * @typedef {Object} Provider
 * @property {string} name - Provider identifier ("claude-code" | "pi-agent")
 * @property {string} skillsDir - Absolute path to skills directory
 * @property {string} disabledDir - Absolute path to disabled directory
 * @property {boolean} enabled - Whether this provider is active
 */

/**
 * Get provider configuration by name.
 * Paths are computed at runtime to support testing with mocked os.homedir().
 * @param {string} name - Provider name
 * @returns {Provider | null}
 */
function getProviderConfig(name) {
  const homeDir = os.homedir();
  if (name === 'claude-code') {
    return {
      name: 'claude-code',
      skillsDir: path.join(homeDir, '.claude', 'skills'),
      disabledDir: path.join(homeDir, '.claude', 'skills', '.kungeskill-disabled'),
      enabled: true
    };
  }
  if (name === 'pi-agent') {
    return {
      name: 'pi-agent',
      skillsDir: path.join(homeDir, '.pi', 'agent', 'skills'),
      disabledDir: path.join(homeDir, '.pi', 'agent', 'skills', '.kungeskill-disabled'),
      enabled: true
    };
  }
  if (name === 'codex') {
    return {
      name: 'codex',
      skillsDir: path.join(homeDir, '.codex', 'skills'),
      disabledDir: path.join(homeDir, '.codex', 'skills', '.kungeskill-disabled'),
      enabled: true
    };
  }
  return null;
}

/**
 * Get all configured providers.
 * @returns {Provider[]}
 */
function getAllProviders() {
  return ['claude-code', 'pi-agent', 'codex'].map(name => getProviderConfig(name)).filter(Boolean);
}

/**
 * Get a provider by name.
 * @param {string} name - Provider name
 * @returns {Provider | null}
 */
function getProvider(name) {
  return getProviderConfig(name);
}

/**
 * Ensure provider directories exist.
 * Creates skillsDir and disabledDir if they don't exist.
 * @param {Provider} provider
 */
function ensureProviderDirs(provider) {
  if (!fs.existsSync(provider.skillsDir)) {
    fs.mkdirSync(provider.skillsDir, { recursive: true });
  }
  if (!fs.existsSync(provider.disabledDir)) {
    fs.mkdirSync(provider.disabledDir, { recursive: true });
  }
}

/**
 * Validate provider name.
 * @param {string} name
 * @returns {boolean}
 */
function isValidProvider(name) {
  return name === 'claude-code' || name === 'pi-agent' || name === 'codex';
}

module.exports = {
  getAllProviders,
  getProvider,
  getProviderConfig,
  ensureProviderDirs,
  isValidProvider
};
// [AGC:END]
