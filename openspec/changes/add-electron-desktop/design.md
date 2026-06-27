# Design: add-electron-desktop

## 1. 项目结构

```
skills/
├── src/                          ← 保持不动 (现有 Node.js CLI)
│   ├── cli.js
│   ├── core/                     ← 可被 Electron 复用
│   │   ├── config.js  ───────────────┐
│   │   ├── cache.js    ──────────────┤
│   │   ├── registry.js  ─────────────┤  Electron 主进程 require()
│   │   └── symlink.js   ─────────────┘
│   ├── commands/
│   │   ├── init.js
│   │   ├── list.js
│   │   ├── add.js
│   │   ├── remove.js
│   │   ├── view.js
│   │   ├── update.js
│   │   └── doctor.js
│   └── utils/
│       ├── logger.js
│       └── git.js
│
├── electron/                     ← 新增 (Electron 桌面应用，一起发布到 npm)
│   ├── main/                     ← Electron 主进程
│   │   ├── main.js               ← Electron 入口 (BrowserWindow, IPC)
│   │   ├── preload.js            ← contextBridge, expose API
│   │   └── handlers/
│   │       ├── marketplace.js    ← 复用 src/core/registry.js
│   │       ├── skill.js          ← 复用 src/core/ + 文件读写
│   │       ├── symlink.js        ← 复用 src/core/symlink.js
│   │       └── git.js            ← 复用 src/utils/git.js
│   └── renderer/                 ← Electron 渲染进程 (Vue 3)
│       ├── index.html
│       ├── package.json          ← renderer 独立依赖 (Vue/Vite)
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── components/
│           │   ├── SkillList.vue      ← 搜索/列表/筛选
│           │   ├── SkillDetail.vue    ← 详情预览
│           │   ├── SkillEditor.vue    ← md-editor-v3 编辑
│           │   ├── StatusBar.vue      ← 缓存/安装状态
│           │   └── NavSidebar.vue     ← 侧边栏导航
│           ├── stores/
│           │   └── skills.ts          ← Pinia state
│           ├── types/
│           │   └── skill.ts           ← 类型定义
│           └── styles/
│               └── main.css
│
├── plugins/                      ← 共享数据源
├── package.json                  ← 统一管理 CLI + Electron 依赖
├── electron-builder.yml          ← 打包配置 (.exe/.dmg/.AppImage)
└── .npmignore                    ← 仅排除 node_modules 等，不排除 electron/
```

## 2. 代码复用策略

核心原则：**Electron 主进程直接 require CLI 的 `core/` 模块**。

```javascript
// electron/main/handlers/marketplace.js
const { parseMarketplace, listAllSkillsMerged } = require('../../../src/core/registry.js');
const { getMarketplaceSourceDir } = require('../../../src/core/cache.js');

// electron/main/handlers/symlink.js
const { createSkillSymlink, getSymlinkStatus } = require('../../../src/core/symlink.js');
const { findProjectSkillsDir } = require('../../../src/commands/shared.js');

// electron/main/handlers/git.js
const { cloneRepo, pullRepo } = require('../../../src/utils/git.js');
const { getConfig, updateConfig } = require('../../../src/core/config.js');
```

**不可复用的部分**：
- `src/utils/logger.js` — 依赖 `process.stdout` 彩色输出，Electron 需要替换为日志文件或 IPC 消息
- `src/cli.js` — 命令行参数解析，Electron 不需要

**logger 替代方案**：Electron 主进程使用 `electron-log` 或自定义简单 logger，通过 IPC 向渲染进程发送状态消息。

## 3. 技术栈

| 层 | 技术 | 版本 | 理由 |
|----|------|------|------|
| 桌面框架 | Electron | 最新版 | 成熟稳定，Node.js 生态复用 |
| 构建/打包 | electron-builder | 最新版 | 跨平台打包 (.exe/.dmg/.AppImage) |
| 开发工具 | electron-builder + Vite | | 热更新开发体验 |
| 前端框架 | Vue 3 | 3.x | 生态好，md-editor-v3 依赖 |
| 构建工具 | Vite | 6.x | 快速热更新 |
| 状态管理 | Pinia | 2.x | Vue 3 官方推荐 |
| Markdown 编辑器 | md-editor-v3 | 最新版 | Vue 专属，所见即所得 |
| UI 组件库 | Element Plus | 2.x | 中文生态好，表格/表单/弹窗组件齐全 |
| 日志 | electron-log | 最新版 | 替代 console，支持文件日志 |

## 4. IPC 接口（主进程 ↔ 渲染进程）

