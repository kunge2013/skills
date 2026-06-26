---
name: opst-code-anysic
description: >
  分析已归档的 OpenSpec 变更代码，提取业务逻辑并自动归档到 openspec/<领域>/<模块>/ 知识库。继承 code2doc-kunge2013 的五段式文档生成逻辑，并扩展为版本化归档、三级索引维护。当用户提到"代码归档"、"业务逻辑归档"、"code-anysic"、"分析变更代码"时使用此技能。
license: MIT
compatibility: Requires openspec CLI and git.
metadata:
  author: fangkun
  version: "1.0"
  generatedBy: "openspec-trace@1.0.0"
---

分析已归档的 OpenSpec 变更代码，提取业务逻辑并自动归档到 openspec/<领域>/<模块>/ 知识库。

## 工作流

### 步骤 1：确定分析目标

若用户未提供变更名称，列出已归档的变更供选择：

```bash
ls -t openspec/changes/archive/
```

使用 **AskUserQuestion** 让用户从列表中选择目标变更。

**重要**：必须经用户确认后才能继续。

### 步骤 2：读取变更上下文

并行读取以下文件，提取功能描述、技术领域、模块名称：

- `openspec/changes/archive/<变更名>/proposal.md`
- `openspec/changes/archive/<变更名>/design.md`
- `openspec/changes/archive/<变更名>/tasks.md`

### 步骤 3：分析代码变更

通过 git log 定位该变更对应的 commit 范围，获取涉及的文件列表：

```bash
git log --oneline -20
git diff <base-commit>..<head-commit> --name-only
```

将文件按层次分类：

| 分类 | 匹配模式 |
|------|----------|
| Controller | `*Controller.java` |
| Service | `*Service.java`, `*ServiceImpl.java` |
| Mapper | `*Mapper.java` |
| XML | `*Mapper.xml` |
| Entity | `*Entity.java`, `*DO.java`, `*PO.java` |

使用 **Grep** 提取关键注解：

- `@TableName` → 数据表映射
- `@RequestMapping` → API 路径前缀
- `@PostMapping` / `@GetMapping` / `@PutMapping` / `@DeleteMapping` → HTTP 方法与路径

### 步骤 4：确定领域与模块

从 Java 包名推导领域和模块，规则如下：

| 包名示例 | 领域推导 | 模块推导 |
|----------|----------|----------|
| `com.example.bill.payment` | `billing` | `payment-processing` |
| `com.example.invoice.calc` | `invoice` | `calculation` |
| `com.example.order.service` | `order` | `order-management` |

使用 **AskUserQuestion** 让用户确认或覆盖推导结果（领域名 + 模块名）。

### 步骤 5：生成五段式设计文档

读取各层源码文件（Controller → Service → ServiceImpl → Entity/Mapper → XML），
继承 code2doc-kunge2013 的五段式结构生成设计文档。

**文档结构**：

```
---
domain: <领域>
module: <模块>
version: <N>
date: <YYYY-MM-DD>
change: <变更名称>
keywords: [<kw1>, <kw2>, ...]
code-entry: <Controller类名>（<HTTP方法> <路径>）
---

# <模块名> — v<N>（<YYYY-MM-DD>）

## 1. 接口定义

| 字段 | 值 |
|------|----|
| URL | `<HTTP方法> <路径>` |
| Controller | `<类名>.<方法名>()` |
| 入参 | ```json\n{...}\n``` |
| 出参 | ```json\n{...}\n``` |

## 2. 业务流程图

```mermaid
flowchart TD
  ...
```

## 3. 业务逻辑详情

（SQL 查询 + Java 代码逻辑详解，覆盖核心分支）

## 4. 表结构 ER 图

```mermaid
erDiagram
  ...
```

## 5. 源码文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| ...  | ...  | ...  |
```

**版本号确定**：

```
Glob: openspec/<领域>/<模块>/v*.md
```

取已有文件中最大版本号 N，新版本为 N+1；若目录不存在，从 v1 开始。

### 步骤 6：写入知识库并更新索引

**写入版本化设计文档**：

```
Write: openspec/<领域>/<模块>/v<N>-<YYYY-MM-DD>.md
```

**INDEX.md 处理**：

- 若 `openspec/<领域>/<模块>/INDEX.md` 不存在：创建新文件，包含模块概览、版本表、入口点、已知业务规则。
- 若已存在：Edit INDEX.md，在版本表中追加新版本行。

INDEX.md 格式：

```markdown
# <模块名> — 模块索引

> 领域：<领域> | 最后更新：<YYYY-MM-DD>

## 模块概览

<功能概述>

## 版本历史

| 版本 | 日期 | 变更 | 文档 |
|------|------|------|------|
| v<N> | <日期> | <变更名> | [查看](v<N>-<日期>.md) |

## 入口点

| 方法 | 路径 | 说明 |
|------|------|------|

## 已知业务规则

- <规则 1>
- <规则 2>
```

**CHANGELOG.md 处理**：

```
Append: openspec/<领域>/<模块>/CHANGELOG.md
```

追加格式：

```markdown
## v<N> — <YYYY-MM-DD>

**变更**：<变更名>

<本次变更的主要业务逻辑说明>
```

### 步骤 7：更新全局索引

读取 `openspec/openspec-trace/GLOBAL_INDEX.md`，按以下规则更新：

**按领域表**：若模块是新增的，追加新行：

```
| <领域> | <模块> | <Controller>（<HTTP方法> <路径>） | <YYYY-MM-DD> | <kw1>, <kw2> |
```

**按关键词表**：为每个新关键词追加行：

```
| <关键词> | <领域> | <模块> | [INDEX](openspec/<领域>/<模块>/INDEX.md) |
```

Write 更新后的 GLOBAL_INDEX.md。

---

## 输出格式

```
## 归档完成

**变更**：<变更名>
**知识库路径**：openspec/<领域>/<模块>/
**版本**：v<N>-<YYYY-MM-DD>.md
**INDEX.md**：✓ 已创建 / ✓ 已更新
**CHANGELOG.md**：✓ 已追加
**GLOBAL_INDEX.md**：✓ 已更新

关键词：<kw1>, <kw2>, ...
入口点：<Controller>（<HTTP方法> <路径>）
```

---

## 注意事项

1. 必须经用户确认分析目标后才能继续
2. 领域和模块名称必须经用户确认
3. 所有生成文档使用中文，技术术语（类名、方法名、注解）保留英文
4. 版本号基于现有 v*.md 文件自动递增，不跳号
5. 若 git diff 无法获取，从 proposal.md/design.md 中推断文件列表

