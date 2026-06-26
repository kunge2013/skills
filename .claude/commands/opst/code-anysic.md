---
name: "OPST: Code Analysis & Archive"
description: "分析已归档变更的代码，提取业务逻辑并自动归档到 openspec/<领域>/<模块>/ 知识库"
category: Workflow
tags: [workflow, analysis, archival, knowledge]
---

分析已归档的 OpenSpec 变更代码，提取业务逻辑并归档到知识库。

归档后会生成：
- `openspec/<领域>/<模块>/v<N>-<日期>.md`（五段式设计文档）
- `openspec/<领域>/<模块>/INDEX.md`（模块概览，首次创建或更新版本表）
- `openspec/<领域>/<模块>/CHANGELOG.md`（版本历史）
- `openspec/openspec-trace/GLOBAL_INDEX.md`（全局检索索引，自动更新）

完成后可用 `/opst:business-search` 检索已归档的业务逻辑。

---

**输入**：`/opst:code-anysic` 后可选填已归档变更名称（如 `/opst:code-anysic add-payment-cancel`）。
若省略，自动列出最近归档供选择。

**步骤**

1. **确定分析目标**

   若用户未提供变更名称：
   ```bash
   ls -t openspec/changes/archive/
   ```
   展示最近归档，使用 **AskUserQuestion** 确认目标。

   **重要**：必须经用户确认后才能继续。

2. **读取变更上下文**

   并行读取：
   - `openspec/changes/archive/<变更名>/proposal.md`
   - `openspec/changes/archive/<变更名>/design.md`
   - `openspec/changes/archive/<变更名>/tasks.md`

   提取功能描述、技术领域、模块名称。

3. **分析代码变更**

   获取变更涉及的 Java 文件（通过 git diff 定位，或从 proposal.md/design.md 推断）。

   分类文件（Controller / Service / ServiceImpl / Mapper / XML / Entity），提取关键注解（`@TableName`, `@RequestMapping`, `@PostMapping`）。

4. **确定领域与模块**

   从 Java 包名推导领域和模块。
   使用 **AskUserQuestion** 让用户确认或覆盖推导结果。

5. **生成五段式设计文档**

   使用 **Skill 工具调用 `opst-code-anysic`** 执行完整的代码分析和文档生成流程：
   包含接口定义、流程图、业务逻辑详情、ER 图、源码文件清单，以及 YAML frontmatter 元数据。

6. **写入知识库并更新索引**

   技能内部完成：
   - 写入版本化设计文档
   - 创建或更新 INDEX.md
   - 追加 CHANGELOG.md
   - 更新 GLOBAL_INDEX.md

7. **展示归档摘要**

   输出归档路径、版本号、关键词、入口点信息。

**输出格式**

```
## 归档完成

**变更**：<变更名>
**知识库路径**：openspec/<领域>/<模块>/
**版本**：v<N>-<YYYY-MM-DD>.md
**INDEX.md**：✓ 已更新
**CHANGELOG.md**：✓ 已追加
**GLOBAL_INDEX.md**：✓ 已更新

关键词：<keyword1>, <keyword2>, ...
入口点：<Controller>（<HTTP方法> <路径>）
```

**注意事项**
- 必须经用户确认分析目标后才能继续
- 领域和模块必须经用户确认
- 所有生成文档使用中文，技术术语保留英文
- 版本号基于现有 `v*.md` 文件自动递增
