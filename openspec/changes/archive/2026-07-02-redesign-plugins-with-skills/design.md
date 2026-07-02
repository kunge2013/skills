## Context

当前 SkillList 渲染流程：
1. `loadPlugins()` → `store.plugins`（plugin 列表，仅含 metadata）
2. `loadSkills()` → `store.skills`（扁平 skill 列表）
3. `applyFilters()` → 过滤 skills → `store.filteredSkills`
4. 前端通过 `groupedSkills` computed 遍历 plugins，通过 `pluginSkills` computed 将 skills 按 `pluginName` 分组

数据需要在两个数组之间关联匹配，逻辑冗余。

## Goals / Non-Goals

**Goals:**
- `listPlugins()` 返回 `{ name, description, ..., skills: [{ skillName, sourcePath, ... }] }` 层级结构
- 前端 `applyFilters()` 直接在 plugin 级别过滤（搜索词匹配 plugin 名或任一 skill 名）
- 渲染直接遍历 `filteredPlugins`，skills 来自 `plugin.skills`

**Non-Goals:**
- 不删除 `/marketplace/search` 接口（可能有其他用途）
- 不删除 `listAllSkills()` 接口（保留向后兼容）
- 不修改 SkillManage.vue 的独立逻辑

## Decisions

### 1. 后端 plugins 接口嵌入 skills

`listPlugins()` 遍历每个 plugin 的 `skills/` 目录，将每个 skill 目录名和元数据打包为 `skills` 数组附加到 plugin 对象中。这样一次 API 调用返回完整的层级数据。

**备选**: 新增独立接口 `/marketplace/plugins-with-skills`。排除原因：修改 `listPlugins()` 是向后兼容的（只增加字段），前端按需使用新字段。

### 2. 前端过滤以 plugin 为单位

`applyFilters()` 现在操作 `plugins` 数组：
- 搜索：匹配 `plugin.name` OR `plugin.description` OR `plugin.keywords` OR 任一 `plugin.skills[].skillName`
- 分类：匹配 `plugin.category`
- 排序：按 `plugin.name` / `plugin.author` 排序

这样输入关键词后，匹配的 plugin 整个显示（包含所有 skills），而不是只显示匹配的单个 skill。

### 3. 简化渲染逻辑

移除 `groupedSkills` 和 `pluginSkills` computed。SkillList.vue 直接 `v-for="plugin in store.filteredPlugins"`，内层 `v-for="skill in plugin.skills"`。

**效果**: 点击 skill 时从 `plugin` 对象补充 metadata（pluginName, pluginDescription 等）构造 SkillInfo 对象传给 `store.selectSkill()`。

## Risks / Trade-offs

- **[响应体积增大]** plugins 接口现在返回嵌套 skills 数组 → 数据量增长可忽略（几十条 skill），且避免了二次 API 调用
- **[skill 元数据不完整]** plugin 内嵌的 skill 只有 `skillName` 和从 plugin 继承的通用字段 → 详情查看仍走 `selectSkill()` 加载完整 SKILL.md
