# Tasks: add-electron-desktop

## Phase 1: Electron 脚手架搭建

- [ ] **Task 1: 初始化 Electron 项目结构**

  创建 `electron/` 目录：
  ```
  mkdir -p electron/main/handlers
  mkdir -p electron/renderer
  ```

- [ ] **Task 2: 安装 Electron 依赖到根 package.json**

  在根目录安装 Electron 相关 devDependencies：
  ```
  npm install --save-dev electron electron-builder electron-log chokidar
  ```

- [ ] **Task 3: 安装 renderer 前端依赖**

  在 `electron/renderer/` 下初始化 Vue 3 + Vite + TypeScript 项目：
  ```
  cd electron/renderer
  npm create vite@latest . -- --template vue-ts
  npm install pinia md-editor-v3 element-plus
  ```

- [ ] **Task 4: 更新 package.json scripts**

  在根 `package.json` 添加 Electron 相关脚本：
  ```json
  "dev:desktop": "electron electron/main/main.js",
  "build:desktop": "electron-builder"
  ```

- [ ] **Task 5: 配置 electron-builder.yml**

  创建 `electron-builder.yml`：
  - 应用名: `KungeSkill Desktop`
  - 标识符: `com.kunge2013.skills`
  - 输出: `.exe` (Windows), `.dmg` (macOS), `.AppImage` (Linux)
  - 窗口配置: 1200x800，居中显示
  - 从根 package.json 读取 version

- [ ] **Task 6: 更新 package.json files 字段**

  确保 `files` 包含 `electron/` 目录：
  ```json
  "files": [
    "src/**/*.js",
    "plugins/**/*",
    ".claude-plugin/**/*",
    "electron/**/*",
    "electron-builder.yml"
  ]
  ```

## Phase 2: 主进程 IPC Handlers（复用 CLI 模块）

- [ ] **Task 7: 创建主进程入口**

  `electron/main/main.js`:
  - 创建 BrowserWindow
  - 加载 Vite dev server (开发) 或打包文件 (生产)
  - 注册所有 IPC handlers

- [ ] **Task 8: 创建 preload 脚本**

  `electron/main/preload.js`:
  - 使用 `contextBridge.exposeInMainWorld` 暴露 API
  - 定义所有 `window.api.*` 方法

- [ ] **Task 9: 实现 marketplace handlers**

  `electron/main/handlers/marketplace.js`:
  - 复用 `src/core/registry.js` 的 `listAllSkillsMerged()`、`findSkillMerged()`
  - 复用 `src/core/cache.js` 的 `getAllMarketplaceDirs()`
  - IPC: `marketplace:list-plugins`, `marketplace:list-skills`, `marketplace:search`

- [ ] **Task 10: 实现 skill CRUD handlers**

  `electron/main/handlers/skill.js`:
  - `fs.readFile` / `fs.writeFile` 读写 SKILL.md
  - frontmatter 校验（name、description 必须存在）
  - 写入前检查文件 mtime（冲突检测）
  - IPC: `skill:read`, `skill:save`, `skill:validate`

- [ ] **Task 11: 实现 symlink handlers**

  `electron/main/handlers/symlink.js`:
  - 复用 `src/core/symlink.js` 的 `createSkillSymlink()`、`getSymlinkStatus()`
  - 复用 `src/commands/shared.js` 的 `findProjectSkillsDir()`
  - IPC: `symlink:install`, `symlink:uninstall`, `symlink:status`

- [ ] **Task 12: 实现 git handlers**

  `electron/main/handlers/git.js`:
  - 复用 `src/utils/git.js` 的 `cloneRepo()`、`pullRepo()`
  - 复用 `src/core/config.js` 的 `getConfig()`、`updateConfig()`
  - IPC: `git:init`, `git:update`, `git:cache-status`

- [ ] **Task 13: 实现文件监听**

  `electron/main/handlers/watcher.js`:
  - 使用 `chokidar` 监听 skill 文件变更
  - 变更通知通过 `webContents.send('file:changed')` 发送到渲染进程
  - IPC: `watch:start`, `watch:stop`

## Phase 3: 前端 UI 实现

- [ ] **Task 14: 实现侧边栏导航**

  `components/NavSidebar.vue`:
  - 菜单: All Skills / Installed / Updates / Settings
  - 底部显示缓存状态和版本信息
  - Element Plus 侧边栏组件

- [ ] **Task 15: 实现 Skill 列表页**

  `components/SkillList.vue`:
  - 搜索框（实时过滤）
  - 分类下拉筛选
  - 排序选项
  - 按 plugin 分组的列表
  - 每个 plugin 显示: 图标、名称、skill 数量、作者

- [ ] **Task 16: 实现 Skill 详情页**

  `components/SkillDetail.vue`:
  - 左侧: Metadata（名称、作者、许可证、版本）
  - 右侧: Markdown 渲染预览
  - 操作按钮: [Edit] [Install to Project]

- [ ] **Task 17: 实现 Skill 编辑器**

  `components/SkillEditor.vue`:
  - 使用 md-editor-v3
  - 分屏: 编辑 + 预览
  - 工具栏: [Save] [Discard] [Validate]
  - 保存时校验 frontmatter

- [ ] **Task 18: 实现状态栏/设置页**

  `components/StatusBar.vue`:
  - 缓存状态指示器
  - 一键更新按钮
  - 版本号显示

## Phase 4: 集成与测试

- [ ] **Task 19: 前后端联调**

  - 验证所有 IPC handler 调用正确
  - 错误处理: Node.js Error → Vue ElMessage 提示
  - 加载状态: 异步操作显示 loading

- [ ] **Task 20: 跨平台打包测试**

  - Windows: junction point 创建/删除 + .exe 打包
  - macOS: symlink 创建 + .dmg 打包
  - Linux: symlink 创建 + .AppImage 打包

- [ ] **Task 21: 验证共存与 npm 发布**

  - 确认 `npm publish` 包含 `electron/` 目录
  - `npm install -g kungeskill` 后 `dev:desktop` 可运行
  - CLI `kungeskill list/add/remove` 与桌面应用操作同一数据源
  - 文件监听在外部编辑后正确触发刷新
  - Electron devDependencies 不影响 CLI 用户安装体积
