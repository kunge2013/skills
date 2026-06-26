---
name: "OPST: Business Search"
description: "检索 openspec/<领域>/<模块>/ 知识库中已归档的业务逻辑文档"
category: Workflow
tags: [workflow, search, knowledge, business-logic]
---

检索已归档的业务逻辑知识库，快速定位业务实现细节和代码入口。

支持三种模式：
- **关键词检索**：输入业务关键词（如 `payment`、`销账`、`invoice`）
- **浏览模式**：列出所有已归档的领域和模块
- **精确查看**：指定具体模块（如 `billing/payment-processing`）

---

**输入**：`/opst:business-search` 后跟查询关键词，或使用模式词（`列出所有`、`show all`）。

**示例**
- `/opst:business-search payment write-off` — 按关键词检索
- `/opst:business-search 列出所有` — 浏览所有已归档模块
- `/opst:business-search billing/payment-processing` — 精确查看某模块

**步骤**

1. **解析查询**

   分析用户输入，判断检索模式：
   - 浏览模式：包含"列出"、"所有"、"list"、"all"
   - 精确查看：包含 `领域/模块` 路径格式
   - 关键词检索：其他情况

   若用户未提供输入，使用 **AskUserQuestion** 询问检索意图。

2. **检查知识库是否存在**

   ```
   openspec/openspec-trace/GLOBAL_INDEX.md
   ```

   若不存在，提示用户先执行 `/opst:code-anysic` 归档业务逻辑后再检索。

3. **执行检索**

   使用 **Skill 工具调用 `opst-business-search`** 执行完整的检索流程：
   - 关键词检索：扫描 GLOBAL_INDEX.md 和各 INDEX.md 文件
   - 浏览模式：读取并展示 GLOBAL_INDEX.md 完整内容
   - 精确查看：读取指定模块的 INDEX.md

4. **展示结果并提供后续操作**

   根据检索结果，使用 **AskUserQuestion** 询问用户是否需要：
   - 查看某模块的完整 INDEX.md
   - 查看版本变更历史（CHANGELOG.md）
   - 阅读指定版本的完整设计文档

5. **展示选定内容**

   根据用户选择读取并展示对应文档内容。

**注意事项**
- 若知识库为空，引导用户先执行 `/opst:code-anysic`
- 检索无结果时展示现有领域树，帮助用户调整关键词
- 支持 `--json` 输出模式，格式化结果供其他技能消费
