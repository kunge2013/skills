# Design: plugin-marketplace-setup

## Architecture

```
D:\github.io\skills/
├── .claude-plugin/
│   └── marketplace.json              ← Marketplace 入口（Claude Code 识别）
│
├── plugins/
│   ├── openspec-workflow/             ← Plugin 1: 变更生命周期
│   │   ├── plugin.json               ← Plugin manifest
│   │   └── skills/
│   │       ├── openspec-explore/
│   │       │   └── SKILL.md
│   │       ├── openspec-propose/
│   │       │   └── SKILL.md
│   │       ├── openspec-apply-change/
│   │       │   └── SKILL.md
│   │       └── openspec-archive-change/
│   │           └── SKILL.md
│   │
│   └── openspec-trace/                ← Plugin 2: 知识库
│       ├── plugin.json               ← Plugin manifest
│       └── skills/
│           ├── opst-code-anysic/
│           │   └── SKILL.md
│           └── opst-business-search/
│               └── SKILL.md
│
├── openspec/                          ← 保留（项目自身 openspec 配置）
├── .gitignore
└── README.md                          ← 更新为 marketplace 安装文档
```

## Key Design Decisions

### 1. Marketplace 配置

```json
{
  "name": "kunge-skills",
  "owner": {
    "name": "kunge2013",
    "email": "kun_ja@163.com"
  },
  "description": "OpenSpec-based development workflow skills for Claude Code",
  "plugins": [...]
}
```

- `name: kunge-skills` — 用户安装时的标识符
- 不使用 `metadata.pluginRoot`，直接在 source 中用相对路径

### 2. Plugin Source 策略

使用 **相对路径** source（`./plugins/openspec-workflow`），因为：
- plugins 和 marketplace 在同一仓库
- 用户通过 git 添加 marketplace，相对路径可正确解析
- 无需额外维护外部仓库引用

### 3. 版本策略

不设置 `version` 字段：
- Claude Code 自动使用 git commit SHA 作为版本标识
- 每次 push 到 main 即为新版本
- 用户执行 `/plugin marketplace update` 获取最新内容
- 未来如需稳定版本，可通过 git tag + `ref` 字段 pin 住

### 4. Plugin 独立性

两个 plugin 完全独立，无依赖关系：
- `openspec-workflow`: 探索、提案、实施、归档
- `openspec-trace`: 代码分析、业务搜索

用户可以只安装其中一个。

### 5. Strict Mode

使用默认 `strict: true`：
- 每个 plugin 有自己的 `plugin.json` 作为权威定义
- marketplace entry 提供补充元数据（description, keywords, category）
- 两层定义合并，plugin.json 优先

## Data Flow

```
用户操作:
  /plugin marketplace add kunge2013/skills
       │
       ▼
  Claude Code 克隆 GitHub 仓库
       │
       ▼
  读取 .claude-plugin/marketplace.json
       │
       ▼
  展示可用 plugins 列表
       │
       ▼
  /plugin install openspec-workflow@kunge-skills
       │
       ▼
  复制 plugins/openspec-workflow/ 到本地 cache
       │
       ▼
  读取 plugin.json → 发现 skills/ 目录
       │
       ▼
  加载 skills（用户会话中可用）
```

## Migration Plan

| 步骤 | 操作 | 风险 |
|------|------|------|
| 1 | 创建 plugins/ 目录结构 | 无 |
| 2 | 复制 SKILL.md 文件到新位置 | 无（保留原件） |
| 3 | 创建 plugin.json | 无 |
| 4 | 创建 .claude-plugin/marketplace.json | 无 |
| 5 | 验证结构正确性 | 低 |
| 6 | 删除 .claude/skills/ 和 .claude/commands/ | 中（不可逆） |
| 7 | 更新 README.md | 无 |

步骤 6 在确认新结构正确后执行。
