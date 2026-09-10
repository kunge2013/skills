<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-10 -->

# LLM 调用日志记录与查询设计文档

**日期**: 2026-09-10
**作者**: Claude + fangkun
**状态**: 设计完成,待评审

---

## 概述

为所有文本 LLM 调用提供日志记录:每次调用记录请求报文、响应报文、模型参数、耗时与状态,并提供按条件查询的 REST API 与前端页面,便于分析问题(排查参数效果、连接失败、返回结构异常等)。

## 核心需求

### 功能需求

1. **全量采集**: 覆盖 `LLMService` 全部调用方式 —— `sendMessage` / `sendRaw` / `sendMessageStream` / `sendMessageStreamWithTools` / `testConnection`,即 ApiTester、提示词服务、流式对话、连接测试等所有走适配器的模型请求
2. **记录内容**: 每条日志含请求报文(原始 payload 或 messages)、响应报文(完整原始响应或 content)、模型参数(modelId + temperature/max_tokens 等生效参数)、来源、耗时、状态
3. **按日期轮转存储**: JSONL 追加文件,`data/llm-call-logs/YYYY-MM-DD.jsonl`,天然支持时间范围查询
4. **查询 REST API**: 支持按时间范围 / 模型 / 来源 / 状态过滤、时间倒序、分页;单条详情;区间清理
5. **前端查询页面**: 侧边栏新增「调用日志」页面,筛选 + 列表 + 详情抽屉,JSON 高亮展示报文

### 非功能需求

- 复用现有 `FileStorageProvider` 的数据目录(`DATA_DIR`)与 JSONL 追加,不新增数据库依赖
- 日志写入失败不影响主流程(只 warn),单个损坏行跳过不中断查询
- 流式调用在完成后一次性写入完整记录(不实时追加)
- 支持国际化(中英文),与现有 UI 风格一致
- 新增后端单测覆盖 logger / query / 路由

---

## 方案选型

