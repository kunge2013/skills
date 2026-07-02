## Context

SkillList.vue 是当前 skill 管理的主要界面，包含三个交互控件：
- 文本搜索框 → 正确调用 `store.searchSkills()` → 远程 API
- 分类选择器 → 错误调用 `store.applyFilters()` → 本地过滤
- 排序选择器 → 错误调用 `store.applyFilters()` → 本地排序

`store.searchSkills()` 已支持在 filter 对象中传递 `category` 和 `plugin`，但前端 `sortBy` 状态未传递到后端，后端 `searchSkills` handler 也未实现排序。

## Goals / Non-Goals

**Goals:**
- 分类选择和排序选择统一触发远程 API 查询
- 后端 `searchSkills` 支持排序参数
- 保持搜索输入框的 debounce 行为不变

**Non-Goals:**
- 不修改 SkillManage.vue 的独立搜索逻辑（该视图设计为本地过滤已安装 skill）
- 不修改 skill marketplace 同步机制
- 不重构现有 IPC 层或引入新的 API 接口

## Decisions

### 1. 统一事件绑定：从 `applyFilters()` 改为 `searchSkills()`

SkillList.vue 中分类和排序选择器的 `@change` 从 `store.applyFilters()` 改为调用 `store.searchSkills(store.searchQuery)`。这样三个控件都走同一条远程查询路径。

**备选**: 新增独立的 `filterAndSort()` action。排除原因：`searchSkills()` 已包含 category 和 plugin 过滤逻辑，扩展 sortBy 即可，无需新增 action。

### 2. Store 传递 sortBy 到后端

在 `searchSkills()` 的 filter 对象中增加 `sortBy` 字段：
```typescript
if (this.sortBy) f.sortBy = this.sortBy;
```

后端已有 `selectedCategory` 和 `selectedPlugin` 的传递模式，sortBy 遵循同一模式。

### 3. 后端实现排序逻辑

在 `src/commands/web.js` 的 `searchSkills` 函数末尾添加排序逻辑，根据 `filters.sortBy` 值对结果进行排序。支持 `'name'`、`'plugin'`、`'author'` 三种排序方式，与前端原有逻辑一致。

**备选**: 数据库层排序。排除原因：当前数据来自本地文件遍历（`listAllSkills()`），非数据库查询，排序应在 JS 层完成。

### 4. applyFilters() 保留为降级方案

保留 `applyFilters()` 但仅在 API 不可用时作为降级方案调用。避免破坏性变更。

## Risks / Trade-offs

- **[API 调用频率增加]** 每次分类切换和排序切换都会触发 API 请求 → 影响可忽略，当前数据量小；未来可加 debounce
- **[后端排序与前端不一致]** 后端排序逻辑需与前端 `applyFilters()` 中的排序一致 → 使用相同的 `localeCompare` 比较函数
- **[applyFilters() 残留调用]** 可能有其他组件仍在使用 → 保留函数，仅修改 SkillList.vue 的绑定
