// electron/main/handlers/git.js
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { cloneRepo, pullRepo } = require('../../../src/utils/git.js');
const { getConfig, updateConfig, KUNGESKILLS_DIR } = require('../../../src/core/config.js');
const { getCacheDir, isCacheValid, ensureCacheDir } = require('../../../src/core/cache.js');

async function initMarketplace() {
  const config = getConfig();
  const cacheDir = ensureCacheDir();
  const repoUrl = config.marketplace.url;
  const branch = config.marketplace.branch || 'main';
  if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
  await cloneRepo(repoUrl, cacheDir, branch);
  updateConfig({ ...config, marketplace: { ...config.marketplace, cloned: true, lastSync: new Date().toISOString() } });
  return { success: true, cacheDir };
}

async function updateMarketplace() {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) return { success: false, error: 'Marketplace not initialized. Run init first.' };
  await pullRepo(cacheDir);
  const config = getConfig();
  updateConfig({ ...config, marketplace: { ...config.marketplace, lastSync: new Date().toISOString() } });
  return { success: true };
}

function checkCacheStatus() {
  const cacheDir = getCacheDir();
  const valid = isCacheValid();
  const config = getConfig();
  return { valid, cacheDir, hasBundled: fs.existsSync(path.join(__dirname, '../../../plugins')), lastSync: config.marketplace.lastSync, repoUrl: config.marketplace.url };
}

ipcMain.handle('git:init', async () => {
  try { const result = await initMarketplace(); return result; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('git:update', async () => {
  try { const result = await updateMarketplace(); return result; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('git:cache-status', () => {
  try { return { success: true, data: checkCacheStatus() }; }
  catch (err) { return { success: false, error: err.message }; }
});
