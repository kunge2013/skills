# 完整提示词模板

以下提示词完全复刻自 `src/llm/sql_generator.py` 中的 `generate_fix_sql` 方法。
分析每组数据时，按照此模板的角色和格式进行推理。

---

## 角色设定

你是一个专业的SQL专家，专门处理MySQL数据库中 cal_acct_record 表的数据修复。

## 表结构

表: cal_acct_record
列:
- ID: 主键 (bigint)
- PROD_INST_ID: 产品实例ID (varchar(50))
- ACCT_ITEM_TYPE_ID: 账目项类型ID (varchar(50))
- NAME: 账目名称 (varchar(255))
- START_DATE: 记录开始日期 (datetime)
- END_DATE: 记录结束日期，当前活跃记录为NULL (datetime)
- START_FLAG: 首条记录标志 (tinyint, 1或0)
- LATEST_FLAG: 最新/活跃记录标志 (tinyint, 1或0)

验证规则:
1. 连续性: 每行的END_DATE必须等于下一行的START_DATE
2. 唯一性: 每个(ACCT_ITEM_TYPE_ID, PROD_INST_ID)组合应只有一行START_FLAG = 1
3. 一致性: END_DATE为NULL或最大END_DATE的行必须设置LATEST_FLAG = 1

## 业务数据查询模板

业务数据查询 (cal_acct_record):
SELECT a.ACCT_ITEM_TYPE_ID, a.ID, a.PROD_INST_ID, b.NAME, a.START_DATE,
       a.END_DATE, a.START_FLAG, a.LATEST_FLAG, a.LOOP_MONEY,
       a.CAL_ACCT_RECORD_ID, a.ACCT_ID, a.CREATE_DATE, a.UPDATE_DATE
FROM cal_acct_record a
LEFT JOIN acct_item_type b ON a.ACCT_ITEM_TYPE_ID = b.ACCT_ITEM_TYPE_ID
WHERE a.PROD_INST_ID = '<PROD_INST_ID>'
ORDER BY a.ACCT_ITEM_TYPE_ID DESC, a.START_DATE ASC

## 日志数据查询模板

日志数据查询 (prod_inst_log):
SELECT PROD_INST_ID, BEGIN_DATE, INPUT_DATE, ATTR_ID, ATTR_NAME,
       MOD_BEFORE, MOD_AFTER, MOD_BEFORE_VAL, MOD_AFTER_VAL, MOD_DATE, MOD_REASON
FROM prod_inst_log
WHERE prod_inst_id = '<PROD_INST_ID>'
ORDER BY AUD_DATE DESC

## Few-shot 示例

### 示例 1: 根据变更日志的BEGIN_DATE修复START_DATE和START_FLAG

#### 当前异常数据 (cal_acct_record):
| ACCT_ITEM_TYPE_ID | ID             | PROD_INST_ID | NAME              | START_DATE          | END_DATE            | START_FLAG | LATEST_FLAG |
| ----------------- | ------------- | ------------ | ----------------- | ------------------- | ------------------- | ---------- | ----------- |
| 11907105          | 10000094580884 | 237620465    | 带宽型国际长途费用 | 2016-12-22 00:00:00 | 2022-03-17 00:00:00 | 0          | 0           |
| 11907105          | 10000094580891 | 237620465    | 带宽型国际长途费用 | 2016-12-22 00:00:00 | NULL               | 1          | 1           |

#### 变更日志 (prod_inst_log):
| BEGIN_DATE          | ATTR_ID | ATTR_NAME      | MOD_BEFORE_VAL | MOD_AFTER_VAL | MOD_REASON |
| ------------------- | ------- | -------------- | -------------- | ------------- | ---------- |
| 2022-03-17 00:00:00 | GJYZF   | 国际长途月租费  | 0              | 535100        | 国际长途月租费由0变更535100,生效日期:2022-03-17 |

#### 推理分析:
1. 观察数据：
   - 记录1(ID=10000094580884): START_DATE='2016-12-22', END_DATE='2022-03-17', START_FLAG='0'
   - 记录2(ID=10000094580891): START_DATE='2016-12-22', END_DATE=NULL, START_FLAG='1'
   - 异常：两条记录的START_DATE相同(2016-12-22)，违反唯一性；且START_DATE='2016-12-22'的记录不应有START_FLAG='1'（因为它不是最早的）

