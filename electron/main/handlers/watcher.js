// [AGC:FILE] tool=Cc author=fangkun
const { ipcMain, BrowserWindow } = require('electron');
const chokidar = require('chokidar');
const path = require('path');

let watcher = null;
let watchPaths = [];

function startWatching(skillDirs) {
  stopWatching();
  watchPaths = skillDirs.map((d) => path.join(d, '**', '*.md'));
  watcher = chokidar.watch(watchPaths, {
    ignored: /node_modules/, persistent: true, ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });
  watcher.on('change', (filePath) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) win.webContents.send('file:changed', { path: filePath });
  });
}

function stopWatching() {
  if (watcher) { watcher.close(); watcher = null; }
}

module.exports = { startWatching, stopWatching };

ipcMain.handle('watch:start', (_event, skillDirs) => { startWatching(skillDirs); return { success: true }; });
ipcMain.handle('watch:stop', () => { stopWatching(); return { success: true }; });
