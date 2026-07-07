## Why

当前 web 应用中 skill 管理功能分散在 SkillList、SkillDetail、SkillEditor 组件中，缺少一个集中的 skill 管理入口。用户需要一个独立的菜单来完成 skill 检索、按目录批量编辑、以及保存更新 skill 内容的完整工作流。

## What Changes

- 新增独立的 Skill Management 菜单入口，集成到 NavSidebar
- 新增 skill 全局检索功能，支持按关键词搜索并过滤结果
- 新增按 skill 目录浏览和编辑功能，可编辑目录下所有文件
- 解析 skill.md 中的引用关系，自动加载可编辑的依赖文件
- 新增批量保存/更新 skill 内容的机制
- 新增 SkillManage.vue 组件作为主管理界面

## Capabilities

### New Capabilities
- `skill-search`: 全局 skill 检索与过滤能力
- `skill-directory-browsing`: 按目录浏览 skill 文件树
- `skill-file-editing`: 编辑 skill.md 及其引用文件
- `skill-batch-save`: 批量保存和更新 skill 内容

### Modified Capabilities
<!-- No existing spec requirements are changing -->

## Impact

- **前端**: 新增 SkillManage.vue 组件，修改 NavSidebar.vue 添加菜单入口
- **Store**: skills.ts 新增目录浏览、文件列表、批量保存等 action
- **API**: 需要新增 ipc 接口：列出 skill 目录、读取文件树、获取 skill.md 引用关系、批量保存
- **类型**: types/skill.ts 新增目录和文件树相关类型