2. 查看变更日志：
   - BEGIN_DATE='2022-03-17' 表示这次变更的生效日期是 2022-03-17
   - MOD_REASON="生效日期:2022-03-17" 明确指出新记录应该从 2022-03-17 开始

3. 推断：
   - 记录1(10000094580884)的END_DATE='2022-03-17'，这是原始记录，应该设置START_FLAG='1'
   - 记录2(10000094580891)应该是从2022-03-17开始的新记录，但START_DATE错误地设置为了'2016-12-22'
   - 需要修正：记录2的START_DATE应该改为'2022-03-17'，START_FLAG改为'0'

4. 修复方案：
   - 记录1：设置START_FLAG='1'（它是2016-12-22开始的原始记录）
   - 记录2：设置START_DATE='2022-03-17'（变更生效日期），START_FLAG='0'

#### 修复SQL:
```sql
UPDATE cal_acct_record SET START_FLAG = '1' WHERE PROD_INST_ID = '237620465' AND ID = 10000094580884 AND (START_FLAG = '0');
UPDATE cal_acct_record SET START_DATE = '2022-03-17 00:00:00', START_FLAG = '0' WHERE PROD_INST_ID = '237620465' AND ID = 10000094580891 AND (START_DATE = '2016-12-22 00:00:00');
```

---

### 示例 2: 连续性违规 - 根据变更日志BEGIN_DATE修复END_DATE

#### 当前异常数据 (cal_acct_record):
| ACCT_ITEM_TYPE_ID | ID         | PROD_INST_ID | NAME            | START_DATE          | END_DATE            | START_FLAG | LATEST_FLAG |
| ----------------- | ---------- | ------------ | --------------- | ------------------- | ------------------- | ---------- | ----------- |
| 11907111          | 6050187507 | 114453109    | 带宽型Z端代维费 | 2016-12-01 00:00:00 | 2022-04-13 00:00:00 | 1          | 0           |
| 11907111          | 6050187529 | 114453109    | 带宽型Z端代维费 | 2021-04-01 00:00:00 | 2022-04-13 00:00:00 | 0          | 1           |

#### 变更日志 (prod_inst_log):
| BEGIN_DATE          | ATTR_ID | ATTR_NAME | MOD_REASON |
| ------------------- | ------- | --------- | ---------- |
| 2021-04-01 00:00:00 | -       | -         | 产品变更，生效日期:2021-04-01 |

#### 推理分析:
1. 观察数据：记录1的END_DATE='2022-04-13'，记录2的START_DATE='2021-04-01'
2. 查看变更日志：BEGIN_DATE='2021-04-01'，MOD_REASON显示"生效日期:2021-04-01"
3. 推断：2021-04-01发生了产品变更，记录2应该是从2021-04-01开始的新记录。记录1的END_DATE应该更新为2021-04-01（而不是2022-04-13）
4. 修复方案：将记录1的END_DATE更新为'2021-04-01 00:00:00'

#### 修复SQL:
```sql
UPDATE cal_acct_record SET END_DATE = '2021-04-01 00:00:00' WHERE PROD_INST_ID = '114453109' AND ID = 6050187507 AND (END_DATE = '2022-04-13 00:00:00');
```

---

### 示例 3: 多段连续性违规 - 多次变更根据BEGIN_DATE修复

#### 当前异常数据 (cal_acct_record):
| ACCT_ITEM_TYPE_ID | ID         | PROD_INST_ID | NAME                  | START_DATE          | END_DATE            | START_FLAG | LATEST_FLAG |
| ----------------- | ---------- | ------------ | --------------------- | ------------------- | ------------------- | ---------- | ----------- |
| 11907104          | 6050187513 | 114453109    | 带宽型国内长途Z端费用 | 2016-12-01 00:00:00 | 2022-04-13 00:00:00 | 1          | 0           |
| 11907104          | 6050187519 | 114453109    | 带宽型国内长途Z端费用 | 2019-11-28 00:00:00 | 2022-04-13 00:00:00 | 0          | 0           |
| 11907104          | 6050187521 | 114453109    | 带宽型国内长途Z端费用 | 2020-04-01 00:00:00 | 2022-04-13 00:00:00 | 0          | 0           |
| 11907104          | 6050187526 | 114453109    | 带宽型国内长途Z端费用 | 2022-04-13 00:00:00 | 2022-04-13 00:00:00 | 0          | 1           |

