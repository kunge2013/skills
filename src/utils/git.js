'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Clone a git repository to a target path.
 * @param {string} url - Repository URL
 * @param {string} targetPath - Destination directory
 * @param {string} branch - Branch to clone
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function cloneRepo(url, targetPath, branch = 'main') {
  const cmd = `git clone --branch "${branch}" "${url}" "${targetPath}"`;
  return execAsync(cmd);
}

/**
 * Pull the latest changes in a git repository.
 * @param {string} cwd - Working directory (repo root)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function pullRepo(cwd) {
  const cmd = 'git pull';
  return execAsync(cmd, { cwd });
}

module.exports = {
  cloneRepo,
  pullRepo
};
