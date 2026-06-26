# plugin-marketplace-setup — 模块索引

> 领域：infrastructure | 最后更新：2026-06-26

## 模块概览

Claude Code Plugin Marketplace 项目设置。将本地 skills 重构为符合 Marketplace 规范的可分发格式，支持通过 GitHub 安装。包含 2 个独立 plugin：openspec-workflow（变更生命周期）和 openspec-trace（知识库）。

## 版本历史

| 版本 | 日期 | 变更 | 文档 |
|------|------|------|------|
| v1 | 2026-06-26 | plugin-marketplace-setup | [查看](v1-2026-06-26.md) |

## 入口点

| 方法 | 路径 | 说明 |
|------|------|------|
| N/A | N/A | 基础设施变更，无 API 入口 |

## 已知业务规则

- Marketplace 名称 `kunge-skills` 作为用户安装标识
- 使用 git SHA 滚动版本策略
- 两个 plugin 完全独立，用户可按需安装
- strict mode 默认 true，plugin.json 为权威定义
