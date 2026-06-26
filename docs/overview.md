# kunge-skills — 项目概览

## 项目简介

**kunge-skills** 是一个面向开源社区的 [Claude Code Plugin Marketplace](https://code.claude.com/docs/en/plugins)，提供基于 OpenSpec 的 spec-driven 开发工作流 skills。

用户可以通过 GitHub 一键安装 skills，实现：
- 在写代码前探索需求、明确方案
- 结构化地提出变更提案（proposal / design / tasks）
- 按任务顺序实施，跟踪进度
- 归档完成的变更，同步规范

## 项目架构

```
kunge-skills/
├── .claude-plugin/
│   └── marketplace.json              ← Marketplace 入口（Claude Code 识别）
│
├── plugins/
│   ├── openspec-workflow/             ← Plugin 1: 变更生命周期
│   │   ├── plugin.json
│   │   └── skills/
│   │       ├── openspec-explore/     → 探索模式
│   │       ├── openspec-propose/     → 提案生成
│   │       ├── openspec-apply-change/→ 任务实施
│   │       └── openspec-archive-change/ → 变更归档
│   │
│   └── openspec-trace/                ← Plugin 2: 知识库
│       ├── plugin.json
│       └── skills/
│           ├── opst-code-anysic/     → 代码分析归档
│           └── opst-business-search/ → 业务逻辑搜索
│
├── openspec/                          ← 项目自身 OpenSpec 配置
├── docs/                              ← 项目文档（本目录）
├── .claude/                           ← 本地开发用 skills（不发布）
└── README.md                          ← 快速安装指南
```

## 技术栈

| 组件 | 说明 |
|------|------|
| Claude Code Skills | Claude Code 的技能扩展框架 |
| Plugin Marketplace | Claude Code 官方插件分发机制 |
| OpenSpec | spec-driven 开发工作流标准 |

## 版本策略

使用 **git commit SHA 自动滚动**：
- 不设置显式 `version` 字段
- 每次 push 到 main 即为新版本
- 零维护成本，push 即发布
- 未来如需稳定版本，可通过 git tag + `ref` 字段 pin 住

## License

MIT
