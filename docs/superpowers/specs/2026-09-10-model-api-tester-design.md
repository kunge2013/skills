<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-10 -->

# 模型 API 调用界面设计文档

**日期**: 2026-09-10
**作者**: Claude + fangkun
**状态**: 设计完成,待评审

---

## 概述

为已配置的文本 LLM 模型提供一个 Swagger 风格的「Try it out」调用界面：选择模型 → 输入原始请求 JSON payload → 返回模型完整原始响应 JSON。用于快速验证模型连接、参数效果和返回结构。

## 核心需求

### 功能需求

1. **模型选择**: 从已启用的文本模型中下拉选择，显示模型名与所属 provider
2. **原始 Payload 输入**: 输入完整请求体 JSON（如 `{ messages: [...], temperature, max_tokens, tools }`），与 OpenAI / Anthropic 原生 API 格式一致
3. **完整 JSON 响应**: 返回模型原始响应 JSON（含 `content`、`usage` tokens、`stop_reason` / `finish_reason`、`model` 等全部字段），不做裁剪
4. **协议自适应**: 根据所选模型的协议（`openai` / `anthropic`）加载对应风格的示例 payload
5. **界面便捷**: 一键加载示例、格式化 JSON、复制响应、显示请求耗时

### 非功能需求

- 复用现有模型配置体系（`ModelManager` + `TextAdapterRegistry`），不新增存储
- 支持国际化（中英文）
- 错误处理友好，展示上游原始错误信息
- 新增后端单测，覆盖 `/llm/raw` 路由

---

## 方案选型

| 方案 | 描述 | 结论 |
|------|------|------|
| **A. 原生透传 + 独立页面**（推荐） | adapter 新增 `sendRaw(payload, config)`，直接透传 payload 调用 SDK，返回完整原始响应；前端侧边栏新增独立页面 | ✅ 采用。真正 Swagger 风格，信息最全 |
| B. 复用现有 adapter + 增强元数据 | 解析 payload 为 messages + 参数，走 `sendMessageStructured` | 放弃。参数映射有损，不够"原始" |
| C. 独立静态 HTML 页 | Express 直接托管单页 | 放弃。与现有 Vue UI 风格不一致 |

---

## 后端架构设计

### 文件结构

```
src/server/
├── routes/
│   └── llm.ts                          # 修改: 新增 POST /llm/raw
└── services/llm/
    ├── types.ts                        # 修改: ITextProviderAdapter 新增 sendRaw
    ├── service.ts                      # 修改: 新增 sendRaw 方法
    └── adapters/
        ├── openai-adapter.ts           # 修改: 实现 sendRaw
        └── anthropic-adapter.ts        # 修改: 实现 sendRaw
```

> **说明**: LLMService 的文本调用仅解析到 `openai` / `anthropic` 两种协议（`resolveProtocol`）。Gemini / DeepSeek 文本模型也通过 OpenAI 兼容协议走 openai adapter，其自身 adapter（`@google/genai` / openai client）只在 `fetchModelList` 时被直接引用。因此只需在 openai、anthropic 两个 adapter 上实现 `sendRaw`。

### 接口扩展

```typescript
// services/llm/types.ts
export interface ITextProviderAdapter {
  // ...现有方法

  // 新增(可选): 透传原始请求，返回完整原始响应
  sendRaw?(
    payload: Record<string, any>,
    config: TextModelConfig
  ): Promise<Record<string, any>>
}
```

接口方法设为可选：仅 openai / anthropic 两个 adapter 实现；LLMService 在适配器缺失该方法时抛出明确错误。两个 adapter 的实现逻辑一致：用现有 `getClient(config)` 构造 SDK 客户端，调用 create 方法时以 payload 为基础，若 payload 未指定 `model` 则用 `config.modelId` 兜底，返回 SDK 的原始响应对象。

```typescript
// openai-adapter.ts
async sendRaw(payload, config) {
  const client = getClient(config)
  const body = { ...payload, model: payload.model || config.modelId }
  const response = await client.chat.completions.create(body)
  return response as Record<string, any>
}

// anthropic-adapter.ts
async sendRaw(payload, config) {
  const client = getClient(config)
  const body = { ...payload, model: payload.model || config.modelId }
  const response = await client.messages.create(body)
  return response as Record<string, any>
}
```

### LLMService 扩展

