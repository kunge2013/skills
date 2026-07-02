## 1. Backend — Embed Skills in Plugins API

- [x] 1.1 修改 `src/commands/web.js` 的 `listPlugins()` 函数，为每个 plugin 构建 `skills` 数组
- [x] 1.2 每个 skill 包含：`skillName`, `sourcePath`, 以及从 plugin 继承的 `description`, `author`, `license`, `category`, `keywords`

## 2. Frontend Store — Filter on Plugins

- [x] 2.1 在 `web/src/stores/skills.ts` 新增 `filteredPlugins` 状态
- [x] 2.2 重写 `applyFilters()` 操作 `plugins` 数组：搜索匹配 plugin 名/skill 名、分类过滤、排序
- [x] 2.3 `loadPlugins()` 加载后调用 `applyFilters()`

## 3. Frontend UI — Simplify SkillList Rendering

- [x] 3.1 修改 `SkillList.vue` 渲染：遍历 `store.filteredPlugins`
- [x] 3.2 内层遍历 `plugin.skills` 渲染 skill 列表
- [x] 3.3 移除 `groupedSkills`、`pluginSkills` computed 和 `searchTimer` debounce
- [x] 3.4 `onMounted` 只调用 `loadPlugins()`（不需要单独 `loadSkills()`）

## 4. Verification

- [x] 4.1 运行 `npx vite build` 确认无 TypeScript 编译错误 — **build passes with 0 errors**
- [x] 4.2 启动 web 服务，手动测试：搜索 plugin 名、搜索 skill 名、切换分类、切换排序 → 验证结果正确 — **12 个 plugin 节点正确显示，skill 计数正确**
