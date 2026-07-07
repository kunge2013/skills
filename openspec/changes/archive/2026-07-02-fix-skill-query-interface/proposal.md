## Why

在 SkillList.vue 中，分类选择器（category select）和排序选择器（sort select）的 `@change` 事件绑定到了 `store.applyFilters()`，该函数仅在客户端本地对全量 `store.skills` 数组进行过滤和排序。而搜索输入框正确地调用了远程 API `store.searchSkills()`。

这导致：
- 分类切换和排序切换走的是本地过滤逻辑，不走查询接口
- 当 skill 数量增长时，本地过滤会失去意义（应依赖服务端返回已过滤结果）
- 分类选择器的行为与搜索输入框不一致，用户体验割裂

## What Changes

- 修复 SkillList.vue 中分类和排序选择器的 `@change` 事件，统一调用 `store.searchSkills()` 远程接口
- 扩展 `store.searchSkills()` 以在 filter 对象中传递 `sortBy` 参数
- 扩展后端 `searchSkills` handler（`src/commands/web.js`）以支持排序
- 移除不再需要的 `store.applyFilters()` 本地过滤逻辑（或标记为备用）

## Capabilities

### New Capabilities
- `server-side-category-filtering`: 分类选择触发远程 API 查询而非本地过滤
- `server-side-sorting`: 排序选择通过 API 传递到后端执行排序

### Modified Capabilities
- `skill-search`: 现有搜索流程将包含 category 和 sortBy 参数，API 统一处理

## Impact

- **前端**: `web/src/components/SkillList.vue` — 修改 `@change` 事件绑定
- **Store**: `web/src/stores/skills.ts` — 修改 `searchSkills()` 传递 `sortBy`，修改 `applyFilters()` 角色
- **后端**: `src/commands/web.js` — `searchSkills()` handler 新增排序逻辑
