## Why

当前提示词优化器的模型管理 (ModelsView) 仅支持基本的增删改查和启用/禁用操作，用户无法直接在界面上修改模型的详细配置（如 API Key、Base URL、Model ID、显示名称等）。每次修改都需要删除后重新添加，操作繁琐且容易丢失配置。需要提供一个内联编辑能力，让用户可以方便地修改模型配置。

## What Changes

- 在 ModelsView 中添加模型编辑模式，点击编辑按钮后展开可编辑表单
- 编辑表单预填充当前模型配置，支持修改所有字段（显示名称、协议、Model ID、API Key、Base URL）
- 保存时调用现有的 `PUT /models/:id` API 更新配置
- 优化界面布局，将操作按钮整合为更紧凑的行内操作

## Capabilities

### New Capabilities

- `model-edit`: 支持在模型管理界面内联编辑模型配置，包括显示名称、协议、Model ID、API Key、Base URL 等字段的修改

### Modified Capabilities

<!-- No existing capabilities are being modified at the spec level -->

## Impact

- **前端**: `web/src/components/prompt/ModelsView.vue` — 添加编辑状态管理和编辑表单 UI
- **前端 Store**: `web/src/stores/prompt.ts` — 可能需要添加 `updateModel` 方法（后端 API 已存在）
- **后端**: 无变更，`PUT /models/:id` 路由和 `ModelManager.updateModel` 已存在
- **国际化**: 需要添加编辑相关的 i18n 文本
