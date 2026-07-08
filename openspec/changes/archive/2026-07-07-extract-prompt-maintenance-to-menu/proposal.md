## Why

当前"提示词维护"功能作为"提示词优化器"内的一个 tab 存在，但维护提示词模板是一个独立的工作流，与优化/迭代/测试等操作在语义上属于不同层级。将其提升为左侧导航栏的独立菜单项，可以让用户更直接地访问维护功能，同时也让提示词优化器的 tab 栏保持简洁。

## What Changes

- 从 PromptView 中移除"维护"tab
- 在左侧导航栏（NavSidebar）新增"提示词维护"菜单项
- 在主视图区域新增独立的提示词维护页面入口（通过 skills store 的 `currentView` 控制）
- 提示词维护页面复用已有的 `PromptMaintenanceView` 组件

## Capabilities

### New Capabilities

- `maintenance-standalone`: 将提示词维护功能从优化器 tab 提升为独立导航菜单项

### Modified Capabilities

- `model-edit`: 移除 PromptView 中的维护 tab，不再作为优化器子功能

## Impact

- **前端**: `web/src/components/NavSidebar.vue` — 新增维护菜单项
- **前端**: `web/src/components/prompt/PromptView.vue` — 移除维护 tab
- **前端**: `web/src/App.vue` 或主视图路由 — 新增维护页面入口
- **前端 Store**: `web/src/stores/skills.ts` — 新增 `promptMaintenance` view 类型
- **前端 Store**: `web/src/stores/prompt.ts` — 移除 `activePromptTab` 中维护相关的绑定
- **国际化**: 新增菜单项翻译
