'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Check if target and link are on the same drive (Windows only).
 * @param {string} targetPath
 * @param {string} linkPath
 * @returns {boolean}
 */
function canCreateJunction(targetPath, linkPath) {
  if (process.platform !== 'win32') return true;
  return path.parse(path.resolve(targetPath)).root === path.parse(path.resolve(linkPath)).root;
}

/**
 * Create a cross-platform symlink for a skill.
 * On Windows: uses junction points (no admin required).
 * On Linux/macOS: uses standard directory symlinks.
 *
 * @param {string} targetAbsPath - Absolute path to the skill source directory
 * @param {string} linkAbsPath - Absolute path for the symlink
 * @returns {boolean} True on success
 * @throws {Error} On failure
 */
function createSkillSymlink(targetAbsPath, linkAbsPath) {
  // Ensure target exists
  if (!fs.existsSync(targetAbsPath)) {
    throw new Error(`Target does not exist: ${targetAbsPath}`);
  }

  // Windows cross-drive check
  if (process.platform === 'win32' && !canCreateJunction(targetAbsPath, linkAbsPath)) {
    throw new Error(
      `Cannot create junction across drives: ${path.parse(targetAbsPath).root} -> ${path.parse(linkAbsPath).root}. ` +
      'Move the cache to the same drive as the project, or use a different approach.'
    );
  }

  const opts = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(path.resolve(targetAbsPath), linkAbsPath, opts);
  return true;
}

/**
 * Remove a skill symlink safely (does not touch the source).
 * @param {string} linkAbsPath
 */
function removeSkillSymlink(linkAbsPath) {
  if (!fs.existsSync(linkAbsPath)) {
    return false;
  }
  // lstat to check if it's a symlink itself
  const stat = fs.lstatSync(linkAbsPath);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(linkAbsPath);
    return true;
  }
  // Not a symlink — don't delete a real directory
  throw new Error(`Not a symlink, refusing to delete: ${linkAbsPath}`);
}

/**
 * Check if a path is a valid symlink (target exists).
 * @param {string} linkAbsPath
 * @returns {boolean}
 */
function isSymlinkValid(linkAbsPath) {
  if (!fs.existsSync(linkAbsPath)) return false;
  const stat = fs.lstatSync(linkAbsPath);
  if (!stat.isSymbolicLink()) return false;
  return fs.existsSync(linkAbsPath); // follows the link
}

/**
 * Get detailed status of a skill symlink.
 * @param {string} linkAbsPath
 * @returns {{isLink: boolean, isValid: boolean, target: string|null, exists: boolean, hasSkillMd: boolean}}
 */
function getSymlinkStatus(linkAbsPath) {
  const result = {
    isLink: false,
    isValid: false,
    target: null,
    exists: false,
    hasSkillMd: false
  };

  if (!fs.existsSync(linkAbsPath) && !fs.lstatSync(linkAbsPath)) {
    return result;
  }

  let stat;
  try {
    stat = fs.lstatSync(linkAbsPath);
  } catch {
    return result;
  }

  result.isLink = stat.isSymbolicLink();

  if (!result.isLink) {
    // It exists but isn't a symlink
    result.exists = true;
    result.isValid = true;
    result.target = linkAbsPath;
    result.hasSkillMd = fs.existsSync(path.join(linkAbsPath, 'SKILL.md'));
    return result;
  }

  // It's a symlink
  try {
    result.target = fs.readlinkSync(linkAbsPath);
  } catch {
    return result;
  }

  // Check if target exists (follows link)
  result.exists = fs.existsSync(linkAbsPath);

  if (result.exists) {
    result.isValid = true;
    result.hasSkillMd = fs.existsSync(path.join(linkAbsPath, 'SKILL.md'));
  }

  return result;
}

/**
 * Copy a directory recursively (fallback for cross-drive Windows scenario).
 * @param {string} src
 * @param {string} dest
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = {
  createSkillSymlink,
  removeSkillSymlink,
  isSymlinkValid,
  getSymlinkStatus,
  canCreateJunction,
  copyDirRecursive
};
