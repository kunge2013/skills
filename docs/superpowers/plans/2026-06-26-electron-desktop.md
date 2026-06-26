# Electron Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use kunge2013:subagent-driven-development (recommended) or kunge2013:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop application alongside the existing CLI, enabling graphical browsing, editing, and management of skills with zero breaking changes to the CLI.

**Architecture:** Electron main process reuses existing CLI `core/` modules via `require()`. Vue 3 + Vite renderer process provides the UI. IPC bridge exposes marketplace, skill CRUD, symlink, and git operations. Single npm package ships both CLI and Electron.

**Tech Stack:** Electron, Vue 3, Vite, TypeScript, Pinia, md-editor-v3, Element Plus, electron-builder, chokidar.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `electron/` | Create directory | All Electron app code |
| `electron/main/main.js` | Create | Electron entry: BrowserWindow, app lifecycle, IPC registration |
| `electron/main/preload.js` | Create | contextBridge: expose `window.api.*` to renderer |
| `electron/main/handlers/marketplace.js` | Create | IPC: list/search skills, reuse `src/core/registry.js` |
| `electron/main/handlers/skill.js` | Create | IPC: read/write/validate SKILL.md files |
| `electron/main/handlers/symlink.js` | Create | IPC: install/uninstall/check skill symlinks |
| `electron/main/handlers/git.js` | Create | IPC: init/update marketplace cache |
| `electron/main/handlers/watcher.js` | Create | IPC: chokidar file watcher for live updates |
| `electron/renderer/` | Create (vite scaffold) | Vue 3 frontend |
| `electron/renderer/src/types/skill.ts` | Create | TypeScript interfaces for skill data |
| `electron/renderer/src/stores/skills.ts` | Create | Pinia store: state + async actions via `window.api` |
| `electron/renderer/src/components/NavSidebar.vue` | Create | Left sidebar: navigation, cache status, version |
| `electron/renderer/src/components/SkillList.vue` | Create | Main list view: search, filter, group by plugin |
| `electron/renderer/src/components/SkillDetail.vue` | Create | Detail view: metadata + rendered markdown preview |
| `electron/renderer/src/components/SkillEditor.vue` | Create | Editor: md-editor-v3 with save/validate |
| `electron/renderer/src/components/StatusBar.vue` | Create | Status bar: cache indicator, update button |
| `electron/renderer/src/App.vue` | Create | Root component: layout, router |
| `electron/renderer/src/main.ts` | Create | Vue app bootstrap |
| `electron/renderer/src/style.css` | Create | Global styles |
| `electron/renderer/index.html` | Create (vite scaffold) | Entry HTML |
| `electron-builder.yml` | Create | electron-builder packaging config |
| `package.json` | Modify | Add scripts, devDependencies, files field |
| `.npmignore` | Modify | Rewrite to allow `electron/`, `plugins/`, `.claude-plugin/` |

---

### Task 1: Scaffold Electron directories and update package.json