```javascript
// electron/main/preload.js — 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('api', {
  // marketplace
  listMarketplacePlugins: () => ipcRenderer.invoke('marketplace:list-plugins'),
  listSkills: () => ipcRenderer.invoke('marketplace:list-skills'),
  searchSkills: (query, filters) => ipcRenderer.invoke('marketplace:search', query, filters),

  // skill CRUD
  readSkillContent: (skillPath) => ipcRenderer.invoke('skill:read', skillPath),
  saveSkillContent: (skillPath, content) => ipcRenderer.invoke('skill:save', skillPath, content),
  validateSkillMd: (content) => ipcRenderer.invoke('skill:validate', content),

  // symlink management
  installSkill: (skillName, projectPath) => ipcRenderer.invoke('symlink:install', skillName, projectPath),
  uninstallSkill: (skillName, projectPath) => ipcRenderer.invoke('symlink:uninstall', skillName, projectPath),
  checkSkillStatus: (skillName) => ipcRenderer.invoke('symlink:status', skillName),

  // git operations
  initMarketplace: () => ipcRenderer.invoke('git:init'),
  updateMarketplace: () => ipcRenderer.invoke('git:update'),
  checkCacheStatus: () => ipcRenderer.invoke('git:cache-status'),

  // file watching
  watchSkillFiles: (callback) => ipcRenderer.on('file:changed', callback),
  unwatchSkillFiles: () => ipcRenderer.invoke('watch:stop'),
});
```

**主进程 handler 实现**：直接调用 `src/core/` 中的函数。

```javascript
// electron/main/handlers/marketplace.js
const { listAllSkillsMerged, findSkillMerged } = require('../../../src/core/registry.js');
const { getAllMarketplaceDirs, getMarketplaceSourceDir } = require('../../../src/core/cache.js');

ipcMain.handle('marketplace:list-skills', async () => {
  try {
    const sourceDirs = getAllMarketplaceDirs();
    const skills = listAllSkillsMerged(sourceDirs);
    return { success: true, data: skills };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

## 5. 前端页面结构

```
┌──────────────────────────────────────────────────────────────────┐
│  KungeSkill Desktop                                [─][□][×]      │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  Nav       │  Main Content Area                                   │
│            │                                                     │
│  📚 All    │  ┌─────────────────────────────────────────────┐   │
│    Skills  │  │ 🔍 [Search skills...]  [Category ▼] [Sort ▼] │   │
│            │  └─────────────────────────────────────────────┘   │
│  📦        │                                                     │
│  Installed │  ┌─────────────────────────────────────────────┐   │
│            │  │ ┌──────┐  openspec-workflow                  │   │
│  🔄        │  │ │ 📄   │  4 skills • workflow                │   │
│  Updates   │  │ │ icon │  Author: kunge2013                 │   │
│            │  │ └──────┘  [View] [Install All]              │   │
│  ⚙️        │  └─────────────────────────────────────────────┘   │
│  Settings  │                                                     │
│            │  ┌─────────────────────────────────────────────┐   │
│  ────────  │  │ ┌──────┐  anthropics                       │   │
│            │  │ │ 📄   │  5 skills • official              │   │
│  Cache: OK │  │ │ icon │  Author: Anthropic               │   │
│  v0.5.0    │  │ └──────┘  [View] [Install All]            │   │
│            │  └─────────────────────────────────────────────┘   │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘

Skill Detail View (点击 [View] 后):
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to list          anthropics / pdf                       │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  Metadata  │  Preview (渲染后的 Markdown)                         │
│            │                                                     │
│  Name: pdf │  ┌─────────────────────────────────────────────┐   │
│  Author:   │  │ PDF processing: read, merge, split, ...     │   │
│  Anthropic │  │                                              │   │
│  License:  │  │ ## Usage                                    │   │
│  MIT       │  │ 1. Install dependencies...                  │   │
│  Version:  │  │ 2. Run script...                            │   │
│  1.0       │  │ ...                                        │   │
│            │  └─────────────────────────────────────────────┘   │
│  [Edit]    │                                                     │
│  [Install] │  Actions: [Edit Skill]  [Install to Project]       │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘

Skill Editor View (点击 [Edit Skill] 后):
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to detail          Editing: anthropics / pdf            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┬──────────────────────────────┐       │
│  │  md-editor-v3         │                              │       │
│  │  (编辑模式)            │  预览面板                    │       │
│  │                      │                              │       │
│  │  ---                 │  Rendered preview            │       │
│  │  name: pdf           │  of the markdown...          │       │
│  │  description: ...    │                              │       │
│  │  ---                 │                              │       │
│  │                      │                              │       │
│  │  ## Usage            │                              │       │
│  │  ...                 │                              │       │
│  └──────────────────────┴──────────────────────────────┘       │
│                                                                 │
│  [Save]  [Discard Changes]  [Validate]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 6. 数据流

