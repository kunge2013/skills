---
name: fix-cal-acct-record
description: 分析 cal_acct_record 表数据异常并生成修复SQL。当用户提到数据修复、cal_acct_record、账目项异常、实例ID分析、数据连续性检查、START_FLAG/LATEST_FLAG/END_DATE修复时触发。即使用户只说"分析这个Excel"或"帮我修数据"，只要涉及产品实例和账目项数据修复都应使用此skill。
---

# cal_acct_record 数据分析修复 Skill

## 概述

这个 skill 指导 Claude 完成以下工作流：
1. 读取用户提供的 Excel 文件（包含 PROD_INST_ID 和 ACCT_ITEM_TYPE_ID）
2. 通过 Python 脚本连接 MySQL 数据库查询相关数据
3. 逐行分析每个 (PROD_INST_ID, ACCT_ITEM_TYPE_ID) 组合的异常
4. 按照固定的推理格式生成修复 SQL
5. 每分析完一行，立即追加结果到 `xxx_分析结果.xlsx`

## 前置条件

skill 目录下需要一个 `.env` 文件配置数据库连接：

```env
DB_HOST=192.168.2.161
DB_PORT=8866
DB_USER=jtbill
DB_PASSWORD=Jtbill_#1024
DB_NAME=jtbill_uat
```

如果 `.env` 不存在，提示用户创建。读取 `scripts/` 下的 `query_data.py` 脚本来执行数据库查询。

## 工作流程

### Step 1: 读取输入 Excel

读取用户指定的 Excel 文件，解析出所有 (PROD_INST_ID, ACCT_ITEM_TYPE_ID) 行。

### Step 2: 逐行查询数据库并获取完整提示词

对每一行，运行 `scripts/query_data.py`，脚本会：读取 Excel 指定行 → 查询 MySQL → 格式化数据 → 组装完整提示词 → 直接输出。

用法：
```bash
# 获取 Excel 总行数
python scripts/query_data.py --file <excel路径> --total

# 获取第 N 行（从0开始）的完整提示词
python scripts/query_data.py --file <excel路径> --row <行号>

# 或直接指定 ID
python scripts/query_data.py --prod-inst-id <ID> --acct-item-type-id <TYPE_ID>
```

脚本输出的就是组装好的完整提示词（包含角色设定、表结构、Few-shot示例、当前数据、输出格式要求），Claude 直接阅读这个输出进行分析即可。

### Step 3: 分析并生成修复 SQL

拿到数据后，Claude 扮演 SQL 修复专家角色进行分析。

**提示词和分析格式完全按照 `references/prompt_template.md` 中的内容执行。** 读取该文件获取完整的：
- 角色设定
- 表结构定义
- 业务数据查询模板
- 日志数据查询模板
- 4个 Few-shot 示例（含推理过程和修复SQL）
- 推理规则总结（6条核心规则）
- 输出格式要求
- 数据格式化方式

分析时必须严格遵循 `references/prompt_template.md` 中的推理步骤和输出格式，不得省略或改写。

### 动态组装提示词

每次分析一行数据时，完整提示词由 **静态模板 + 动态数据** 组装而成。组装结构如下：

```
你是一个专业的SQL专家，专门处理MySQL数据库中 cal_acct_record 表的数据修复。

# 表结构
{TABLE_SCHEMA 内容 —— 来自 prompt_template.md}

# 业务数据查询模板
{BUSINESS_DATA_SCHEMA 内容 —— 来自 prompt_template.md}

# 日志数据查询模板
{LOG_DATA_SCHEMA 内容 —— 来自 prompt_template.md}

# Few-shot 示例
{FEW_SHOT_EXAMPLES 内容 —— 来自 prompt_template.md 的4个完整示例}

---

# 当前实例数据

## 当前异常数据 (cal_acct_record):
{动态填入：当前行查询到的 cal_acct_record 数据}

## 变更日志 (prod_inst_log):
{动态填入：当前行查询到的 prod_inst_log 数据}

---

{输出格式要求 + 注意事项 —— 来自 prompt_template.md}
```

### 数据格式化规则

**cal_acct_record 数据**格式化为 key=value 形式（复刻 `_format_data_for_prompt`）：
```
  行1: ID='10000094580884', PROD_INST_ID='237620465', ACCT_ITEM_TYPE_ID='11907105', NAME='带宽型国际长途费用', START_DATE='2016-12-22 00:00:00', END_DATE='2022-03-17 00:00:00', START_FLAG=0, LATEST_FLAG=0
  行2: ID='10000094580891', PROD_INST_ID='237620465', ACCT_ITEM_TYPE_ID='11907105', NAME='带宽型国际长途费用', START_DATE='2016-12-22 00:00:00', END_DATE=None, START_FLAG=1, LATEST_FLAG=1
```

规则：
- 字符串类型的值用单引号包裹：`KEY='value'`
- 数字类型不加引号：`START_FLAG=0`
- NULL 值显示为 `None`（不加引号）
- 每行以 `行N:` 开头，字段用逗号分隔

**prod_inst_log 数据**格式化为 markdown 表格（复刻 `_format_log_data_for_prompt`）：
```
| BEGIN_DATE | ATTR_ID | ATTR_NAME | MOD_BEFORE | MOD_AFTER | MOD_BEFORE_VAL | MOD_AFTER_VAL | MOD_REASON |
| ------------------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- |
| 2022-03-17 00:00:00 | GJYZF | 国际长途月租费 | - | - | 0 | 535100 | 国际长途月租费由0变更535100,生效日期:2022-03-17 |
```

规则：
- 表头固定为：BEGIN_DATE, ATTR_ID, ATTR_NAME, MOD_BEFORE, MOD_AFTER, MOD_BEFORE_VAL, MOD_AFTER_VAL, MOD_REASON
- NULL 值显示为 `-`
- 如果没有日志数据，显示 `无日志数据`

---

## Step 4: 追加写入结果

每分析完一行数据，立即调用 `scripts/append_result.py` 追加到输出 Excel：

```bash
python scripts/append_result.py --output <输出文件路径> --prod-inst-id <ID> --acct-item-type-id <TYPE_ID> --sql "<生成的SQL>" --prompt "<分析过程>"
```

输出 Excel 文件列：
| PROD_INST_ID | ACCT_ITEM_TYPE_ID | UPDATE_SQL | ANALYSIS_PROMPT |
|---|---|---|---|

输出文件命名规则：`<输入文件名>_分析结果.xlsx`

## 关键注意事项

- 每分析一行就追加一次，不要等全部分析完再写入（防止中途中断丢失已有结果）
- 如果某行数据实际上没有异常（验证规则全部通过），在 UPDATE_SQL 列写 `-- 无需修复，数据已正确`
- 如果查询不到数据，在 UPDATE_SQL 列写 `-- 未查到数据`
- .env 文件路径为 skill 目录下：`~/.claude/skills/data_analysis/.env`
