## Why

当前 SkillList 界面存在两个问题：

1. **数据模型割裂**：`listPlugins()` 只返回 plugin 信息 + skillCount（数字），`listAllSkills()` 返回扁平 skill 列表。前端需要两个独立数组（`plugins` + `skills`），通过 `pluginName` 做关联匹配才能渲染出「父节点 + 子列表」的层级结构。
2. **搜索接口冗余**：`/marketplace/search` 接口搜索的是 skill 条目，但数据量小（几十条），前端本地过滤完全够用。调用 API 反而增加延迟且容易产生前后端不一致。

## What Changes

- 修改 `listPlugins()` 接口，每个 plugin 节点自带 `skills` 数组
- 前端渲染基于 `filteredPlugins`（plugin 数组），不再需要独立的 skills 列表
- 所有过滤（搜索、分类、排序）在 `applyFilters()` 中本地完成

## Capabilities

### New Capabilities
- `plugins-with-skills`: plugins 接口返回包含 skills 数组的层级结构
- `local-filtering`: 搜索、分类、排序全部在前端本地过滤

### Modified Capabilities
- `skill-search`: `/marketplace/search` 接口不再用于 SkillList 主界面（保留但不再依赖）

## Impact

- **后端**: `src/commands/web.js` — `listPlugins()` 新增 skills 数组
- **前端 Store**: `web/src/stores/skills.ts` — 新增 `filteredPlugins` 状态，`applyFilters()` 改为过滤 plugins
- **前端组件**: `web/src/components/SkillList.vue` — 简化渲染，去除 `groupedSkills`、`pluginSkills` computed