| 方案 | 描述 | 结论 |
|------|------|------|
| **A. LLMService 层统一采集**(推荐) | 新建 `LLMCallLogger`,注入 `LLMService`,包裹各方法采集 | ✅ 采用。单一拦截点覆盖所有调用方,天然拿到 config 与 payload |
| B. 适配器层采集 | 4 个 adapter 每个 `send*` 方法埋点 | 放弃。代码重复 4 份,流式 chunk 处理复杂 |
| C. Express 中间件拦截 /llm/* | 路由层包裹 | 放弃。流式难捕获,经 PromptService 的调用路径覆盖不全,拿不到解析后的模型参数 |

存储/查询/前端方案按用户确认:**JSONL 按日轮转 + REST API + 前端页面**。

---

## 后端架构设计

### 文件结构

```
src/server/
├── routes/
│   └── llm-call-logs.ts               # 新增: GET /llm-call-logs 列表/详情, DELETE 清理
└── services/llm-call/
    ├── types.ts                        # 新增: LLMCallLogRecord 类型
    ├── logger.ts                       # 新增: LLMCallLogger(写 JSONL)
    └── query.ts                        # 新增: LLMCallLogQuery(读/过滤/分页)
```

修改文件:
- `src/server/services/llm/service.ts`  — 注入 `LLMCallLogger`,包裹各方法
- `src/server/services/llm/types.ts`   — `ILLMService` 无变化,`LLMService` 构造签名增加可选 logger
- `src/server/prompt-server.ts`         — 组装 `LLMCallLogger` / `LLMCallLogQuery`,注册路由
- `web/src/...`                        — 新增页面 + store + i18n + 路由

### 日志数据结构

每条记录一行 JSON,写入 `data/llm-call-logs/YYYY-MM-DD.jsonl`:

```typescript
interface LLMCallLogRecord {
  id: string;                      // uuid
  timestamp: number;               // 调用开始时间(ms)
  durationMs: number;              // 调用耗时(ms)
  source: LLMCallSource;           // 'apiTester' | 'prompt' | 'stream' | 'test-connection'
  modelKey: string;                // e.g. 'openai/gpt-4o'
  protocol: 'openai' | 'anthropic';
  modelParams: Record<string, unknown>;  // modelId + config.paramOverrides 等生效参数
  request: Record<string, unknown>;      // 请求报文(messages 或 raw payload)
  response: Record<string, unknown> | null;  // 响应报文
  status: number;                  // 200 成功,非 200 失败
  error: string | null;            // 失败时的错误信息
}

type LLMCallSource = 'apiTester' | 'prompt' | 'stream' | 'test-connection';
```

> `modelParams` 从 `TextModelConfig` 推导: `{ modelId, ...paramOverrides }`,即用户所理解的"模型参数"。

### LLMCallLogger 设计

```typescript
interface LLMCallHandle {
  complete(result: { response?: unknown; status: number; error?: string }): void;
}

class LLMCallLogger {
  // start 记录请求与开始时间,complete 时追加一行完整记录
  start(init: {
    source: LLMCallSource;
    modelKey: string;
    protocol: 'openai' | 'anthropic';
    modelParams: Record<string, unknown>;
    request: Record<string, unknown>;
  }): LLMCallHandle;
}
```

- 写盘用内部异步串行队列(`fs.promises.appendFile`),避免并发交错
- 写失败 `console.warn`,绝不影响主调用流程
- 流式调用:包裹 `onToken`/`onComplete`/`onError`,在 `onComplete`/`onError` 时 `complete()` 写入累计的完整 content/reasoning

### LLMCallLogQuery 设计

```typescript
interface LLMCallLogFilter {
  from?: number;        // 起始时间戳
  to?: number;          // 结束时间戳
  modelKey?: string;
  source?: LLMCallSource;
  status?: number;
}
interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

class LLMCallLogQuery {
  list(filter: LLMCallLogFilter, page: number, pageSize: number): Promise<Paginated<LLMCallLogRecord>>;
  getById(id: string): Promise<LLMCallLogRecord | null>;
  deleteRange(from: number, to: number): Promise<number>;  // 删除时间区间内的文件
}
```

- 按日期范围确定文件集(`YYYY-MM-DD.jsonl`),逐行解析;损坏行跳过并计数
- 内存过滤 + 排序(时间倒序)+ 分页;量级为本地工具可接受
- `getById` 需要扫描文件(倒序找)以支持 :id

### REST API

`src/server/routes/llm-call-logs.ts`,挂载到 `/api/v1`(走现有 `authMiddleware`):

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/llm-call-logs?from&to&modelKey&source&status&page&pageSize` | 分页列表(默认 page=1, pageSize=20) |
| GET | `/llm-call-logs/:id` | 单条详情,未找到返回 404 |
| DELETE | `/llm-call-logs?from&to` | 清理时间区间日志,返回删除数量 |

响应统一走现有 `{ success, data, error }` 信封。

### LLMService 改造

每个方法包裹 logger:

- `sendMessage(messages, provider)` → `source: 'prompt'`,request=messages,response=`{ content, metadata }`
- `sendRaw(payload, provider)` → `source: 'apiTester'`,request=payload,response=原始响应
- `sendMessageStream(...)` → `source: 'stream'`,累计 fullContent/reasoning 后在 onComplete 写
- `sendMessageStreamWithTools(...)` → `source: 'stream'`,同流式
- `testConnection(provider)` → `source: 'test-connection'`,request=测试消息,response=回复 content

`modelKey` 取 `config.id`(`openai/gpt-4o` 形式),`protocol` 由 `resolveProtocol(config)` 得到,`modelParams` = `{ modelId, ...paramOverrides }`。

---

## 前端架构设计

### 页面

新增 `web/src/components/LLMCallLogs.vue`,侧边栏「调用日志」入口(风格同 ApiTester,含中英文 i18n)。

- **筛选栏**: 时间范围(el-date-picker 或日期选择)、模型(下拉,来自已启用模型)、来源(下拉)、状态(下拉)
- **列表**: el-table —— 时间、模型、来源、状态(标签)、耗时(ms)、请求摘要(截断首行)
- **分页**: el-pagination
- **详情**: 点击行打开 el-drawer,三个区:请求报文 / 响应报文(JSON 高亮)、模型参数(key-value 或 JSON)。复用 ApiTester 的 `highlightJson` 高亮逻辑(抽到共享工具 `web/src/utils/jsonHighlight.ts`)

### Store

新增 `web/src/stores/llmCallLogs.ts`(Pinia):`filters`、`list`、`total`、`loading`,`fetchList()` / `fetchById()` / `clearRange()`,调用 `/api/v1/llm-call-logs`。

### 路由与 i18n

- 路由注册方式对齐 ApiTester 现有做法
- i18n 增加 `llmCallLogs.*` 文案(zh/en)

---

## 数据流

1. 前端/服务调用方触发 LLM 调用
2. `LLMService` 方法调用 `logger.start(...)`,记录开始时间、请求报文、模型参数
3. 调用成功/失败后调用 `handle.complete(...)`,追加一行完整记录到当天 JSONL 文件
4. 前端「调用日志」页通过 REST API 查询、筛选、查看详情

## 错误处理

- 日志写盘失败:`console.warn`,不影响 LLM 调用结果
- 查询:文件不存在 → 空列表;某行 JSON 损坏 → 跳过该行继续
- `GET /:id` 未找到 → `404 { success:false, error }`
- 前端:加载失败提示 `ElMessage.error`

## 测试

- **单元**: `logger` 写入格式正确、按日生成文件名、写失败不影响返回;`query` 过滤/分页/倒序/损坏行跳过
- **路由**: `GET /llm-call-logs` 分页与过滤、`GET /:id` 命中与 404、`DELETE` 区间清理
- **集成**: 调用 `sendRaw` / `sendMessage` 后对应 JSONL 出现完整记录(写失败注入场景)

## 敏感数据说明

按用户确认采用**原样全录**(本地分析工具)。说明:记录的是 LLM 请求/响应报文,服务端 API key 存于模型配置,不进请求 payload;`Authorization` 等 HTTP 头不在记录范围。若未来需要对外分享日志,可在此设计之上增加脱敏层(本次不实现)。
