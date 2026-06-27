#!/usr/bin/env node
'use strict';

// [AGC:START] tool=Cc author=fangkun
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

async function cmdDashboard() {
  const pkgRoot = path.resolve(__dirname, '../..');
  const electronMain = path.join(pkgRoot, 'electron', 'main', 'main.js');
  const rendererDist = path.join(pkgRoot, 'electron', 'renderer', 'dist', 'index.html');

  // Check if Electron main process exists
  if (!fs.existsSync(electronMain)) {
    logger.error('Electron desktop app not found. Install with: npm install -g kungeskill');
    process.exit(1);
  }

  // Build renderer if not built (for dev installations)
  if (!fs.existsSync(rendererDist)) {
    logger.info('Building renderer...');
    const { execSync } = require('child_process');
    try {
      execSync('npm run build --prefix electron/renderer', {
        stdio: 'inherit',
        cwd: pkgRoot,
      });
    } catch (err) {
      logger.error('Failed to build renderer. Run: cd electron/renderer && npm run build');
      process.exit(1);
    }
  }

  // Launch Electron
  logger.info('Starting KungeSkill Desktop...');
  const electronBin = path.join(pkgRoot, 'node_modules', '.bin', 'electron' + (process.platform === 'win32' ? '.cmd' : ''));

  if (!fs.existsSync(electronBin)) {
    // Try npx as fallback
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    logger.info('Launching via npx electron...');
    const child = spawn(npx, ['electron', 'electron/main/main.js'], {
      cwd: pkgRoot,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', (err) => {
      logger.error(`Failed to start Electron: ${err.message}`);
      process.exit(1);
    });
    child.on('exit', (code) => process.exit(code || 0));
  } else {
    const child = spawn(electronBin, ['electron/main/main.js'], {
      cwd: pkgRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', (err) => {
      logger.error(`Failed to start Electron: ${err.message}`);
      process.exit(1);
    });
    child.on('exit', (code) => process.exit(code || 0));
  }
}

module.exports = { cmdDashboard };
// [AGC:END]
