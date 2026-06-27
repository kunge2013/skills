# Change: add-electron-desktop

## Problem

当前 kunge-skills 仅提供 CLI 接口 (`kungeskill`)，技能浏览、安装、编辑等操作只能通过命令行完成。对于需要可视化浏览、编辑 SKILL.md 内容的用户，CLI 体验不够友好。

## Solution

新增 Electron 桌面应用作为第二入口，与现有 CLI 并存。桌面应用提供：
- 图形化浏览和搜索 skill
- Markdown 编辑器（md-editor-v3）用于本地编辑 skill
- skill 安装/卸载/更新状态可视化

现有 CLI 完全保留，不做任何破坏性变更。Electron 主进程直接复用 CLI 的 `core/` 模块，无需重写。

## Scope

### In Scope
- Electron 项目脚手架搭建（Electron + Vue 3 + Vite）
- Skill 列表与搜索 UI
- Skill 详情查看（SKILL.md 渲染预览）
- Skill 本地编辑（md-editor-v3）
- Skill 安装/卸载/更新操作
- 缓存状态检查（doctor）
- npm 包与 Electron 构建流程共存
- CLI `core/` 模块共享到 Electron 主进程

### Out of Scope
- 在线 marketplace / 云端同步
- 用户认证 / 权限管理
- VS Code Extension
- CLI 功能迁移到其他语言

## Impact

- 新增 `electron/` 目录
- `package.json` 新增 Electron 相关 devDependencies 和 build scripts
- `src/core/` 模块被 Electron 主进程 require() 复用
- `plugins/` 目录共享（CLI 和 Electron 读取同一数据源）
- npm 包同时包含 CLI 和 Electron 源码，用户 `npm install -g kungeskill` 后即可直接使用桌面应用
- `electron-builder` 额外产出桌面安装包（.exe/.dmg/.AppImage）
- `package.json` 的 `files` 字段需包含 `electron/` 目录
