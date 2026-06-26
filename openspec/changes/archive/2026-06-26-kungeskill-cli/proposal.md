# Proposal: kungeskill-cli

## Summary

构建 `kungeskill` Node.js CLI 工具，通过软链（symlink/junction）机制管理 skill 的安装、卸载和更新。核心能力包括：从 marketplace 全量缓存 skill 源文件、项目级软链安装、跨平台兼容（Windows/Linux/macOS）、以及软链健康检测。

## Motivation

当前 skills 通过 Claude Code 内置 Plugin Marketplace 机制安装，但存在以下局限：

1. **无法本地独立管理**：用户需要网络访问才能安装/更新 skills
2. **无版本锁定**：更新可能引入 breaking change，无法回滚
3. **无健康检测**：软链断裂后难以排查
4. **Windows 兼容性差**：内置机制可能不具备 junction points 回退策略
5. **安装粒度受限**：只能按 plugin 安装，不能按单个 skill 安装

`kungeskill` 解决这些问题：
- 本地缓存 + 软链：断网可用，更新即时生效
- 全量 clone marketplace：一次拉取，按需安装
- 跨平台软链策略：Windows junction / Linux/macOS symlink
- `doctor` 命令：检测断裂、过期、不一致

## Scope

### In Scope

- `kungeskill init`：全量 clone marketplace 到 `~/.kungeskills/cache/marketplace`
- `kungeskill list`：列出 marketplace 所有可安装 skills（读取 marketplace.json registry）
- `kungeskill add <skill>`：缓存验证 + 创建项目级软链到 `.claude/skills/<skill>`
- `kungeskill remove <skill>`：安全删除项目软链（不影响全局缓存）
- `kungeskill view`：查看已安装 skills 详情 + 健康状态
- `kungeskill update`：`git pull` 更新缓存（软链自动生效）
- `kungeskill doctor`：检测断裂软链、缓存一致性、版本状态
- 跨平台支持：Windows junction points、Linux/macOS symlinks
- 离线工作：缓存存在时无需网络
- `.kungeskills/config.json`：全局配置（marketplace URL、branch 等）

### Out of Scope

- 不替代 Claude Code 内置 Plugin Marketplace（并存使用）
- 不实现多 marketplace 支持（首期仅单一 marketplace）
- 不实现 skill 版本锁定/回滚（v2 规划）
- 不实现 skill 依赖解析（skill 之间无依赖）
- 不修改现有 marketplace.json 格式
- 不实现 `publish` 命令（发布仍走 GitHub push）

## Success Criteria

1. `kungeskill add openspec-explore` 在 Windows/Linux/macOS 上均能创建有效软链
2. `kungeskill update` 后，已安装 skill 内容自动更新（无需重建软链）
3. `kungeskill doctor` 能准确检测断裂软链
4. `kungeskill list` 能正确解析 marketplace.json 展示所有 skills
5. 安装/卸载操作不影响全局缓存和其他项目
