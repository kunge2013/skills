## 1. Store Layer — Extend searchSkills with sortBy

- [x] 1.1 在 `web/src/stores/skills.ts` 的 `searchSkills()` 方法中，将 `this.sortBy` 添加到 filter 对象 `f` 中
- [x] 1.2 确认 `applyFilters()` 保留为降级方案，不删除

## 2. Backend Layer — Add Sorting to searchSkills Handler

- [x] 2.1 在 `src/commands/web.js` 的 `searchSkills()` 函数末尾添加排序逻辑
- [x] 2.2 支持 `filters.sortBy` 为 `'name'`、`'plugin'`、`'author'` 三种排序方式
- [x] 2.3 使用 `localeCompare` 保持与前端一致的排序行为

## 3. UI Layer — Fix Event Bindings in SkillList.vue

- [x] 3.1 分类选择器 `@change` 改为 `store.applyFilters()`（本地过滤，保持原有行为）
- [x] 3.2 排序选择器 `@change` 改为 `store.applyFilters()`（本地过滤，保持原有行为）
- [x] 3.3 搜索输入框改为直接调用 `store.applyFilters()`（去掉 debounce + API 调用）

## 4. Verification

- [x] 4.1 运行 `npm run build` 确认无 TypeScript 编译错误
- [x] 4.2 方案调整为：本地过滤统一，搜索/分类/排序一致（详见 redesign-plugins-with-skills change）
- [x] 4.3 API 请求不再用于分类/排序切换，改为本地 `applyFilters()`

> **Note**: 本 change 的方案后被 `redesign-plugins-with-skills` 取代。`searchSkills()` 的 sortBy 扩展和后端排序逻辑保留但不再被主界面使用。

