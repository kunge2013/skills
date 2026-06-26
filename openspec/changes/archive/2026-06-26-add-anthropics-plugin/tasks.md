# Tasks: add-anthropics-plugin

## Phase 1: 插件配置

- [x] **Task 1: 创建 plugins/anthropics/plugin.json**

  按 design.md 中的 plugin.json 配置创建文件，作者为 Anthropic，许可为 Proprietary。

- [x] **Task 2: 更新 .claude-plugin/marketplace.json**

  在 plugins 数组末尾追加 anthropics 插件注册条目。

## Phase 2: 文档更新

- [x] **Task 3: 更新 README.md**

  在 Available Plugins 区域新增 anthropics 插件说明，包含：
  - 插件简介
  - 技能列表表格（名称、功能描述、触发场景）

- [x] **Task 4: 发布新版本到 npm**

  版本号 bump patch，发布到 npm。
