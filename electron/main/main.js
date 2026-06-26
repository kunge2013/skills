// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const log = require('electron-log');

// Register IPC handlers
const marketplaceHandlers = require('./handlers/marketplace');
const skillHandlers = require('./handlers/skill');
const symlinkHandlers = require('./handlers/symlink');
const gitHandlers = require('./handlers/git');
const watcherHandlers = require('./handlers/watcher');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load Vite dev server
  // In production, load built files
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup watcher on app quit
app.on('before-quit', () => {
  if (watcherHandlers.stopWatching) {
    watcherHandlers.stopWatching();
  }
});
