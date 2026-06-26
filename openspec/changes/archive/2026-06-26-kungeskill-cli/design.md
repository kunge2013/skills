# Design: kungeskill-cli

## Architecture

```
D:\github.io\skills/                          ← marketplace 仓库
├── package.json                              ← kungeskill CLI 入口
├── src/
│   ├── cli.js                                ← 命令解析（commander）
│   ├── commands/
│   │   ├── init.js                           ← clone marketplace
│   │   ├── list.js                           ← 列出可安装 skills
│   │   ├── add.js                            ← 安装 skill（软链）
│   │   ├── remove.js                         ← 卸载 skill
│   │   ├── view.js                           ← 查看已安装 skills
│   │   ├── update.js                         ← 更新缓存
│   │   └── doctor.js                         ← 健康检测
│   ├── core/
│   │   ├── registry.js                       ← marketplace.json 解析
│   │   ├── cache.js                          ← 缓存目录管理
│   │   ├── symlink.js                        ← 跨平台软链
│   │   └── config.js                         ← ~/.kungeskills/config.json
│   └── utils/
│       ├── logger.js                         ← 格式化输出
│       ├── platform.js                       ← 平台检测
│       └── git.js                            ← git 操作封装
│
~/.kungeskills/                               ← 全局缓存
├── config.json
│   {
│     "marketplace": {
│       "url": "https://github.com/kunge2013/skills",
│       "branch": "main",
│       "cloned": true,
│       "lastSync": "2026-06-26T..."
│     }
│   }
│
└── cache/
    └── marketplace/                          ← git clone 结果
        ├── .git/
        ├── .claude-plugin/marketplace.json   ← registry 来源
        └── plugins/
            ├── openspec-workflow/skills/
            └── openspec-trace/skills/

当前项目/
└── .claude/skills/                           ← 项目级软链
    ├── openspec-explore → ~/.kungeskills/cache/marketplace/plugins/openspec-workflow/skills/openspec-explore
    └── opst-code-anysic → ~/.kungeskills/cache/marketplace/plugins/openspec-trace/skills/opst-code-anysic
```

## Key Design Decisions

### 1. Registry 解析

从 `cache/marketplace/.claude-plugin/marketplace.json` 读取：

```json
{
  "plugins": [
    {
      "name": "openspec-workflow",
      "source": "./plugins/openspec-workflow",
      ...
    }
  ]
}
```

解析逻辑：
1. 读取 `marketplace.json` 获取 `plugins[]`
2. 对每个 plugin，读取 `plugins/<name>/skills/` 目录
3. 每个 skill 目录名即为 skill name
4. 构建 `{ skillName → sourcePath }` 映射表

`kungeskill list` 展示：
```
Available skills:

  PLUGIN                  SKILLS
  openspec-workflow       openspec-explore
                          openspec-propose
                          openspec-apply-change
                          openspec-archive-change

  openspec-trace          opst-code-anysic
                          opst-business-search
```

### 2. 软链实现

```javascript
// core/symlink.js
function createSkillSymlink(targetAbsPath, linkAbsPath) {
  // targetAbsPath: ~/.kungeskills/cache/marketplace/plugins/.../skill-name
  // linkAbsPath:   .claude/skills/skill-name

  const opts = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(path.resolve(targetAbsPath), linkAbsPath, opts);
}
```

**Windows 注意事项**：
- junction points 要求目标是绝对路径（`path.resolve()` 处理）
- junction points 不能跨驱动器 → 检测 `path.parse().root` 差异
- Windows 10 1703+ 开发者模式可创建真 symlink → 优先尝试 `symlink`，fallback 到 `junction`

**跨驱动器检测**：
```javascript
function canCreateJunction(targetPath, linkPath) {
  return path.parse(targetPath).root === path.parse(linkPath).root;
}
```

如果跨驱动器，fallback 到文件复制（不走软链），并警告用户。

