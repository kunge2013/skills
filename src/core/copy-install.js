'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Recursively copy a directory, preserving structure.
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

/**
 * Install a skill via copy mode.
 * Copies all files from source into targetDir/skillName/ and creates
 * a .skills-manifest.json for uninstall tracking.
 *
 * @param {string} skillName
 * @param {string} sourcePath - Absolute path to the skill source directory
 * @param {string} targetDir - Absolute path to the target directory
 * @returns {{ success: boolean, installPath: string, error?: string }}
 */
function copyInstallSkill(skillName, sourcePath, targetDir) {
  if (!fs.existsSync(sourcePath)) {
    return { success: false, installPath: '', error: `Source not found: ${sourcePath}` };
  }
  if (!fs.existsSync(targetDir)) {
    return { success: false, installPath: '', error: `Target directory not found: ${targetDir}` };
  }

  const installPath = path.join(targetDir, skillName);

  // Check if already installed
  if (fs.existsSync(installPath)) {
    return { success: false, installPath, error: `Skill already exists at: ${installPath}` };
  }

  try {
    // Copy all files
    copyDirRecursive(sourcePath, installPath);

    // Create manifest for uninstall tracking
    const manifest = {
      skillName,
      mode: 'copy',
      sourcePath,
      installedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(installPath, '.skills-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    return { success: true, installPath };
  } catch (err) {
    // Clean up partial copy on failure
    if (fs.existsSync(installPath)) {
      fs.rmSync(installPath, { recursive: true, force: true });
    }
    return { success: false, installPath: '', error: err.message };
  }
}

/**
 * Uninstall a copy-mode skill. Verifies .skills-manifest.json ownership
 * before deleting to prevent accidental removal of user-created directories.
 *
 * @param {string} skillDir - Absolute path to the installed skill directory
 * @returns {{ success: boolean, error?: string }}
 */
function uninstallCopySkill(skillDir) {
  if (!fs.existsSync(skillDir)) {
    return { success: false, error: `Skill directory not found: ${skillDir}` };
  }

  const manifestPath = path.join(skillDir, '.skills-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return {
      success: false,
      error: 'No .skills-manifest.json found — not a copy-mode install. Refusing to delete.',
    };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (manifest.mode !== 'copy') {
      return { success: false, error: 'Manifest mode is not "copy". Refusing to delete.' };
    }
  } catch (err) {
    return { success: false, error: `Invalid manifest file: ${err.message}` };
  }

  try {
    fs.rmSync(skillDir, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to remove: ${err.message}` };
  }
}

/**
 * Check if a skill directory was installed via copy mode.
 * @param {string} skillDir
 * @returns {{ isCopy: boolean, manifest?: object }}
 */
function getCopyInstallStatus(skillDir) {
  const manifestPath = path.join(skillDir, '.skills-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { isCopy: false };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (manifest.mode === 'copy') {
      return { isCopy: true, manifest };
    }
  } catch {
    // Invalid manifest
  }

  return { isCopy: false };
}

module.exports = {
  copyInstallSkill,
  uninstallCopySkill,
  getCopyInstallStatus,
  copyDirRecursive,
};