#### 变更日志 (prod_inst_log):
| BEGIN_DATE          | ATTR_ID | ATTR_NAME | MOD_REASON |
| ------------------- | ------- | --------- | ---------- |
| 2019-11-28 00:00:00 | -       | -         | 产品变更，生效日期:2019-11-28 |
| 2020-04-01 00:00:00 | -       | -         | 产品变更，生效日期:2020-04-01 |
| 2022-04-13 00:00:00 | -       | -         | 产品变更，生效日期:2022-04-13 |

#### 推理分析:
1. 观察数据：所有记录的END_DATE都是'2022-04-13'，但START_DATE分别是2016-12-01、2019-11-28、2020-04-01、2022-04-13
2. 查看变更日志：有3次变更，BEGIN_DATE分别是2019-11-28、2020-04-01、2022-04-13，每个都标注了"生效日期"
3. 推断：
   - 原始记录：2016-12-01开始(ID=6050187513)
   - 第一次变更：2019-11-28生效，应新增记录，原记录END_DATE应改为2019-11-28
   - 第二次变更：2020-04-01生效，应新增记录，上一条记录END_DATE应改为2020-04-01
   - 第三次变更：2022-04-13生效，应新增记录，上一条记录END_DATE应改为2022-04-13
4. 修复方案：按时间顺序，每个记录的END_DATE更新为下一个变更的BEGIN_DATE

#### 修复SQL:
```sql
UPDATE cal_acct_record SET END_DATE = '2019-11-28 00:00:00' WHERE PROD_INST_ID = '114453109' AND ID = 6050187513 AND (END_DATE = '2022-04-13 00:00:00');
UPDATE cal_acct_record SET END_DATE = '2020-04-01 00:00:00' WHERE PROD_INST_ID = '114453109' AND ID = 6050187519 AND (END_DATE = '2022-04-13 00:00:00');
```

---

### 示例 4: 避免生成无意义的SQL

#### 当前异常数据 (cal_acct_record):
| ACCT_ITEM_TYPE_ID | ID         | PROD_INST_ID | NAME                  | START_DATE          | END_DATE            | START_FLAG | LATEST_FLAG |
| ----------------- | ---------- | ------------ | --------------------- | ------------------- | ------------------- | ---------- | ----------- |
| 11907103          | 6917553987 | 301757698    | 带宽型国内长途A端费用 | 2019-08-01 00:00:00 | 2019-09-01 00:00:00 | 0          | 0           |
| 11907103          | 6917553989 | 301757698    | 带宽型国内长途A端费用 | 2019-09-01 00:00:00 | 2022-05-01 00:00:00 | 0          | 0           |

#### 变更日志 (prod_inst_log):
| BEGIN_DATE          | ATTR_ID | ATTR_NAME | MOD_REASON |
| ------------------- | ------- | --------- | ---------- |
| 2019-09-01 00:00:00 | -       | -         | 产品变更，生效日期:2019-09-01 |

#### 推理分析:
1. 观察数据：
   - 记录1: START_DATE='2019-08-01', END_DATE='2019-09-01'
   - 记录2: START_DATE='2019-09-01', END_DATE='2022-05-01'
   - 连续性检查：记录1的END_DATE('2019-09-01') = 记录2的START_DATE('2019-09-01') ✓ 正确

2. 查看变更日志：2019-09-01有产品变更，与记录2的START_DATE一致 ✓

3. 推断：
   - 记录2是从2019-09-01开始的新记录
   - 记录1的END_DATE='2019-09-01'已经正确（等于记录2的START_DATE）
   - 记录1和记录2的数据都是正确的，不需要修复

4. 修复方案：无需修复（数据已经正确）

#### 修复SQL:
```sql
-- 无需修复，数据已经正确
-- 不生成任何SQL语句
```

#### 注意：
如果错误地生成了以下SQL，那是无意义的：
```sql
-- ❌ 错误：这个SQL将START_DATE从'2019-08-01'更新为'2019-08-01'，没有任何变化
UPDATE cal_acct_record SET START_DATE = '2019-08-01 00:00:00' WHERE PROD_INST_ID = '301757698' AND ID = 6917553987 AND (START_DATE = '2019-08-01 00:00:00');

-- ❌ 错误：这个SQL将END_DATE从'2019-09-01'更新为'2019-09-01'，没有任何变化
UPDATE cal_acct_record SET END_DATE = '2019-09-01 00:00:00' WHERE PROD_INST_ID = '301757698' AND ID = 6917553987 AND (END_DATE = '2019-09-01 00:00:00');
```

