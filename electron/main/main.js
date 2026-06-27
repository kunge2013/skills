// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// IPC handlers (created in Tasks 4-8)
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
  const prodPath = path.join(__dirname, '..', 'renderer', 'dist', 'index.html')
  if (fs.existsSync(prodPath)) {
    mainWindow.loadFile(prodPath)
  } else {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
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
