## Context

当前 web 应用通过 NavSidebar → SkillList → SkillDetail → SkillEditor 的流程管理 skill，但缺少一个集中的管理入口。SkillEditor 只能编辑单个 skill.md 文件，无法浏览目录结构或编辑 skill.md 中引用的其他文件（如 README.md、代码示例等）。

## Goals / Non-Goals

**Goals:**
- 提供独立的 Skill Management 菜单，集成到现有导航
- 支持全局关键词检索 skill
- 支持按 skill 目录浏览文件树，编辑目录下任意文件
- 解析 skill.md 中的文件引用（如 `![image](./images/x.png)`、`{{include:./path/file}}` 等），自动加载可编辑文件
- 支持批量保存所有已编辑文件

**Non-Goals:**
- 不修改 skill 安装/卸载逻辑
- 不修改 skill marketplace 同步机制
- 不支持创建/删除 skill（仅编辑已有内容）
- 不重构现有 SkillEditor 组件

## Decisions

### 1. SkillManage 作为独立视图
在 App.vue 中新增 `'manage'` 视图，NavSidebar 添加菜单入口。SkillManage.vue 作为独立管理页面，内部分为三个区域：搜索面板、文件树、编辑器。

**备选**: 在现有 SkillDetail 中嵌入管理功能。排除原因：SkillDetail 专注单 skill 展示，混合功能会降低可维护性。

### 2. 目录浏览通过文件系统 API
新增 `api.listSkillDirectory(path)` 接口返回目录结构，前端渲染为树形组件（使用 Element Plus 的 `el-tree`）。

### 3. skill.md 引用解析
引用解析放在前端（而非 IPC 层）。SkillManage.vue 读取 skill.md 内容后，用正则提取 `./` 开头的相对路径引用，然后调用 `api.readSkillContent` 逐个加载。这样避免 IPC 接口复杂度增加。

**备选**: 在后端解析引用。排除原因：引用格式可能多样（markdown image、include 语法等），前端已有 Markdown 解析上下文，更灵活。

### 4. 批量保存采用逐个保存 + 事务回退
每个文件独立调用 `api.saveSkillContent`，保存过程中如遇失败，回退已保存的文件（重新加载原始内容）。使用 Pinia state 跟踪已修改文件列表。

**备选**: 后端事务批量保存。排除原因：当前 IPC 层不支持文件系统事务，实现成本高。

## Risks / Trade-offs

- **[引用解析不完整]** skill.md 可能使用非标准引用语法 → 先支持常见的 markdown image/link 引用，后续扩展
- **[批量保存部分失败]** 网络/权限问题导致部分文件保存失败 → 前端记录失败文件，提示用户重试
- **[文件树性能]** 大 skill 目录（数百文件）可能导致树渲染慢 → 使用 el-tree 的 lazy loading
- **[与现有 SkillEditor 功能重复]** → SkillManage 专注多文件管理，SkillEditor 保持单文件快速编辑，两者共存