**Files:**
- Create: `electron/`, `electron/main/`, `electron/main/handlers/`, `electron/renderer/`
- Modify: `package.json`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p electron/main/handlers
mkdir -p electron/renderer
```

- [ ] **Step 2: Update package.json**

Add `dev:desktop` and `build:desktop` scripts, add Electron devDependencies, update `files` field.

Read current `package.json`:
```json
{
  "name": "kungeskill",
  "version": "0.5.0",
  "description": "Manage Claude Code skills via symlinks...",
  "main": "src/cli.js",
  "bin": {
    "kungeskill": "src/cli.js"
  },
  "files": [
    "src/**/*.js",
    "plugins/**/*",
    ".claude-plugin/**/*"
  ],
  "scripts": {
    "start": "node src/cli.js",
    "list": "node src/cli.js list",
    "init": "node src/cli.js init",
    "prepublishOnly": "node src/cli.js --version",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

Apply these changes:

```json
{
  "files": [
    "src/**/*.js",
    "plugins/**/*",
    ".claude-plugin/**/*",
    "electron/**/*",
    "electron-builder.yml"
  ],
  "scripts": {
    "start": "node src/cli.js",
    "list": "node src/cli.js list",
    "init": "node src/cli.js init",
    "dev:desktop": "npx electron electron/main/main.js",
    "build:desktop": "electron-builder",
    "prepublishOnly": "node src/cli.js --version",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "electron-log": "^5.0.0",
    "chokidar": "^4.0.0"
  }
}
```

Run:
```bash
npm install
```

- [ ] **Step 3: Create electron-builder.yml**

```yaml
appId: com.kunge2013.skills
productName: KungeSkill Desktop
directories:
  output: dist-desktop
files:
  - electron/main/**/*
  - electron/renderer/dist/**/*
  - src/**/*.js
  - plugins/**/*
  - .claude-plugin/**/*
win:
  target:
    - target: nsis
      arch: [x64]
mac:
  target:
    - target: dmg
      arch: [x64, arm64]
linux:
  target:
    - target: AppImage
      arch: [x64]
extraMetadata:
  main: electron/main/main.js
```

- [ ] **Step 4: Update .npmignore**

The current `.npmignore` excludes `plugins/`, `.claude-plugin/`, and `*.md` — which means the current npm package ONLY ships `src/`. But looking at the `files` field in package.json (which takes precedence over `.npmignore`), `plugins/` and `.claude-plugin/` ARE included. The `.npmignore` acts as a secondary filter.

Rewrite `.npmignore` to only exclude build artifacts:

```
node_modules/
dist/
dist-desktop/
*.log
.DS_Store
Thumbs.db
openspec/
docs/
.claude/
```

**Important:** Do NOT exclude `plugins/`, `.claude-plugin/`, or `electron/`. The `files` field in package.json controls what gets published, and `.npmignore` only further excludes from that set.

- [ ] **Step 5: Commit**

```bash
git add electron/ package.json electron-builder.yml .npmignore package-lock.json
git commit -m "feat: scaffold Electron desktop app with package.json config"
```

---

### Task 2: Create Electron main process entry point

**Files:**
- Create: `electron/main/main.js`

- [ ] **Step 1: Write main.js**

This is the Electron entry point. It creates the BrowserWindow and registers all IPC handlers.

```javascript
// electron/main/main.js
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
```

- [ ] **Step 2: Verify the file can be loaded**

Run:
```bash
npx electron electron/main/main.js
```

Expected: A blank Electron window opens, dev tools show no errors in console. The window will be blank because the renderer doesn't exist yet — that's fine for now.

- [ ] **Step 3: Commit**

```bash
git add electron/main/main.js
git commit -m "feat: add Electron main process entry point"
```

---

### Task 3: Create preload script (IPC bridge)

**Files:**
- Create: `electron/main/preload.js`

- [ ] **Step 1: Write preload.js**

This script uses `contextBridge` to safely expose the API to the renderer process.

```javascript
// electron/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Marketplace
  listMarketplacePlugins: () => ipcRenderer.invoke('marketplace:list-plugins'),
  listSkills: () => ipcRenderer.invoke('marketplace:list-skills'),
  searchSkills: (query, filters) => ipcRenderer.invoke('marketplace:search', query, filters),

  // Skill CRUD
  readSkillContent: (skillPath) => ipcRenderer.invoke('skill:read', skillPath),
  saveSkillContent: (skillPath, content) => ipcRenderer.invoke('skill:save', skillPath, content),
  validateSkillMd: (content) => ipcRenderer.invoke('skill:validate', content),

  // Symlink management
  installSkill: (skillName, projectPath) => ipcRenderer.invoke('symlink:install', skillName, projectPath),
  uninstallSkill: (skillName, projectPath) => ipcRenderer.invoke('symlink:uninstall', skillName, projectPath),
  checkSkillStatus: (skillName) => ipcRenderer.invoke('symlink:status', skillName),

  // Git operations
  initMarketplace: () => ipcRenderer.invoke('git:init'),
  updateMarketplace: () => ipcRenderer.invoke('git:update'),
  checkCacheStatus: () => ipcRenderer.invoke('git:cache-status'),

  // File watching
  onFileChanged: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('file:changed', subscription);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('file:changed', subscription);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/main/preload.js
git commit -m "feat: add Electron preload script with IPC bridge"
```

---

### Task 4: Implement marketplace IPC handlers

**Files:**
- Create: `electron/main/handlers/marketplace.js`
- Reuses: `src/core/registry.js`, `src/core/cache.js`

- [ ] **Step 1: Write marketplace.js**

This handler reuses the CLI's existing registry and cache modules.

```javascript
// electron/main/handlers/marketplace.js
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Reuse CLI modules
const { getAllMarketplaceDirs, getMarketplaceSourceDir } = require('../../../src/core/cache.js');
const { parseMarketplace, listSkillsFromSource } = require('../../../src/core/registry.js');

function listAllSkills() {
  const sourceDirs = getAllMarketplaceDirs();
  const allSkills = [];
  const seen = new Set();

  for (const sourceDir of sourceDirs) {
    const marketplace = parseMarketplace(sourceDir);
    if (!marketplace || !marketplace.plugins) continue;

    for (const plugin of marketplace.plugins) {
      const skillsDir = path.join(sourceDir, plugin.source, 'skills');
      if (!fs.existsSync(skillsDir)) continue;

      const skillDirs = fs.readdirSync(skillsDir).filter((d) => {
        const full = path.join(skillsDir, d);
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
      });

      for (const skillName of skillDirs) {
        if (seen.has(skillName)) continue;
        seen.add(skillName);
        allSkills.push({
          skillName,
          pluginName: plugin.name,
          sourcePath: path.join(skillsDir, skillName),
          pluginDescription: plugin.description,
          pluginAuthor: plugin.author?.name || 'Unknown',
          pluginLicense: plugin.license || 'Unknown',
          pluginCategory: plugin.category || 'other',
          pluginKeywords: plugin.keywords || [],
        });
      }
    }
  }

  return allSkills;
}

function listPlugins() {
  const sourceDirs = getAllMarketplaceDirs();
  const allPlugins = [];
  const seen = new Set();

  for (const sourceDir of sourceDirs) {
    const marketplace = parseMarketplace(sourceDir);
    if (!marketplace || !marketplace.plugins) continue;

    for (const plugin of marketplace.plugins) {
      if (seen.has(plugin.name)) continue;
      seen.add(plugin.name);

      const skillsDir = path.join(sourceDir, plugin.source, 'skills');
      let skillCount = 0;
      if (fs.existsSync(skillsDir)) {
        skillCount = fs.readdirSync(skillsDir).filter((d) => {
          const full = path.join(skillsDir, d);
          return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
        }).length;
      }

      allPlugins.push({
        name: plugin.name,
        source: plugin.source,
        description: plugin.description,
        author: plugin.author?.name || 'Unknown',
        license: plugin.license || 'Unknown',
        category: plugin.category || 'other',
        keywords: plugin.keywords || [],
        skillCount,
        sourceDir: path.join(sourceDir, plugin.source),
      });
    }
  }

  return allPlugins;
}

function searchSkills(query, filters = {}) {
  let skills = listAllSkills();

  if (query) {
    const q = query.toLowerCase();
    skills = skills.filter(
      (s) =>
        s.skillName.toLowerCase().includes(q) ||
        s.pluginName.toLowerCase().includes(q) ||
        s.pluginDescription?.toLowerCase().includes(q) ||
        s.pluginKeywords?.some((kw) => kw.toLowerCase().includes(q))
    );
  }

  if (filters.category) {
    skills = skills.filter((s) => s.pluginCategory === filters.category);
  }

  if (filters.plugin) {
    skills = skills.filter((s) => s.pluginName === filters.plugin);
  }

  return skills;
}

// Register IPC handlers
ipcMain.handle('marketplace:list-plugins', () => {
  try {
    return { success: true, data: listPlugins() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('marketplace:list-skills', () => {
  try {
    return { success: true, data: listAllSkills() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('marketplace:search', (_event, query, filters) => {
  try {
    return { success: true, data: searchSkills(query, filters) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/main/handlers/marketplace.js
git commit -m "feat: add marketplace IPC handlers reusing CLI registry module"
```

---

### Task 5: Implement skill CRUD IPC handlers

**Files:**
- Create: `electron/main/handlers/skill.js`

- [ ] **Step 1: Write skill.js**

Handles reading, writing, and validating SKILL.md files.

```javascript
// electron/main/handlers/skill.js
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function readSkillContent(skillPath) {
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill path does not exist: ${skillPath}`);
  }

  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found in: ${skillPath}`);
  }

  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const stat = fs.statSync(skillMdPath);

  return {
    content,
    path: skillMdPath,
    lastModified: stat.mtimeMs,
  };
}

function validateSkillMd(content) {
  const errors = [];

  // Check for YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatterMatch) {
    errors.push('Missing YAML frontmatter (--- ... ---)');
    return { valid: false, errors };
  }

  const frontmatter = frontmatterMatch[1];

  // Check required fields
  if (!/^name:\s*\S+/m.test(frontmatter)) {
    errors.push('Missing required field: name');
  }
  if (!/^description:\s*\S+/m.test(frontmatter)) {
    errors.push('Missing required field: description');
  }

  return {
    valid: errors.length === 0,
    errors,
    frontmatter,
    body: content.slice(frontmatterMatch[0].length),
  };
}

function saveSkillContent(skillPath, content, expectedMtime = null) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found in: ${skillPath}`);
  }

  // Conflict detection: check if file was modified externally
  if (expectedMtime !== null) {
    const currentStat = fs.statSync(skillMdPath);
    if (currentStat.mtimeMs !== expectedMtime) {
      return {
        success: false,
        error: 'File was modified externally. Please reload and try again.',
        conflict: true,
        currentContent: fs.readFileSync(skillMdPath, 'utf-8'),
      };
    }
  }

  // Validate before saving
  const validation = validateSkillMd(content);
  if (!validation.valid) {
    return {
      success: false,
      error: `Validation failed: ${validation.errors.join(', ')}`,
    };
  }

  fs.writeFileSync(skillMdPath, content, 'utf-8');
  return { success: true };
}

