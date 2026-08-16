'use strict';

// [AGC:START] tool=Cc author=fangkun
const { exec } = require('child_process');
const { promisify } = require('util');
const { getConfig } = require('../core/config');

const execAsync = promisify(exec);

/**
 * Build git proxy option string if proxy is configured and enabled.
 * @returns {string} Empty string or '-c http.proxy=<url>'
 */
function getProxyOption() {
  const config = getConfig();
  const proxy = config.git && config.git.proxy;
  if (proxy && proxy.enabled && proxy.url) {
    return `-c http.proxy=${proxy.url}`;
  }
  return '';
}

/**
 * Clone a git repository to a target path.
 * Supports optional HTTP proxy via config.git.proxy.
 * @param {string} url - Repository URL
 * @param {string} targetPath - Destination directory
 * @param {string} branch - Branch to clone
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function cloneRepo(url, targetPath, branch = 'main') {
  const proxyOpt = getProxyOption();
  const cmd = `git clone ${proxyOpt} --branch "${branch}" "${url}" "${targetPath}"`.trim().replace(/\s+/g, ' ');
  return execAsync(cmd);
}

/**
 * Pull the latest changes in a git repository.
 * @param {string} cwd - Working directory (repo root)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function pullRepo(cwd) {
  const proxyOpt = getProxyOption();
  const cmd = `git pull ${proxyOpt}`.trim();
  return execAsync(cmd, { cwd });
}

module.exports = {
  cloneRepo,
  pullRepo,
  getProxyOption
};
// [AGC:END]
