## Why

当前提示词优化器只有"优化"、"迭代"、"测试"等功能 tab，缺少一个专门的提示词维护菜单。用户无法在一个集中的界面中管理（新增、删除、修改）自定义提示词模板。同时，用户在维护提示词时，希望能够从已有提示词列表中选择一个作为"原始提示词"，直接跳转到优化流程进行优化，打通"维护→优化"的工作流。

## What Changes

- 在 PromptView 中新增"提示词维护"tab，提供提示词模板的 CRUD 操作界面
- 支持新增自定义提示词（系统提示词 + 用户提示词）
- 支持修改已有提示词内容
- 支持删除已有提示词
- 在提示词维护列表中，每个提示词旁提供"优化"按钮，点击后自动切换到优化 tab 并将该提示词填充为原始输入
- 后端新增提示词模板的 CRUD API（当前模板数据存储在文件系统中，需扩展 TemplateManager）

## Capabilities

### New Capabilities

- `prompt-template-crud`: 支持在提示词维护界面中对提示词模板进行新增、修改、删除操作，并从维护列表中选择提示词跳转至优化流程

### Modified Capabilities

<!-- No existing capabilities are being modified at the spec level -->

## Impact

- **前端**: 新增 `web/src/components/prompt/PromptMaintenanceView.vue` 组件
- **前端**: 修改 `web/src/components/prompt/PromptView.vue` 添加新 tab
- **前端 Store**: `web/src/stores/prompt.ts` 添加模板 CRUD 状态和"选择并优化"方法
- **后端**: `src/server/routes/templates.ts` 扩展支持模板写入/删除（当前只有读取）
- **后端**: `src/server/services/template/manager.ts` 可能需要扩展写入方法
- **国际化**: 添加维护相关的 i18n 文本
