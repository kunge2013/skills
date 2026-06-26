# Tasks: kungeskill-cli

## Phase 1: Project Setup

- [x] **Task 1: 初始化 Node.js 项目**

  创建 `package.json`：
  - 项目名称：`kungeskill`
  - 入口：`src/cli.js`
  - bin 字段：`"kungeskill": "src/cli.js"`
  - 依赖：`commander`
  - engines：`node >= 18`

- [x] **Task 2: 创建目录结构**

  ```
  src/
  ├── cli.js                    # CLI 入口（#!/usr/bin/env node）
  ├── commands/
  │   ├── init.js
  │   ├── list.js
  │   ├── add.js
  │   ├── remove.js
  │   ├── view.js
  │   ├── update.js
  │   └── doctor.js
  ├── core/
  │   ├── registry.js
  │   ├── cache.js
  │   ├── symlink.js
  │   └── config.js
  └── utils/
      ├── logger.js
      └── git.js
  ```

## Phase 2: Core Modules

- [x] **Task 3: 实现 config.js**

  - `loadConfig()` → 读取 `~/.kungeskills/config.json`
  - `saveConfig(config)` → 写入配置
  - `getConfig()` → 读取或创建默认配置
  - 默认配置包含 marketplace URL、branch

- [x] **Task 4: 实现 git.js**

  - `cloneRepo(url, targetPath, branch)` → 执行 git clone
  - `pullRepo(cwd)` → 执行 git pull
  - 使用 `child_process.exec` 封装，返回 Promise
  - 处理 stdout/stderr 输出

- [x] **Task 5: 实现 cache.js**

  - `getCacheDir()` → 返回 `~/.kungeskills/cache/marketplace/`
  - `ensureCacheDir()` → 创建缓存目录（如果不存在）
  - `isCacheValid()` → 检查 `.git` 目录是否存在
  - `getKungeskillsDir()` → 返回 `~/.kungeskills/`

- [x] **Task 6: 实现 registry.js**

  - `parseMarketplace(cacheDir)` → 读取 `.claude-plugin/marketplace.json`
  - `listAllSkills(marketplace)` → 返回 `{ skillName, pluginName, sourcePath }` 数组
  - `findSkill(marketplace, skillName)` → 返回单个 skill 的路径信息

- [x] **Task 7: 实现 symlink.js**

  - `createSkillSymlink(targetAbsPath, linkAbsPath)` → 跨平台软链创建
  - `removeSkillSymlink(linkAbsPath)` → 安全删除软链
  - `isSymlinkValid(linkAbsPath)` → 检查是否是有效软链
  - `getSymlinkStatus(linkAbsPath)` → 返回 `{ isValid, target, exists, hasSkillMd }`
  - Windows 使用 `junction` 类型，Linux/macOS 使用 `dir` 类型
  - 跨驱动器检测：fallback 到文件复制

- [x] **Task 8: 实现 logger.js**

  - `info(msg)` → 白色信息输出
  - `success(msg)` → 绿色成功
  - `error(msg)` → 红色错误
  - `warn(msg)` → 黄色警告
  - `status(icon, msg)` → 带图标的状态行

## Phase 3: Commands

- [x] **Task 9: 实现 `init` 命令**

  - 检查缓存是否已存在
  - 如果不存在，git clone marketplace
  - 更新 config.json
  - 输出：`✓ Marketplace cached to ~/.kungeskills/cache/marketplace`

- [x] **Task 10: 实现 `list` 命令**

  - 读取并解析 marketplace.json
  - 按 plugin 分组展示 skills
  - `--installed` 选项：只显示当前项目已安装的
  - 输出格式：表格形式

- [x] **Task 11: 实现 `add` 命令**

  - 检查缓存（不存在 → 自动 init）
  - 查找 skill 路径
  - 验证 SKILL.md 存在
  - 定位或创建 `.claude/skills/` 目录
  - 创建软链
  - 输出：`✓ Installed <skill-name>`

- [x] **Task 12: 实现 `remove` 命令**

  - 验证软链存在
  - 安全删除（只删软链，不删缓存）
  - 输出：`✓ Removed <skill-name>`

- [x] **Task 13: 实现 `view` 命令**

  - 遍历 `.claude/skills/` 下所有条目
  - 对每个条目调用 `getSymlinkStatus()`
  - 输出表格：名称、状态、源路径
  - 状态：`✓ ok` / `✗ broken` / `⚠ outdated`

- [x] **Task 14: 实现 `update` 命令**

  - cd 到缓存目录
  - git pull
  - 更新 config.json.lastSync
  - 输出：`✓ Marketplace updated (<N> skills updated)`

- [x] **Task 15: 实现 `doctor` 命令**

  - 检查缓存目录健康
  - 检查 marketplace.json 可解析
  - 检查每个软链状态
  - 输出摘要：总数、正常、断裂、过期
  - 提供修复建议

## Phase 4: CLI Integration & Testing

- [x] **Task 16: 实现 cli.js 主入口**

  - commander 配置
  - 注册所有命令
  - 全局错误处理
  - shebang 行

- [x] **Task 17: 验证完整流程**

  - `kungeskill init` → clone marketplace
  - `kungeskill list` → 列出 skills
  - `kungeskill add openspec-explore` → 创建软链
  - `kungeskill view` → 验证状态
  - `kungeskill remove openspec-explore` → 删除软链
  - `kungeskill doctor` → 健康检查
  - Windows + Linux + macOS 各测试一次