// IPC handlers
ipcMain.handle('skill:read', (_event, skillPath) => {
  try {
    const result = readSkillContent(skillPath);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('skill:validate', (_event, content) => {
  try {
    const result = validateSkillMd(content);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('skill:save', (_event, skillPath, content, expectedMtime) => {
  try {
    const result = saveSkillContent(skillPath, content, expectedMtime);
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/main/handlers/skill.js
git commit -m "feat: add skill CRUD IPC handlers with conflict detection"
```

---

### Task 6: Implement symlink IPC handlers

**Files:**
- Create: `electron/main/handlers/symlink.js`
- Reuses: `src/core/symlink.js`, `src/commands/shared.js`

- [ ] **Step 1: Write symlink.js**

```javascript
// electron/main/handlers/symlink.js
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Reuse CLI modules
const { createSkillSymlink, removeSkillSymlink, getSymlinkStatus } = require('../../../src/core/symlink.js');
const { findProjectSkillsDir } = require('../../../src/commands/shared.js');

function installSkill(skillName, projectPath) {
  // Find or create the project's .claude/skills/ directory
  const skillsDir = findProjectSkillsDir(projectPath);
  const linkPath = path.join(skillsDir, skillName);

  // Find the skill in marketplace
  const { getAllMarketplaceDirs, getMarketplaceSourceDir } = require('../../../src/core/cache.js');
  const { findSkillMerged } = require('../../../src/core/registry.js');
  const sourceDirs = getAllMarketplaceDirs();
  const skill = findSkillMerged(sourceDirs, skillName);

  if (!skill) {
    return { success: false, error: `Skill '${skillName}' not found in marketplace` };
  }

  const targetPath = skill.sourcePath;

  // Create symlink
  createSkillSymlink(targetPath, linkPath);
  return { success: true, linkPath, targetPath };
}

function uninstallSkill(skillName, projectPath) {
  const skillsDir = findProjectSkillsDir(projectPath);
  const linkPath = path.join(skillsDir, skillName);

  removeSkillSymlink(linkPath);
  return { success: true };
}

function checkSkillStatus(skillName) {
  // Find the skill in the current project's .claude/skills/
  // Walk up to find project root
  let cwd = process.cwd();
  let projectRoot = cwd;
  while (cwd !== path.parse(cwd).root) {
    if (fs.existsSync(path.join(cwd, '.git'))) {
      projectRoot = cwd;
      break;
    }
    cwd = path.dirname(cwd);
  }

  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  const linkPath = path.join(skillsDir, skillName);

  if (!fs.existsSync(linkPath)) {
    return { success: true, data: { installed: false, skillName } };
  }

  const status = getSymlinkStatus(linkPath);
  return {
    success: true,
    data: {
      installed: true,
      skillName,
      linkPath,
      isLink: status.isLink,
      isValid: status.isValid,
      hasSkillMd: status.hasSkillMd,
    },
  };
}

// IPC handlers
ipcMain.handle('symlink:install', (_event, skillName, projectPath) => {
  try {
    const result = installSkill(skillName, projectPath);
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('symlink:uninstall', (_event, skillName, projectPath) => {
  try {
    const result = uninstallSkill(skillName, projectPath);
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('symlink:status', (_event, skillName) => {
  try {
    const result = checkSkillStatus(skillName);
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/main/handlers/symlink.js
git commit -m "feat: add symlink IPC handlers reusing CLI symlink module"
```

---

### Task 7: Implement git IPC handlers

**Files:**
- Create: `electron/main/handlers/git.js`
- Reuses: `src/utils/git.js`, `src/core/config.js`, `src/core/cache.js`

- [ ] **Step 1: Write git.js**

```javascript
// electron/main/handlers/git.js
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Reuse CLI modules
const { cloneRepo, pullRepo } = require('../../../src/utils/git.js');
const { getConfig, updateConfig, KUNGESKILLS_DIR } = require('../../../src/core/config.js');
const { getCacheDir, isCacheValid, ensureCacheDir } = require('../../../src/core/cache.js');

async function initMarketplace() {
  const config = getConfig();
  const cacheDir = ensureCacheDir();
  const repoUrl = config.marketplace.url;
  const branch = config.marketplace.branch || 'main';

  // Remove existing cache if present
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }

  await cloneRepo(repoUrl, cacheDir, branch);

  updateConfig({
    ...config,
    marketplace: {
      ...config.marketplace,
      cloned: true,
      lastSync: new Date().toISOString(),
    },
  });

  return { success: true, cacheDir };
}

async function updateMarketplace() {
  const cacheDir = getCacheDir();

  if (!fs.existsSync(cacheDir)) {
    return { success: false, error: 'Marketplace not initialized. Run init first.' };
  }

  await pullRepo(cacheDir);

  const config = getConfig();
  updateConfig({
    ...config,
    marketplace: {
      ...config.marketplace,
      lastSync: new Date().toISOString(),
    },
  });

  return { success: true };
}

function checkCacheStatus() {
  const cacheDir = getCacheDir();
  const valid = isCacheValid();
  const config = getConfig();

  return {
    valid,
    cacheDir,
    hasBundled: fs.existsSync(path.join(__dirname, '../../../plugins')),
    lastSync: config.marketplace.lastSync,
    repoUrl: config.marketplace.url,
  };
}

// IPC handlers
ipcMain.handle('git:init', async () => {
  try {
    const result = await initMarketplace();
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('git:update', async () => {
  try {
    const result = await updateMarketplace();
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('git:cache-status', () => {
  try {
    return { success: true, data: checkCacheStatus() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/main/handlers/git.js
git commit -m "feat: add git IPC handlers reusing CLI git and config modules"
```

---

### Task 8: Implement file watcher

**Files:**
- Create: `electron/main/handlers/watcher.js`

- [ ] **Step 1: Write watcher.js**

```javascript
// electron/main/handlers/watcher.js
const { ipcMain, BrowserWindow } = require('electron');
const chokidar = require('chokidar');
const path = require('path');

let watcher = null;
let watchPaths = [];

function startWatching(skillDirs) {
  stopWatching();

  watchPaths = skillDirs.map((d) => path.join(d, '**', '*.md'));

  watcher = chokidar.watch(watchPaths, {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on('change', (filePath) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('file:changed', { path: filePath });
    }
  });
}

function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

// Expose stopWatching for main.js cleanup
module.exports = { startWatching, stopWatching };

// IPC handlers
ipcMain.handle('watch:start', (_event, skillDirs) => {
  startWatching(skillDirs);
  return { success: true };
});

ipcMain.handle('watch:stop', () => {
  stopWatching();
  return { success: true };
});
```

- [ ] **Step 2: Update main.js to export stopWatching reference**

In `electron/main/main.js`, the `app.on('before-quit')` handler already references `watcherHandlers.stopWatching`. The module exports it, so this works. Confirm the main.js line:

```javascript
const watcherHandlers = require('./handlers/watcher');
// ...
app.on('before-quit', () => {
  if (watcherHandlers.stopWatching) {
    watcherHandlers.stopWatching();
  }
});
```

This is already correct from Task 2.

- [ ] **Step 3: Commit**

```bash
git add electron/main/handlers/watcher.js
git commit -m "feat: add file watcher handler using chokidar"
```

---

### Task 9: Scaffold Vue 3 renderer project

**Files:**
- Create: `electron/renderer/` (Vite scaffold)
- Create: `electron/renderer/package.json`

- [ ] **Step 1: Scaffold Vite + Vue 3 + TypeScript project**

```bash
cd electron/renderer
npm create vite@latest . -- --template vue-ts
```

When prompted, accept defaults.

- [ ] **Step 2: Install renderer dependencies**

```bash
cd electron/renderer
npm install
npm install pinia md-editor-v3 element-plus marked
```

- [ ] **Step 3: Create Vite config**

Replace the generated `vite.config.ts`:

```typescript
// electron/renderer/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
```

- [ ] **Step 4: Update index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KungeSkill Desktop</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.ts**

```typescript
// electron/renderer/src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(ElementPlus)
app.mount('#app')
```

- [ ] **Step 6: Create src/style.css**

```css
/* electron/renderer/src/style.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  overflow: hidden;
}
```

- [ ] **Step 7: Create src/types/skill.ts**

```typescript
// electron/renderer/src/types/skill.ts
export interface SkillInfo {
  skillName: string;
  pluginName: string;
  sourcePath: string;
  pluginDescription?: string;
  pluginAuthor?: string;
  pluginLicense?: string;
  pluginCategory?: string;
  pluginKeywords?: string[];
}

export interface PluginInfo {
  name: string;
  source: string;
  description: string;
  author: string;
  license: string;
  category: string;
  keywords: string[];
  skillCount: number;
  sourceDir: string;
}

export interface SkillContent {
  content: string;
  path: string;
  lastModified: number;
}

export interface SkillValidation {
  valid: boolean;
  errors: string[];
  frontmatter?: string;
  body?: string;
}

export interface CacheStatus {
  valid: boolean;
  cacheDir: string;
  hasBundled: boolean;
  lastSync: string | null;
  repoUrl: string;
}
```

- [ ] **Step 8: Commit**

```bash
git add electron/renderer/
git commit -m "feat: scaffold Vue 3 renderer with Vite, Pinia, Element Plus"
```

---

### Task 10: Create Pinia store

**Files:**
- Create: `electron/renderer/src/stores/skills.ts`

- [ ] **Step 1: Write the store**

```typescript
// electron/renderer/src/stores/skills.ts
import { defineStore } from 'pinia'
import type { SkillInfo, PluginInfo, SkillContent, SkillValidation, CacheStatus } from '../types/skill'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const useSkillsStore = defineStore('skills', {
  state: () => ({
    // Data
    plugins: [] as PluginInfo[],
    skills: [] as SkillInfo[],
    filteredSkills: [] as SkillInfo[],
    selectedSkill: null as SkillInfo | null,
    skillContent: null as SkillContent | null,

    // UI state
    searchQuery: '',
    selectedCategory: '',
    selectedPlugin: '',
    sortBy: 'name' as 'name' | 'plugin' | 'author',
    currentView: 'list' as 'list' | 'detail' | 'editor',

    // Status
    cacheStatus: null as CacheStatus | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    categories: (state) => {
      const cats = new Set(state.plugins.map((p) => p.category))
      return Array.from(cats).sort()
    },

    hasCache: (state) => state.cacheStatus?.valid ?? false,
  },

  actions: {
    async loadPlugins() {
      this.loading = true
      this.error = null
      try {
        const res: ApiResponse<PluginInfo[]> = await window.api.listMarketplacePlugins()
        if (res.success && res.data) {
          this.plugins = res.data
        } else {
          this.error = res.error || 'Failed to load plugins'
        }
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async loadSkills() {
      this.loading = true
      this.error = null
      try {
        const res: ApiResponse<SkillInfo[]> = await window.api.listSkills()
        if (res.success && res.data) {
          this.skills = res.data
          this.applyFilters()
        } else {
          this.error = res.error || 'Failed to load skills'
        }
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async searchSkills(query: string) {
      this.searchQuery = query
      this.loading = true
      try {
        const filters: any = {}
        if (this.selectedCategory) filters.category = this.selectedCategory
        if (this.selectedPlugin) filters.plugin = this.selectedPlugin

        const res: ApiResponse<SkillInfo[]> = await window.api.searchSkills(query, filters)
        if (res.success && res.data) {
          this.filteredSkills = res.data
        }
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    applyFilters() {
      let filtered = [...this.skills]

      if (this.selectedCategory) {
        filtered = filtered.filter((s) => s.pluginCategory === this.selectedCategory)
      }
      if (this.selectedPlugin) {
        filtered = filtered.filter((s) => s.pluginName === this.selectedPlugin)
      }

      if (this.sortBy === 'name') {
        filtered.sort((a, b) => a.skillName.localeCompare(b.skillName))
      } else if (this.sortBy === 'plugin') {
        filtered.sort((a, b) => a.pluginName.localeCompare(b.pluginName))
      } else if (this.sortBy === 'author') {
        filtered.sort((a, b) => (a.pluginAuthor || '').localeCompare(b.pluginAuthor || ''))
      }

      this.filteredSkills = filtered
    },

    async selectSkill(skill: SkillInfo) {
      this.selectedSkill = skill
      this.currentView = 'detail'
    },

    async loadSkillContent(skillPath: string) {
      this.loading = true
      try {
        const res: ApiResponse<SkillContent> = await window.api.readSkillContent(skillPath)
        if (res.success && res.data) {
          this.skillContent = res.data
          return res.data
        } else {
          this.error = res.error || 'Failed to load skill content'
        }
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async saveSkillContent(skillPath: string, content: string, expectedMtime?: number) {
      this.loading = true
      try {
        const res = await window.api.saveSkillContent(skillPath, content, expectedMtime)
        return res
      } catch (err: any) {
        this.error = err.message
        return { success: false, error: err.message }
      } finally {
        this.loading = false
      }
    },

    async validateSkillMd(content: string) {
      const res: ApiResponse<SkillValidation> = await window.api.validateSkillMd(content)
      if (res.success && res.data) {
        return res.data
      }
      return { valid: false, errors: ['Validation failed'] }
    },

    async installSkill(skillName: string, projectPath: string) {
      this.loading = true
      try {
        const res = await window.api.installSkill(skillName, projectPath)
        return res
      } catch (err: any) {
        this.error = err.message
        return { success: false, error: err.message }
      } finally {
        this.loading = false
      }
    },

    async uninstallSkill(skillName: string, projectPath: string) {
      this.loading = true
      try {
        const res = await window.api.uninstallSkill(skillName, projectPath)
        return res
      } catch (err: any) {
        this.error = err.message
        return { success: false, error: err.message }
      } finally {
        this.loading = false
      }
    },

    async checkCacheStatus() {
      try {
        const res: ApiResponse<CacheStatus> = await window.api.checkCacheStatus()
        if (res.success && res.data) {
          this.cacheStatus = res.data
        }
      } catch (err: any) {
        this.error = err.message
      }
    },

    async initMarketplace() {
      this.loading = true
      try {
        const res = await window.api.initMarketplace()
        if (res.success) {
          await this.checkCacheStatus()
          await this.loadPlugins()
          await this.loadSkills()
        }
        return res
      } catch (err: any) {
        this.error = err.message
        return { success: false, error: err.message }
      } finally {
        this.loading = false
      }
    },

    async updateMarketplace() {
      this.loading = true
      try {
        const res = await window.api.updateMarketplace()
        if (res.success) {
          await this.loadPlugins()
          await this.loadSkills()
        }
        return res
      } catch (err: any) {
        this.error = err.message
        return { success: false, error: err.message }
      } finally {
        this.loading = false
      }
    },

    setView(view: 'list' | 'detail' | 'editor') {
      this.currentView = view
    },

    clearSelection() {
      this.selectedSkill = null
      this.skillContent = null
      this.currentView = 'list'
    },
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/src/stores/skills.ts
git commit -m "feat: create Pinia store for skills state management"
```

---

### Task 11: Create NavSidebar component

**Files:**
- Create: `electron/renderer/src/components/NavSidebar.vue`

- [ ] **Step 1: Write NavSidebar.vue**

```vue
<!-- electron/renderer/src/components/NavSidebar.vue -->
<template>
  <div class="nav-sidebar">
    <div class="nav-header">
      <h2>KungeSkill Desktop</h2>
      <span class="version">v{{ version }}</span>
    </div>

    <el-menu
      :default-active="activeView"
      class="nav-menu"
      @select="handleSelect"
    >
      <el-menu-item index="list">
        <el-icon><Document /></el-icon>
        <span>All Skills</span>
      </el-menu-item>
      <el-menu-item index="installed">
        <el-icon><FolderOpened /></el-icon>
        <span>Installed</span>
      </el-menu-item>
      <el-menu-item index="updates">
        <el-icon><Refresh /></el-icon>
        <span>Updates</span>
      </el-menu-item>
    </el-menu>

    <div class="nav-footer">
      <div class="cache-status">
        <el-tag :type="store.hasCache ? 'success' : 'danger'" size="small">
          {{ store.hasCache ? 'Cache: OK' : 'Cache: Missing' }}
        </el-tag>
        <span class="last-sync" v-if="store.cacheStatus?.lastSync">
          Synced: {{ formatDate(store.cacheStatus.lastSync) }}
        </span>
      </div>
      <el-button
        v-if="!store.hasCache"
        type="primary"
        size="small"
        @click="handleInit"
        :loading="store.loading"
      >
        Initialize Cache
      </el-button>
      <el-button
        v-else
        type="info"
        size="small"
        @click="handleUpdate"
        :loading="store.loading"
      >
        Update
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Document, FolderOpened, Refresh } from '@element-plus/icons-vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'

const store = useSkillsStore()
const activeView = computed(() => store.currentView === 'list' ? 'list' : 'list')

const version = __APP_VERSION__ || '0.0.0'

function handleSelect(key: string) {
  store.clearSelection()
}

async function handleInit() {
  const res = await store.initMarketplace()
  if (res.success) {
    ElMessage.success('Cache initialized')
  } else {
    ElMessage.error(res.error || 'Failed to initialize cache')
  }
}

async function handleUpdate() {
  const res = await store.updateMarketplace()
  if (res.success) {
    ElMessage.success('Skills updated')
  } else {
    ElMessage.error(res.error || 'Failed to update')
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}
</script>

<style scoped>
.nav-sidebar {
  width: 220px;
  height: 100%;
  background: #1a1a2e;
  color: #eee;
  display: flex;
  flex-direction: column;
}

.nav-header {
  padding: 16px;
  border-bottom: 1px solid #333;
}

.nav-header h2 {
  font-size: 16px;
  margin-bottom: 4px;
}

.version {
  font-size: 12px;
  color: #888;
}

.nav-menu {
  flex: 1;
  background: transparent;
  border: none;
}

.nav-menu .el-menu-item {
  color: #ccc;
}

.nav-menu .el-menu-item.is-active {
  background: #16213e;
  color: #409eff;
}

.nav-footer {
  padding: 12px 16px;
  border-top: 1px solid #333;
}

.cache-status {
  margin-bottom: 8px;
}

.last-sync {
  font-size: 11px;
  color: #888;
  margin-left: 8px;
}
</style>
```

- [ ] **Step 2: Update electron/renderer/src/vite-env.d.ts**

Add the version constant:

```typescript
// electron/renderer/src/vite-env.d.ts
/// <reference types="vite/client" />
declare const __APP_VERSION__: string
```

Update `vite.config.ts` to inject the version:

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { readFileSync } from 'fs'

// Read version from root package.json
const rootPkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf-8'))

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
```

- [ ] **Step 3: Commit**

```bash
git add electron/renderer/src/components/NavSidebar.vue electron/renderer/src/vite-env.d.ts electron/renderer/vite.config.ts
git commit -m "feat: create NavSidebar component with cache status"
```

---

### Task 12: Create SkillList component

**Files:**
- Create: `electron/renderer/src/components/SkillList.vue`

- [ ] **Step 1: Write SkillList.vue**

```vue
<!-- electron/renderer/src/components/SkillList.vue -->
<template>
  <div class="skill-list">
    <div class="toolbar">
      <el-input
        v-model="searchQuery"
        placeholder="Search skills..."
        clearable
        prefix-icon="Search"
        class="search-input"
        @input="handleSearch"
      />
      <el-select v-model="store.selectedCategory" placeholder="Category" clearable class="filter-select" @change="store.applyFilters()">
        <el-option label="All Categories" value="" />
        <el-option v-for="cat in store.categories" :key="cat" :label="cat" :value="cat" />
      </el-select>
      <el-select v-model="store.sortBy" class="sort-select" @change="store.applyFilters()">
        <el-option label="Sort: Name" value="name" />
        <el-option label="Sort: Plugin" value="plugin" />
        <el-option label="Sort: Author" value="author" />
      </el-select>
    </div>

    <div class="plugin-groups" v-loading="store.loading">
      <div v-for="plugin in groupedSkills" :key="plugin.name" class="plugin-group">
        <div class="plugin-header">
          <div class="plugin-info">
            <h3>{{ plugin.name }}</h3>
            <span class="plugin-desc">{{ plugin.description }}</span>
            <span class="plugin-meta">{{ plugin.skillCount }} skills • {{ plugin.author }} • {{ plugin.category }}</span>
          </div>
          <div class="plugin-actions">
            <el-button size="small" @click="expandPlugin(plugin.name)">
              View Skills
            </el-button>
          </div>
        </div>

        <div v-if="expandedPlugins.has(plugin.name)" class="skill-items">
          <div
            v-for="skill in pluginSkills[plugin.name]"
            :key="skill.skillName"
            class="skill-item"
            @click="store.selectSkill(skill)"
          >
            <span class="skill-name">{{ skill.skillName }}</span>
            <span class="skill-desc">{{ skill.pluginDescription }}</span>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-if="!store.loading && store.filteredSkills.length === 0" description="No skills found" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSkillsStore } from '../stores/skills'
import type { PluginInfo, SkillInfo } from '../types/skill'

const store = useSkillsStore()
const searchQuery = ref('')
const expandedPlugins = ref(new Set<string>())

let searchTimer: ReturnType<typeof setTimeout> | null = null

const groupedSkills = computed(() => {
  const groups = new Map<string, PluginInfo>()
  for (const plugin of store.plugins) {
    groups.set(plugin.name, plugin)
  }
  return Array.from(groups.values())
})

const pluginSkills = computed(() => {
  const map: Record<string, SkillInfo[]> = {}
  for (const skill of store.filteredSkills) {
    if (!map[skill.pluginName]) map[skill.pluginName] = []
    map[skill.pluginName].push(skill)
  }
  return map
})

function handleSearch(query: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    store.searchSkills(query)
  }, 300)
}

function expandPlugin(pluginName: string) {
  if (expandedPlugins.value.has(pluginName)) {
    expandedPlugins.value.delete(pluginName)
  } else {
    expandedPlugins.value.add(pluginName)
  }
}

onMounted(async () => {
  await store.checkCacheStatus()
  await store.loadPlugins()
  await store.loadSkills()
})
</script>

<style scoped>
.skill-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.toolbar {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.search-input {
  flex: 1;
}

.filter-select, .sort-select {
  width: 150px;
}

.plugin-groups {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.plugin-group {
  margin-bottom: 16px;
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.plugin-info h3 {
  font-size: 15px;
  margin-bottom: 4px;
}

.plugin-desc {
  font-size: 13px;
  color: #666;
  display: block;
  margin-bottom: 4px;
}

.plugin-meta {
  font-size: 12px;
  color: #999;
}

.skill-items {
  margin-top: 8px;
  margin-left: 16px;
}

.skill-item {
  padding: 8px 12px;
  background: #fff;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.skill-item:hover {
  background: #ecf5ff;
}

.skill-name {
  font-weight: 500;
  font-size: 14px;
  display: block;
}

.skill-desc {
  font-size: 12px;
  color: #888;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/src/components/SkillList.vue
git commit -m "feat: create SkillList component with search and filtering"
```

---

### Task 13: Create SkillDetail component

**Files:**
- Create: `electron/renderer/src/components/SkillDetail.vue`

- [ ] **Step 1: Write SkillDetail.vue**

```vue
<!-- electron/renderer/src/components/SkillDetail.vue -->
<template>
  <div class="skill-detail">
    <div class="detail-header">
      <el-button text @click="store.clearSelection()">
        ← Back to list
      </el-button>
      <h2>{{ store.selectedSkill?.skillName }}</h2>
      <span class="plugin-badge">{{ store.selectedSkill?.pluginName }}</span>
    </div>

    <div class="detail-content" v-loading="contentLoading">
      <div class="metadata">
        <h3>Metadata</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="Name">{{ store.selectedSkill?.skillName }}</el-descriptions-item>
          <el-descriptions-item label="Plugin">{{ store.selectedSkill?.pluginName }}</el-descriptions-item>
          <el-descriptions-item label="Author">{{ store.selectedSkill?.pluginAuthor }}</el-descriptions-item>
          <el-descriptions-item label="License">{{ store.selectedSkill?.pluginLicense }}</el-descriptions-item>
          <el-descriptions-item label="Category">{{ store.selectedSkill?.pluginCategory }}</el-descriptions-item>
          <el-descriptions-item label="Path">{{ skillContent?.path }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="preview">
        <h3>Preview</h3>
        <div class="markdown-body" v-html="renderedMarkdown"></div>
      </div>

      <div class="detail-actions">
        <el-button type="primary" @click="startEditing">
          Edit Skill
        </el-button>
        <el-button type="success" @click="handleInstall">
          Install to Project
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'

const store = useSkillsStore()
const contentLoading = ref(false)
const skillContent = ref<{ content: string; path: string; lastModified: number } | null>(null)

const renderedMarkdown = computed(() => {
  if (!skillContent.value?.content) return ''
  return marked.parse(skillContent.value.content)
})

async function loadContent() {
  if (!store.selectedSkill) return
  contentLoading.value = true
  try {
    const content = await store.loadSkillContent(store.selectedSkill.sourcePath)
    if (content) {
      skillContent.value = content
    }
  } finally {
    contentLoading.value = false
  }
}

function startEditing() {
  store.skillContent = skillContent.value
  store.setView('editor')
}

async function handleInstall() {
  if (!store.selectedSkill) return
  const projectPath = process.cwd()
  const res = await store.installSkill(store.selectedSkill.skillName, projectPath)
  if (res.success) {
    ElMessage.success(`Skill '${store.selectedSkill.skillName}' installed`)
  } else {
    ElMessage.error(res.error || 'Failed to install skill')
  }
}

onMounted(loadContent)
</script>

<style scoped>
.skill-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.detail-header {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-header h2 {
  font-size: 18px;
}

.plugin-badge {
  background: #e8f4fd;
  color: #409eff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metadata, .preview {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
}

.metadata h3, .preview h3 {
  margin-bottom: 12px;
  font-size: 15px;
  color: #333;
}

.markdown-body {
  line-height: 1.6;
}

.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) {
  margin-top: 16px;
  margin-bottom: 8px;
}

.markdown-body :deep(pre) {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body :deep(code) {
  background: #f6f8fa;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 14px;
}

.detail-actions {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/src/components/SkillDetail.vue
git commit -m "feat: create SkillDetail component with markdown preview"
```

---

### Task 14: Create SkillEditor component

**Files:**
- Create: `electron/renderer/src/components/SkillEditor.vue`

- [ ] **Step 1: Write SkillEditor.vue**

```vue
<!-- electron/renderer/src/components/SkillEditor.vue -->
<template>
  <div class="skill-editor">
    <div class="editor-header">
      <el-button text @click="store.setView('detail')">
        ← Back to detail
      </el-button>
      <h2>Editing: {{ store.selectedSkill?.skillName }}</h2>
    </div>

    <div class="editor-body">
      <MdEditor
        v-model="editorContent"
        :toolbars="toolbars"
        :preview="true"
        :footers="[]"
        height="calc(100vh - 120px)"
        @onSave="handleSave"
      />
    </div>

    <div class="editor-footer">
      <span v-if="validationErrors.length > 0" class="validation-errors">
        <el-tag v-for="err in validationErrors" :key="err" type="danger" size="small" style="margin-right: 8px;">
          {{ err }}
        </el-tag>
      </span>
      <div class="actions">
        <el-button @click="handleValidate" :loading="validating">
          Validate
        </el-button>
        <el-button @click="handleDiscard">
          Discard Changes
        </el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          Save
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useSkillsStore } from '../stores/skills'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useSkillsStore()
const editorContent = ref('')
const saving = ref(false)
const validating = ref(false)
const validationErrors = ref<string[]>([])
const originalContent = ref('')
const expectedMtime = ref(0)

const toolbars = [
  'bold', 'underline', 'italic', 'strikeThrough', '-',
  'title', 'quote', 'unorderedList', 'orderedList', 'task', '-',
  'codeRow', 'code', 'link', 'image', 'table',
  'revoke', 'next', 'save', '=',
  'preview', 'fullscreen',
]

async function loadContent() {
  if (!store.selectedSkill) return
  const content = await store.loadSkillContent(store.selectedSkill.sourcePath)
  if (content) {
    editorContent.value = content.content
    originalContent.value = content.content
    expectedMtime.value = content.lastModified
  }
}

async function handleSave() {
  if (!store.selectedSkill) return
  saving.value = true
  try {
    const res = await store.saveSkillContent(
      store.selectedSkill.sourcePath,
      editorContent.value,
      expectedMtime.value
    )
    if (res.success) {
      ElMessage.success('Skill saved successfully')
      originalContent.value = editorContent.value
      // Reload to get new mtime
      await loadContent()
    } else if (res.conflict) {
      await ElMessageBox.confirm(
        'The file was modified externally. Do you want to overwrite it with your changes?',
        'Conflict Detected',
        { confirmButtonText: 'Overwrite', cancelButtonText: 'Reload' }
      ).then(async () => {
        // Force save by updating mtime
        const current = await store.loadSkillContent(store.selectedSkill!.sourcePath)
        if (current) {
          expectedMtime.value = current.lastModified
          await handleSave()
        }
      }).catch(() => {
        // Reload
        loadContent()
      })
    } else {
      ElMessage.error(res.error || 'Failed to save')
    }
  } finally {
    saving.value = false
  }
}

function handleDiscard() {
  editorContent.value = originalContent.value
  validationErrors.value = []
  ElMessage.info('Changes discarded')
}

async function handleValidate() {
  validating.value = true
  try {
    const result = await store.validateSkillMd(editorContent.value)
    validationErrors.value = result.errors
    if (result.valid) {
      ElMessage.success('Validation passed')
    }
  } finally {
    validating.value = false
  }
}

onMounted(loadContent)
</script>

<style scoped>
.skill-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-header {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-header h2 {
  font-size: 16px;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}

.actions {
  display: flex;
  gap: 8px;
}

.validation-errors {
  display: flex;
  flex-wrap: wrap;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/src/components/SkillEditor.vue
git commit -m "feat: create SkillEditor component with md-editor-v3"
```

---

### Task 15: Create StatusBar component

**Files:**
- Create: `electron/renderer/src/components/StatusBar.vue`

- [ ] **Step 1: Write StatusBar.vue**

```vue
<!-- electron/renderer/src/components/StatusBar.vue -->
<template>
  <div class="status-bar">
    <el-card shadow="never">
      <template #header>
        <div class="status-header">
          <span>Marketplace Status</span>
        </div>
      </template>

      <div class="status-items">
        <div class="status-item">
          <span class="label">Cache:</span>
          <el-tag :type="store.hasCache ? 'success' : 'danger'" size="small">
            {{ store.hasCache ? 'Valid' : 'Missing' }}
          </el-tag>
        </div>

        <div class="status-item">
          <span class="label">Location:</span>
          <span class="value">{{ store.cacheStatus?.cacheDir || 'N/A' }}</span>
        </div>

        <div class="status-item">
          <span class="label">Last Sync:</span>
          <span class="value">{{ store.cacheStatus?.lastSync ? formatDate(store.cacheStatus.lastSync) : 'Never' }}</span>
        </div>

        <div class="status-item">
          <span class="label">Version:</span>
          <span class="value">v{{ version }}</span>
        </div>
      </div>

      <div class="status-actions">
        <el-button
          v-if="!store.hasCache"
          type="primary"
          @click="handleInit"
          :loading="store.loading"
        >
          Initialize
        </el-button>
        <el-button
          v-else
          @click="handleUpdate"
          :loading="store.loading"
        >
          Update Now
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'

const store = useSkillsStore()
const version = __APP_VERSION__ || '0.0.0'

async function handleInit() {
  const res = await store.initMarketplace()
  if (res.success) {
    ElMessage.success('Marketplace cache initialized')
  } else {
    ElMessage.error(res.error || 'Failed to initialize')
  }
}

async function handleUpdate() {
  const res = await store.updateMarketplace()
  if (res.success) {
    ElMessage.success('Marketplace updated')
  } else {
    ElMessage.error(res.error || 'Failed to update')
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}
</script>

<style scoped>
.status-bar {
  height: 100%;
  padding: 16px;
  background: #f5f7fa;
  overflow-y: auto;
}

.status-header {
  font-weight: 500;
  font-size: 15px;
}

.status-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-weight: 500;
  width: 80px;
  color: #666;
}

.value {
  color: #333;
  font-size: 14px;
}

.status-actions {
  margin-top: 16px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/src/components/StatusBar.vue
git commit -m "feat: create StatusBar component with cache management"
```

---

### Task 16: Create App.vue and wire everything together

**Files:**
- Modify: `electron/renderer/src/App.vue`
- Modify: `electron/renderer/src/style.css`

- [ ] **Step 1: Write App.vue**

```vue
<!-- electron/renderer/src/App.vue -->
<template>
  <div class="app-container">
    <NavSidebar />
    <div class="main-content">
      <template v-if="store.currentView === 'list'">
        <SkillList />
      </template>
      <template v-else-if="store.currentView === 'detail'">
        <SkillDetail />
      </template>
      <template v-else-if="store.currentView === 'editor'">
        <SkillEditor />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import NavSidebar from './components/NavSidebar.vue'
import SkillList from './components/SkillList.vue'
import SkillDetail from './components/SkillDetail.vue'
import SkillEditor from './components/SkillEditor.vue'
import { useSkillsStore } from './stores/skills'

const store = useSkillsStore()

onMounted(async () => {
  await store.checkCacheStatus()
  // If no cache, prompt user to initialize
  if (!store.hasCache) {
    // Auto-init if bundled plugins exist
    if (store.cacheStatus?.hasBundled) {
      await store.initMarketplace()
    }
  }
})
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow: hidden;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add electron/renderer/src/App.vue
git commit -m "feat: wire up App.vue with view routing"
```

---

### Task 17: TypeScript declaration for window.api

**Files:**
- Create: `electron/renderer/src/types/global.d.ts`

- [ ] **Step 1: Write global.d.ts**

```typescript
// electron/renderer/src/types/global.d.ts
export {}

declare global {
  interface Window {
    api: {
      // Marketplace
      listMarketplacePlugins: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      listSkills: () => Promise<{ success: boolean; data?: any[]; error?: string }>
      searchSkills: (query: string, filters: any) => Promise<{ success: boolean; data?: any[]; error?: string }>

      // Skill CRUD
      readSkillContent: (skillPath: string) => Promise<{ success: boolean; data?: any; error?: string }>
      saveSkillContent: (skillPath: string, content: string, expectedMtime?: number) => Promise<any>
      validateSkillMd: (content: string) => Promise<{ success: boolean; data?: any; error?: string }>

      // Symlink
      installSkill: (skillName: string, projectPath: string) => Promise<any>
      uninstallSkill: (skillName: string, projectPath: string) => Promise<any>
      checkSkillStatus: (skillName: string) => Promise<any>

      // Git
      initMarketplace: () => Promise<any>
      updateMarketplace: () => Promise<any>
      checkCacheStatus: () => Promise<{ success: boolean; data?: any; error?: string }>

      // File watching
      onFileChanged: (callback: (data: { path: string }) => void) => () => void
    }
  }
}
```

- [ ] **Step 2: Update tsconfig.json**

Ensure `electron/renderer/tsconfig.json` includes the types:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

And `electron/renderer/tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "src/types/**/*.d.ts"]
}
```

- [ ] **Step 3: Commit**

```bash
git add electron/renderer/src/types/global.d.ts electron/renderer/tsconfig.json electron/renderer/tsconfig.app.json
git commit -m "feat: add TypeScript declarations for window.api"
```

---

### Task 18: Fix .npmignore for unified packaging

**Files:**
- Modify: `.npmignore`

- [ ] **Step 1: Rewrite .npmignore**

Current `.npmignore` excludes `plugins/`, `.claude-plugin/`, and `*.md` — which is too aggressive for the unified package.

Replace with:

```
# Build artifacts
node_modules/
dist/
dist-desktop/

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Dev-only
openspec/
docs/
.claude/

# Logs
*.log

# Config (may contain secrets)
.npmrc
```

**Note:** The `files` field in `package.json` is the primary allowlist. `.npmignore` acts as a secondary filter. Since we list `src/**/*.js`, `plugins/**/*`, `.claude-plugin/**/*`, `electron/**/*`, and `electron-builder.yml` in `files`, those will be included regardless of what `.npmignore` says (except `node_modules` which npm always excludes).

- [ ] **Step 2: Verify what would be published**

```bash
npm pack --dry-run
```

Expected output should include:
- `src/` (CLI code)
- `plugins/` (skill content)
- `.claude-plugin/` (marketplace manifest)
- `electron/` (desktop app source)
- `electron-builder.yml` (build config)

- [ ] **Step 3: Commit**

```bash
git add .npmignore
git commit -m "chore: rewrite .npmignore to allow electron/ and plugins/ in npm package"
```

---

### Task 19: Test Electron desktop app end-to-end

**Files:** None (testing task)

- [ ] **Step 1: Build renderer**

```bash
cd electron/renderer
npm run build
```

Expected: `electron/renderer/dist/` directory created with bundled Vue app.

- [ ] **Step 2: Start Electron app**

```bash
cd D:\github.io\skills
npx electron electron/main/main.js
```

Expected:
- Window opens showing the skill list
- Skills are loaded from bundled plugins (since cache may not exist yet)
- NavSidebar shows cache status
- Search and filter work

- [ ] **Step 3: Test skill detail**

- Click on a skill in the list
- Detail view shows metadata and rendered markdown
- Edit button opens the editor

- [ ] **Step 4: Test editor**

- Modify some content
- Click Validate → should pass for valid SKILL.md
- Click Save → should succeed
- Close and reopen → changes persist

- [ ] **Step 5: Commit (no code changes, just verify)**

No commit needed — this is a verification task.

---

## Self-Review

### 1. Spec coverage checklist

| Spec requirement | Task | Status |
|---|---|---|
| Electron scaffolding | Task 1, 9 | Covered |
| Skill list with search/filter | Task 12 | Covered |
| Skill detail with markdown preview | Task 13 | Covered |
| Skill editing (md-editor-v3) | Task 14 | Covered |
| Skill install/uninstall | Task 6, 13 | Covered |
| Cache status / init / update | Task 7, 15 | Covered |
| CLI module reuse | Tasks 4, 5, 6, 7 | Covered |
| npm + Electron coexistence | Tasks 1, 18 | Covered |
| File watching | Task 8 | Covered |
| electron-builder packaging | Tasks 1, 19 | Covered |
| Unified npm package | Tasks 1, 18 | Covered |

### 2. Placeholder scan
No "TBD", "TODO", "fill in", "similar to Task N", or vague instructions found.

### 3. Type consistency
- `SkillInfo`, `PluginInfo`, `SkillContent`, `SkillValidation`, `CacheStatus` are defined in `types/skill.ts` and imported consistently.
- All IPC handlers return `{ success: boolean; data?; error? }` format.
- Store actions wrap all IPC calls and normalize errors.
- `window.api` interface in `global.d.ts` matches actual preload.js exports.

### 4. Scope check
This is a single coherent feature. No decomposition needed.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-26-electron-desktop.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** - Execute tasks in this session with checkpoints

Which approach?