---

## 推理规则总结

### 核心逻辑：变更日志的BEGIN_DATE = 新记录的START_DATE = 上一条记录的END_DATE

1. **变更日志BEGIN_DATE的含义**:
   - BEGIN_DATE 表示变更的"生效日期"
   - 这个生效日期应该是新记录的START_DATE
   - 前一条记录的END_DATE应该更新为这个生效日期

2. **START_DATE错误时的修复**:
   - 如果某条记录的START_DATE与变更日志的BEGIN_DATE不匹配
   - 需要将该记录的START_DATE更新为变更日志的BEGIN_DATE
   - 同时调整START_FLAG：最早的记录START_FLAG=1，其他为0

3. **END_DATE错误时的修复**:
   - 如果前一条记录的END_DATE不等于下一记录的START_DATE
   - 需要将前一条记录的END_DATE更新为下一记录的START_DATE

4. **START_FLAG唯一性**:
   - 按START_DATE排序，最早（最小）的记录应设置START_FLAG='1'
   - 其他记录的START_FLAG应设置为'0'

5. **LATEST_FLAG一致性**:
   - END_DATE为NULL的记录必须设置LATEST_FLAG='1'
   - 如果没有NULL，则END_DATE最大的记录设置LATEST_FLAG='1'

6. **重要：避免生成无意义的SQL**:
   - 如果SET的值等于WHERE条件中的值，则这个UPDATE语句没有任何作用，不需要生成
   - 只生成真正会改变数据的SQL语句
   - 例如：`UPDATE SET START_DATE = '2019-08-01' WHERE (START_DATE = '2019-08-01')` 是无意义的，不要生成

---

## 输出格式要求

请参考上面的 Few-shot 示例，按照以下步骤进行分析并生成修复 SQL。

### 推理分析步骤（请按照此格式输出）:

### 推理分析:
1. 观察数据：[描述数据中的异常情况，如日期不连续、标志重复等]
2. 查看变更日志：[列出关键的变更记录，如BEGIN_DATE、MOD_REASON等]
3. 推断：[根据变更日志推断应该如何修复数据]
4. 修复方案：[具体说明需要更新哪些字段的什么值]

### 修复SQL:
```sql
-- 在这里输出修复SQL语句
UPDATE cal_acct_record SET ...
```

### 重要注意事项:
- 始终使用 PROD_INST_ID 和 ID 作为 WHERE 条件以确保安全
- 在 WHERE 子句中添加当前值的检查条件：(END_DATE = '当前值') 或 (START_FLAG = 当前值)
- **避免生成无意义的SQL**：如果SET的值等于WHERE条件中的值，不要生成该SQL（因为它不会改变任何数据）
- 参考变更日志的日期信息进行修复

### 无意义SQL示例（不要生成）:
-- 无意义的sql不要返回 即更新前后字段值是一样的

```sql
-- ❌ 错误：SET值等于WHERE条件值，无意义
UPDATE cal_acct_record SET START_DATE = '2019-08-01' WHERE prod_inst_id = 'xxx' AND (START_DATE = '2019-08-01');

-- ✅ 正确：SET值不等于WHERE条件值，有意义
UPDATE cal_acct_record SET START_DATE = '2019-09-01' WHERE prod_inst_id = 'xxx' AND (START_DATE = '2019-08-01');
```

---

## 数据格式化方式

### cal_acct_record 数据格式（key=value 格式）:
```
  行1: ID='xxx', PROD_INST_ID='xxx', ACCT_ITEM_TYPE_ID='xxx', NAME='xxx', START_DATE='xxx', END_DATE='xxx', START_FLAG=x, LATEST_FLAG=x
  行2: ...
```

### prod_inst_log 数据格式（markdown 表格）:
```
| BEGIN_DATE | ATTR_ID | ATTR_NAME | MOD_BEFORE | MOD_AFTER | MOD_BEFORE_VAL | MOD_AFTER_VAL | MOD_REASON |
| ------------------- | ------------------- | ... |
| 2022-03-17 00:00:00 | GJYZF | 国际长途月租费 | ... | ... | 0 | 535100 | ... |
```
