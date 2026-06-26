# Proposal: plugin-marketplace-setup

## Summary

将现有的 `.claude/skills/` 目录结构重构为符合 Claude Code Plugin Marketplace 规范的可分发项目，使开源社区用户可以通过 GitHub 直接安装 skills。

## Motivation

当前 skills 以 `.claude/skills/` + `.claude/commands/` 的本地格式存在，无法被其他用户安装使用。Claude Code 提供了标准的 Plugin Marketplace 机制，支持通过 GitHub 仓库分发 skills。改造为标准 marketplace 格式后：

- 社区用户可通过 `/plugin marketplace add kunge2013/skills` 一键添加
- 支持按需安装单个 plugin（openspec-workflow 或 openspec-trace）
- 自动获取更新（git SHA 滚动版本策略）
- 符合 Claude Code 生态标准

## Scope

### In Scope

- 创建 `.claude-plugin/marketplace.json` marketplace 入口文件
- 创建 `plugins/openspec-workflow/` plugin 目录（含 plugin.json + skills）
- 创建 `plugins/openspec-trace/` plugin 目录（含 plugin.json + skills）
- 将现有 `.claude/skills/` 中的 SKILL.md 文件迁移到 plugins 目录
- 删除旧的 `.claude/skills/` 和 `.claude/commands/` 目录
- 更新 README.md 为 marketplace 使用文档

### Out of Scope

- 不发布 commands（仅发布 skills）
- 不使用显式 semver 版本（使用 git SHA 滚动）
- 不涉及 CI/CD 发布流水线
- 不修改 openspec/ 配置目录

## Decision

- **版本策略**: git commit SHA 自动滚动（零维护成本，push 即发布）
- **Marketplace name**: `kunge-skills`
- **Plugin 拆分**: 按功能域拆为 2 个独立 plugin，用户可按需安装
- **Commands**: 不发布到 plugin（commands 是本地快捷方式，skills 是核心内容）