```
用户操作
  │
  ▼
Vue 组件 (SkillList / SkillEditor / ...)
  │  window.api.*()
  ▼
preload.js (contextBridge)
  │  ipcRenderer.invoke()
  ▼
Electron 主进程 IPC Handlers
  │
  ├── marketplace.js → require('../../../src/core/registry.js')
  ├── skill.js     → fs.readFile / fs.writeFile
  ├── symlink.js   → require('../../../src/core/symlink.js')
  └── git.js       → require('../../../src/utils/git.js')
  │
  ▼
文件系统 / Git / 符号链接 (同 CLI 操作同一数据源)
  │
  ▼
结果返回 (ipcRenderer → Promise resolve)
  │
  ▼
Vue 组件更新 UI (Pinia store → 响应式渲染)
```

## 7. 文件监听

使用 `chokidar` 监听 skill 文件变更，实现实时更新：

```javascript
// electron/main/handlers/watcher.js
const chokidar = require('chokidar');

let watcher = null;

function startWatching(skillDirs) {
  watcher = chokidar.watch(skillDirs.map(d => `${d}/**/*.md`), {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', (path) => {
    mainWindow.webContents.send('file:changed', { path });
  });
}

function stopWatching() {
  watcher?.close();
  watcher = null;
}
```

## 8. 关键技术决策

### 8.1 SKILL.md 编辑冲突处理
- Electron 编辑时先读取文件内容 → 用户修改 → 写入前检查文件 mtime
- 如有冲突（文件被外部修改），弹窗提示用户选择覆盖或放弃
- 文件监听器触发时，若当前有未保存的编辑，提示用户重新加载

### 8.2 frontmatter 保护策略
- md-editor-v3 编辑时，**frontmatter 区域允许编辑**（用户可能需要修改 description）
- 保存时自动校验 frontmatter 格式（name、description 必须存在）
- 校验失败时阻止保存，显示具体错误信息
- 提供 frontmatter 模板提示

### 8.3 缓存策略
- Electron 启动时检查 `~/.kungeskills/cache/marketplace/` 状态
- 无缓存时弹窗提示用户初始化（等同于 `kungeskill init`）
- 支持一键更新（等同于 `kungeskill update`）
- 与 CLI 共享同一缓存目录，无需独立缓存

### 8.4 symlink 跨平台
- 直接复用 `src/core/symlink.js` 的逻辑（Windows junction / Unix symlink）
- 主进程 Node.js 环境可直接运行该模块

### 8.5 版本策略
- Electron 读取根 `package.json` 的 version 显示 marketplace 版本
- Electron 自身版本号通过 `electron-builder.yml` 的 `extraMetadata.version` 复用根 package.json 版本
- npm 包同时包含 CLI 和 Electron，版本号统一

### 8.6 package.json 配置

**`files` 字段**（发布到 npm 的内容）：
```json
{
  "files": [
    "src/**/*.js",
    "plugins/**/*",
    ".claude-plugin/**/*",
    "electron/**/*",
    "electron-builder.yml"
  ]
}
```

**`scripts` 字段**：
```json
{
  "scripts": {
    "start": "node src/cli.js",
    "list": "node src/cli.js list",
    "init": "node src/cli.js init",
    "dev:desktop": "electron electron/main/main.js",
    "build:desktop": "electron-builder",
    "prepublishOnly": "node src/cli.js --version"
  }
}
```

**`devDependencies`**（Electron 相关依赖）：
```json
{
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest",
    "electron-log": "^latest",
    "chokidar": "^latest"
  }
}
```

**`renderer` 独立依赖**（`electron/renderer/package.json`）：
- Vue 3、Vite、Pinia、md-editor-v3、Element Plus
- 这些是前端构建依赖，不影响 CLI 用户

**.npmignore**（仅排除开发产物）：
```
node_modules/
dist/
*.log
.DS_Store
```

**不**排除 `electron/`，确保桌面应用源码随 npm 包一起分发。

**CLI 用户安装体积说明**：
- Electron 是 `devDependencies`，普通 `npm install -g kungeskill` 不会安装 devDependencies
- CLI 用户安装体积小，不受 Electron 影响
- 桌面开发者使用 `npm install`（开发模式）时会安装 Electron