### 3. 项目定位

`kungeskill` 需要在当前项目目录操作 `.claude/skills/`。定位策略：

```javascript
function findProjectSkillsDir(cwd = process.cwd()) {
  // 向上查找 .claude/skills/
  let dir = cwd;
  while (dir !== path.parse(dir).root) {
    const skillsDir = path.join(dir, '.claude', 'skills');
    if (fs.existsSync(skillsDir)) return skillsDir;
    dir = path.dirname(dir);
  }
  // 没找到 → 在当前目录创建
  return path.join(cwd, '.claude', 'skills');
}
```

### 4. 缓存管理

```
kungeskill init
  → 检查 ~/.kungeskills/cache/marketplace/.git 是否存在
  → 不存在 → git clone <url> --branch <branch>
  → 更新 config.json

kungeskill update
  → cd ~/.kungeskills/cache/marketplace
  → git pull origin <branch>
  → 更新 config.json.lastSync
  → 软链自动生效（无需重建）
```

**离线工作**：如果缓存已存在，`add` 操作不需要网络。只有在 `init` 和 `update` 时需要网络。

### 5. 健康检测（doctor）

```
检查项：
  1. 缓存目录是否存在
  2. 缓存是否有 .git（是否是有效 git clone）
  3. 每个 .claude/skills/ 下的软链：
     a. 是否是软链？fs.lstat().isSymbolicLink()
     b. 软链目标是否存在 fs.existsSync()（follows link）
     c. 目标是否包含 SKILL.md
  4. marketplace.json 是否在缓存中可解析

状态标识：
  ✓ ok       — 软链有效，目标存在
  ✗ broken   — 软链目标不存在
  ⚠ outdated — 缓存中有更新版本（对比 lastSync 与 git log）
```

### 6. CLI 依赖

使用 `commander` 作为命令解析框架：

```javascript
// cli.js
const { program } = require('commander');

program
  .name('kungeskill')
  .description('Manage Claude Code skills via symlinks')
  .version('0.1.0');

program.command('init').description('Initialize marketplace cache').action(cmdInit);
program.command('list').option('--installed', 'Show only installed skills').action(cmdList);
program.command('add <skill>').description('Install a skill via symlink').action(cmdAdd);
program.command('remove <skill>').description('Remove a skill symlink').action(cmdRemove);
program.command('view').description('Show installed skills with health status').action(cmdView);
program.command('update [skill]').description('Update marketplace cache').action(cmdUpdate);
program.command('doctor').description('Check symlink health').action(cmdDoctor);

program.parse();
```

### 7. 数据流

```
用户: kungeskill add openspec-explore
  │
  ├─ 1. 检查缓存
  │     └─ 不存在 → 自动 init (git clone)
  │
  ├─ 2. 解析 registry
  │     └─ 读取 cache/marketplace/.claude-plugin/marketplace.json
  │     └─ 找到 openspec-explore 路径
  │
  ├─ 3. 验证源目录
  │     └─ 确认 SKILL.md 存在
  │
  ├─ 4. 定位项目 skills 目录
  │     └─ 向上查找 .claude/skills/ 或创建
  │
  ├─ 5. 创建软链
  │     └─ .claude/skills/openspec-explore → cache/.../openspec-explore
  │
  └─ 6. 输出 ✓ Installed openspec-explore
```

### 8. 错误处理

| 错误 | 处理 |
|------|------|
| 缓存不存在 | 自动 init |
| skill 不存在 | 报错：`Skill 'xxx' not found in marketplace` |
| 软链已存在 | 提示已安装，建议 `--force` 重建 |
| Windows 跨驱动器 | Fallback 到文件复制 + 警告 |
| 网络不可用（init/update） | 报错：`Network unavailable, use cached skills` |
| 权限不足（symlink） | 报错 + 提示 Windows 开发者模式 |
| marketplace.json 无效 | 报错：`Invalid marketplace manifest` |