```typescript
// services/llm/service.ts
async sendRaw(payload: Record<string, any>, provider: string): Promise<Record<string, any>> {
  const config = await this.getModelConfig(provider)
  const protocol = resolveProtocol(config)
  const adapter = this.registry.getAdapter(protocol)
  if (!adapter.sendRaw) {
    throw new Error(`Provider "${provider}" does not support raw invocation`)
  }
  return adapter.sendRaw(payload, config)
}
```

### API 路由设计

#### POST /api/v1/llm/raw

**描述**: 向指定模型发送原始请求 payload，返回完整原始响应

**请求体**:
```json
{
  "modelKey": "gpt-4o",
  "payload": {
    "messages": [{ "role": "user", "content": "Hello" }],
    "temperature": 0.7,
    "max_tokens": 100
  }
}
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "id": "chatcmpl-...",
    "object": "chat.completion",
    "model": "gpt-4o",
    "choices": [{
      "index": 0,
      "message": { "role": "assistant", "content": "..." },
      "finish_reason": "stop"
    }],
    "usage": { "prompt_tokens": 12, "completion_tokens": 8, "total_tokens": 20 }
  }
}
```

**错误响应** (统一 400):
```json
{ "success": false, "error": { "message": "..." } }
```

---

## 前端架构设计

### 文件结构

```
web/src/
├── components/
│   ├── NavSidebar.vue                  # 修改: 新增「API 调用」菜单项
│   └── ApiTester.vue                   # 新增: 主界面
├── App.vue                             # 修改: 渲染 ApiTester
├── stores/
│   ├── skills.ts                       # 修改: setView 支持新 view
│   └── prompt.ts                       # 修改: 新增 raw 调用 action 与状态
└── i18n/locales*/
    ├── en.json                         # 修改: 新增文案
    └── zh-CN.json                      # 修改: 新增文案
```

### ApiTester.vue 界面

```
┌──────────────────────────────────────────────────────────────────┐
│ 模型选择 [gpt-4o (openai) ▼]   [协议: openai]                     │
├────────────────────────────────────────┬─────────────────────────┤
│ 请求 Payload (JSON)                    │ 响应 JSON               │
│ [加载示例] [格式化] [清空]              │ [复制]  耗时: 1.2s 状态: 200│
│ ┌────────────────────────────────────┐ │ ┌─────────────────────┐ │
│ │ {                                  │ │ │ {                   │ │
│ │   "messages": [                    │ │ │   "id": "...",      │ │
│ │     { "role": "user",              │ │ │   "choices": [...], │ │
│ │       "content": "Hello" }         │ │ │   "usage": {...}    │ │
│ │   ],                               │ │ │ }                   │ │
│ │   "temperature": 0.7,              │ │ └─────────────────────┘ │
│ │   "max_tokens": 100                │ │                        │
│ │ }                                  │ │                        │
│ └────────────────────────────────────┘ │                        │
│                    [发 送]             │                        │
└────────────────────────────────────────┴─────────────────────────┘
```

**状态管理**（加入 prompt store）：

```typescript
// stores/prompt.ts 新增 state
apiTester: {
  payload: string          // JSON 编辑器内容（字符串）
  response: string         // 格式化后的响应 JSON（字符串）
  error: string
  loading: boolean
  duration: number
  httpStatus: number
}
```

**交互逻辑**：

1. **加载模型**: 复用 `loadModels()`，`enabledModels` 作为下拉数据源；若已有 `selectedModelKey` 则默认选中
2. **切换模型**: 根据所选模型的 `protocol`（默认按 `providerId === 'anthropic'` 推导）加载对应示例 payload（仅在编辑器为空或仍为上一示例时覆盖）
3. **发送**:
   - 前端 `JSON.parse` 校验 payload，非法则 `el-message` 提示且不发送
   - `POST /api/v1/llm/raw` `{ modelKey, payload }`
   - 成功后 `JSON.stringify(data, null, 2)` 展示，记录耗时与 HTTP 状态
   - 失败展示 `error.message`（含上游原始错误）
4. **示例模板**:

**OpenAI 风格**（协议 `openai`）:
```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 100
}
```

**Anthropic 风格**（协议 `anthropic`）:
```json
{
  "system": "You are a helpful assistant.",
  "messages": [{ "role": "user", "content": "Hello!" }],
  "max_tokens": 8192,
  "temperature": 0.7
}
```

### 导航集成

- `NavSidebar.vue`: 新增菜单项 `index="apiTester"`，图标 `Promotion` 或 `Connection`
- `App.vue`: `currentView === 'apiTester'` → 渲染 `ApiTester.vue`
- `stores/skills.ts`: `setView` 允许任意字符串 view；`activeMenu` computed 新增 `apiTester` 分支

---

## 数据流

```
1. 页面加载 → GET /api/v1/models（enabledModels）填充下拉
2. 用户选模型 → 按协议加载示例 payload
3. 点「发送」→ JSON 校验 → POST /api/v1/llm/raw { modelKey, payload }
4. 后端: getModelConfig → resolveProtocol → adapter.sendRaw → SDK 透传 → 完整原始响应
5. 前端: 格式化展示 JSON + 耗时 + 状态码；错误显示错误信息
```

---

## 错误处理策略

| 场景 | 前端 | 后端 |
|------|------|------|
| payload 非法 JSON | 阻止发送，el-message 提示 | — |
| 模型未选择 | 禁用发送按钮 | — |
| 模型不存在 | 显示错误 | 400 |
| 模型 API key 未配置 | 显示上游错误 | SDK 抛错 → 400 |
| 上游 API 报错（4xx/5xx） | 显示 error.message | 透传 message |
| 网络中断 | 显示网络错误，可重试 | — |

---

## 国际化支持

新增 `apiTester.*` 命名空间翻译键（中英文），覆盖：页面标题、模型选择占位、请求/响应标题、加载示例、格式化、清空、复制、发送、发送中、耗时、状态、协议标签、JSON 校验错误等。

---

## 实施计划

1. 后端：`types.ts` 扩展接口（`sendRaw?`）+ openai / anthropic adapter 实现 `sendRaw`
2. 后端：`LLMService.sendRaw` + `routes/llm.ts` 新增 `POST /llm/raw`
3. 后端：`__tests__` 新增 `/llm/raw` 路由单测（mock LLMService）
4. 前端：`prompt.ts` store 新增 raw 调用 action 与状态
5. 前端：`ApiTester.vue` 组件（模型下拉 + payload 编辑器 + 响应区）
6. 前端：`NavSidebar.vue` + `App.vue` + `stores/skills.ts` 导航集成
7. 前端：i18n 中英文文案
8. 测试：`npm run web` 浏览器实测 golden path 与边界用例
9. 构建校验：`npm run build:server`（tsc）+ web 侧 `vue-tsc -b && vite build`

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 原始 payload 需匹配协议格式 | 中 | 界面按协议加载示例模板，并展示协议标签 |
| Anthropic 请求缺少 max_tokens 会报错 | 中 | 示例模板内置 max_tokens；错误信息透传提示 |
| SDK 响应对象含不可序列化字段 | 低 | OpenAI/Anthropic SDK 响应均为普通 JSON 对象，`res.json` 可直接序列化；实现时如遇异常字段则剥离 |
| 透传非法字段导致上游 400 | 低 | 错误信息透传，用户可据此调整 payload |

---

## 验收标准

### 功能验收

- [ ] 侧边栏可进入「API 调用」页面
- [ ] 模型下拉列出全部已启用模型
- [ ] 切换模型后按协议加载正确风格的示例 payload
- [ ] 可手动编辑 payload 并发送
- [ ] 响应展示完整原始 JSON（含 usage / finish_reason 等）
- [ ] 支持复制响应、显示耗时
- [ ] 非法 JSON 阻止发送并提示
- [ ] 上游报错时展示可读错误信息

### 质量验收

- [ ] `src` 侧 `npm run build:server` 通过（tsc）
- [ ] web 侧 `npm run build`（vue-tsc + vite）通过
- [ ] `/llm/raw` 单测通过
- [ ] 中英文切换文案正常

---

## 附录

### 涉及文件清单

| 文件 | 操作 |
|------|------|
| `src/server/services/llm/types.ts` | 修改 |
| `src/server/services/llm/adapters/openai-adapter.ts` | 修改 |
| `src/server/services/llm/adapters/anthropic-adapter.ts` | 修改 |
| `src/server/services/llm/service.ts` | 修改 |
| `src/server/routes/llm.ts` | 修改 |
| `__tests__/llm-raw.test.ts` | 新增 |
| `web/src/components/ApiTester.vue` | 新增 |
| `web/src/components/NavSidebar.vue` | 修改 |
| `web/src/App.vue` | 修改 |
| `web/src/stores/skills.ts` | 修改 |
| `web/src/stores/prompt.ts` | 修改 |
| `web/src/i18n/locales/en.json` | 修改 |
| `web/src/i18n/locales/zh-CN.json` | 修改 |

---

**文档版本**: 1.0
**最后更新**: 2026-09-10
