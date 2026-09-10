<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-10 -->

# 模型 API 调用界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为已配置的文本 LLM 模型提供 Swagger 风格的调用界面：选择模型 → 输入原始请求 JSON payload → 返回完整原始响应 JSON。

**Architecture:** 后端给 openai / anthropic 两个 adapter 新增可选的 `sendRaw(payload, config)` 方法，直接透传 payload 调用 SDK 并返回完整原始响应；`LLMService` 新增 `sendRaw`，新增 `POST /api/v1/llm/raw` 路由。前端侧边栏新增独立入口 `apiTester`，渲染新的 `ApiTester.vue` 页面（模型下拉 + JSON payload 编辑器 + 完整 JSON 响应区）。

**Tech Stack:** Node/Express + TypeScript（后端）、Vue 3 + Element Plus + Pinia + vue-i18n（前端）、Vitest + supertest（测试）。

## Global Constraints

- 代码注释遵循 AGC 约定：每个新增函数/类用 `// [AGC:START] tool=Cc author=fangkun` ... `// [AGC:END]` 包裹；整文件新增在第 1 行加 `// [AGC:FILE] tool=Cc author=fangkun date=YYYY-MM-DD`。
- TypeScript：避免 `any`（对 SDK 返回等外部值用 `as unknown as Record<string, any>` 收敛）；公开 API 标注显式类型。
- 后端路由统一挂在 `/api/v1`，响应统一 `{ success, data?, error? }` 信封；失败统一 400。
- 接口新增方法 `sendRaw?` 为**可选**，仅 openai / anthropic adapter 实现（LLMService 文本调用只解析到这两个协议，见 spec）。
- 不新增存储；复用 `ModelManager` / `TextAdapterRegistry`。
- 提交信息遵循 conventional commits（`feat`/`fix`/`refactor`/`docs`/`test`/`chore`）。

---

### Task 1: 后端 — openai / anthropic adapter 实现 `sendRaw`

**Files:**
- Modify: `src/server/services/llm/types.ts` — `ITextProviderAdapter` 新增可选 `sendRaw?`
- Modify: `src/server/services/llm/adapters/openai-adapter.ts` — 新增 `sendRaw` 方法
- Modify: `src/server/services/llm/adapters/anthropic-adapter.ts` — 新增 `sendRaw` 方法

**Interfaces:**
- Produces: `ITextProviderAdapter.sendRaw?(payload: Record<string, any>, config: TextModelConfig): Promise<Record<string, any>>` — 两个 adapter 均实现；Task 2 的 `LLMService.sendRaw` 消费此方法。

- [ ] **Step 1: 扩展 `ITextProviderAdapter` 接口**

在 `src/server/services/llm/types.ts` 的 `ITextProviderAdapter` 接口内（`buildDefaultModel` 之后）追加：

```typescript
  // [AGC:START] tool=Cc author=fangkun
  // 新增(可选): 透传原始请求，返回完整原始响应
  sendRaw?(
    payload: Record<string, any>,
    config: TextModelConfig
  ): Promise<Record<string, any>>;
  // [AGC:END]
```

- [ ] **Step 2: openai-adapter 实现 `sendRaw`**

在 `src/server/services/llm/adapters/openai-adapter.ts` 的 adapter 对象字面量内（`sendImageUnderstandingStream` 之后、`buildDefaultModel` 之前）新增：

```typescript
    // [AGC:START] tool=Cc author=fangkun
    async sendRaw(payload: Record<string, any>, config: TextModelConfig): Promise<Record<string, any>> {
      const client = getClient(config);
      const body = { ...payload, model: payload.model || config.modelId || config.modelMeta.id };
      const response = await client.chat.completions.create(body as any);
      return response as unknown as Record<string, any>;
    },
    // [AGC:END]
```

- [ ] **Step 3: anthropic-adapter 实现 `sendRaw`**

在 `src/server/services/llm/adapters/anthropic-adapter.ts` 的 adapter 对象字面量内（`sendImageUnderstandingStream` 之后、`buildDefaultModel` 之前）新增：

```typescript
    // [AGC:START] tool=Cc author=fangkun
    async sendRaw(payload: Record<string, any>, config: TextModelConfig): Promise<Record<string, any>> {
      const client = getClient(config);
      const body = { ...payload, model: payload.model || config.modelId || config.modelMeta.id };
      const response = await client.messages.create(body as any);
      return response as unknown as Record<string, any>;
    },
    // [AGC:END]
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: 通过（无类型错误；gemini/deepseek adapter 因接口方法可选而无需改动）。

- [ ] **Step 5: Commit**

```bash
git add src/server/services/llm/types.ts src/server/services/llm/adapters/openai-adapter.ts src/server/services/llm/adapters/anthropic-adapter.ts
git commit -m "feat: add sendRaw passthrough to openai/anthropic adapters"
```

---

### Task 2: 后端 — `LLMService.sendRaw` + `POST /llm/raw` 路由

**Files:**
- Modify: `src/server/services/llm/service.ts`
- Modify: `src/server/routes/llm.ts`

**Interfaces:**
- Consumes: Task 1 的 `ITextProviderAdapter.sendRaw?`
- Produces: `LLMService.sendRaw(payload: Record<string, any>, provider: string): Promise<Record<string, any>>`；路由 `POST /api/v1/llm/raw` 接收 `{ modelKey, payload }`。Task 3 的测试消费此路由。

- [ ] **Step 1: `LLMService.sendRaw` 方法**

在 `src/server/services/llm/service.ts` 中 `sendMessageStructured` 方法之后新增：

```typescript
  // [AGC:START] tool=Cc author=fangkun
  async sendRaw(payload: Record<string, any>, provider: string): Promise<Record<string, any>> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    if (!adapter.sendRaw) {
      throw new Error(`Provider "${provider}" does not support raw invocation`);
    }
    return adapter.sendRaw(payload, config);
  }
  // [AGC:END]
```

- [ ] **Step 2: 新增 `POST /llm/raw` 路由**

在 `src/server/routes/llm.ts` 中 `POST /llm/send-stream` 之后、`GET /llm/providers` 之前新增：

```typescript
  // [AGC:START] tool=Cc author=fangkun
  // POST /llm/raw
  router.post('/llm/raw', async (req, res) => {
    try {
      const { modelKey, payload } = req.body;
      if (!modelKey || !payload) {
        res.status(400).json({ success: false, error: { message: 'modelKey and payload are required' } });
        return;
      }
      const data = await llmService.sendRaw(payload, modelKey);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });
  // [AGC:END]
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/server/services/llm/service.ts src/server/routes/llm.ts
git commit -m "feat: add POST /llm/raw route for raw model invocation"
```

---

### Task 3: 后端 — `/llm/raw` 路由单测

**Files:**
- Create: `tests/server/routes/llm-raw.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `registerLLMRoutes`（签名 `(router, llmService, modelManager, registry)`）。
- Produces: 覆盖成功 / 缺参 / 上游异常的 vitest + supertest 用例。

- [ ] **Step 1: 写测试文件**

创建 `tests/server/routes/llm-raw.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerLLMRoutes } from '../../../src/server/routes/llm';
import type { LLMService } from '../../../src/server/services/llm/service';
import type { ModelManager } from '../../../src/server/services/model/manager';
import type { ITextAdapterRegistry } from '../../../src/server/services/llm/types';

function makeMocks(overrides?: { sendRaw?: (payload: any, provider: string) => Promise<any> }) {
  const llmService = {
    sendRaw: vi.fn().mockImplementation(
      overrides?.sendRaw ||
        ((payload: any, _provider: string) => Promise.resolve({ id: 'resp-1', echo: payload }))
    ),
    sendMessage: vi.fn(),
    sendMessageStructured: vi.fn(),
    sendMessageStream: vi.fn(),
    testConnection: vi.fn(),
    fetchModelList: vi.fn(),
  } as unknown as LLMService;
  const modelManager = {} as unknown as ModelManager;
  const registry = { getAllProviders: vi.fn().mockReturnValue([]) } as unknown as ITextAdapterRegistry;
  return { llmService, modelManager, registry };
}

function buildApp(llmService: LLMService, modelManager: ModelManager, registry: ITextAdapterRegistry): express.Express {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerLLMRoutes(router, llmService, modelManager, registry);
  app.use('/api/v1', router);
  return app;
}

describe('LLM Raw Route', () => {
  let app: express.Express;
  let llmService: LLMService;

  beforeEach(() => {
    const mocks = makeMocks();
    llmService = mocks.llmService;
    app = buildApp(mocks.llmService, mocks.modelManager, mocks.registry);
  });

  it('POST /llm/raw returns the raw response', async () => {
    const payload = { messages: [{ role: 'user', content: 'Hi' }], temperature: 0.7 };
    const res = await request(app)
      .post('/api/v1/llm/raw')
      .set('Content-Type', 'application/json')
      .send({ modelKey: 'gpt-4o', payload });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('resp-1');
    expect(llmService.sendRaw).toHaveBeenCalledWith(payload, 'gpt-4o');
  });

  it('POST /llm/raw returns 400 without modelKey', async () => {
    const res = await request(app)
      .post('/api/v1/llm/raw')
      .set('Content-Type', 'application/json')
      .send({ payload: { messages: [] } });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('modelKey');
  });

  it('POST /llm/raw returns 400 without payload', async () => {
    const res = await request(app)
      .post('/api/v1/llm/raw')
      .set('Content-Type', 'application/json')
      .send({ modelKey: 'gpt-4o' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('payload');
  });

  it('POST /llm/raw returns 400 when upstream throws', async () => {
    const mocks = makeMocks({ sendRaw: () => Promise.reject(new Error('API key invalid')) });
    app = buildApp(mocks.llmService, mocks.modelManager, mocks.registry);
    const res = await request(app)
      .post('/api/v1/llm/raw')
      .set('Content-Type', 'application/json')
      .send({ modelKey: 'gpt-4o', payload: { messages: [] } });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('API key invalid');
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npx vitest run tests/server/routes/llm-raw.test.ts`
Expected: 4 个用例全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add tests/server/routes/llm-raw.test.ts
git commit -m "test: add /llm/raw route tests"
```

---

### Task 4: 前端 — prompt store 新增 API Tester 状态与 action

**Files:**
- Modify: `web/src/stores/prompt.ts`

**Interfaces:**
- Produces: store state 字段 `apiTesterPayload` / `apiTesterResponse` / `apiTesterError` / `apiTesterLoading` / `apiTesterDuration` / `apiTesterStatus`；action `sendRawRequest(payloadObj: any): Promise<void>`。Task 5 的 `ApiTester.vue` 消费这些字段。

- [ ] **Step 1: 新增 state 字段**

在 `web/src/stores/prompt.ts` state 的「Template test history」相关字段之后（actions 之前）新增：

```typescript
    // [AGC:START] tool=Cc author=fangkun
    // API Tester state
    apiTesterPayload: '',
    apiTesterResponse: '',
    apiTesterError: '',
    apiTesterLoading: false,
    apiTesterDuration: 0,
    apiTesterStatus: 0,
    // [AGC:END]
```

- [ ] **Step 2: 新增 `sendRawRequest` action**

在 `web/src/stores/prompt.ts` actions 中「Template test history」action 之后新增：

```typescript
    // [AGC:START] tool=Cc author=fangkun
    async sendRawRequest(payloadObj: any) {
      this.apiTesterLoading = true
      this.apiTesterError = ''
      this.apiTesterResponse = ''
      this.apiTesterStatus = 0
      const start = Date.now()
      try {
        const data = await apiPost('/llm/raw', { modelKey: this.selectedModelKey, payload: payloadObj })
        this.apiTesterDuration = Date.now() - start
        this.apiTesterResponse = JSON.stringify(data, null, 2)
        this.apiTesterStatus = 200
      } catch (e: any) {
        this.apiTesterError = e.message
      } finally {
        this.apiTesterLoading = false
      }
    },
    // [AGC:END]
```

- [ ] **Step 3: Commit**

```bash
git add web/src/stores/prompt.ts
git commit -m "feat: add API tester state and send raw action to prompt store"
```

---

### Task 5: 前端 — `ApiTester.vue` 组件

**Files:**
- Create: `web/src/components/ApiTester.vue`

**Interfaces:**
- Consumes: Task 4 的 store 字段与 `sendRawRequest`；`store.enabledModels` / `store.allModels` / `store.selectedModelKey`。
- Produces: 独立可渲染页面组件。Task 6 的 `App.vue` 按 `currentView === 'apiTester'` 渲染它。

- [ ] **Step 1: 创建组件文件**

创建 `web/src/components/ApiTester.vue`（完整文件，第 1 行 AGC:FILE 头）：

```vue
<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-10 -->
<template>
  <div class="api-tester">
    <el-card shadow="never" class="tester-header">
      <div class="header-row">
        <span class="label">{{ t('apiTester.selectModel') }}</span>
        <el-select
          v-model="store.selectedModelKey"
          class="model-select"
          :placeholder="t('apiTester.selectModelPlaceholder')"
          @change="onModelChange"
        >
          <el-option
            v-for="m in store.enabledModels"
            :key="m.id"
            :label="`${m.name} (${m.id})`"
            :value="m.id"
          />
        </el-select>
        <el-tag v-if="selectedProtocol" size="small" type="info">
          {{ t('apiTester.protocol') }}: {{ selectedProtocol }}
        </el-tag>
      </div>
    </el-card>

    <el-row :gutter="16" class="tester-body">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>
            <div class="panel-header">
              <span>{{ t('apiTester.requestPayload') }}</span>
              <div class="panel-actions">
                <el-button size="small" @click="loadExample">{{ t('apiTester.loadExample') }}</el-button>
                <el-button size="small" @click="formatPayload">{{ t('apiTester.format') }}</el-button>
                <el-button size="small" @click="clearPayload">{{ t('apiTester.clear') }}</el-button>
              </div>
            </div>
          </template>
          <el-input
            v-model="payloadText"
            type="textarea"
            :rows="16"
            resize="vertical"
            class="json-editor"
            spellcheck="false"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>
            <div class="panel-header">
              <span>{{ t('apiTester.response') }}</span>
              <div class="panel-actions">
                <el-tag v-if="store.apiTesterStatus" size="small" :type="store.apiTesterStatus >= 400 ? 'danger' : 'success'">
                  HTTP {{ store.apiTesterStatus }}
                </el-tag>
                <el-tag v-if="store.apiTesterDuration" size="small" type="info">
                  {{ t('apiTester.duration') }}: {{ (store.apiTesterDuration / 1000).toFixed(2) }}s
                </el-tag>
                <el-button size="small" :disabled="!store.apiTesterResponse" @click="copyResponse">
                  {{ t('apiTester.copy') }}
                </el-button>
              </div>
            </div>
          </template>
          <div class="response-display">
            <pre v-if="store.apiTesterResponse">{{ store.apiTesterResponse }}</pre>
            <span v-else class="placeholder">{{ t('apiTester.responsePlaceholder') }}</span>
          </div>
          <el-alert v-if="store.apiTesterError" type="error" :title="store.apiTesterError" show-icon closable class="mt-2" />
        </el-card>
      </el-col>
    </el-row>

    <div class="send-bar">
      <el-button
        type="primary"
        :loading="store.apiTesterLoading"
        :disabled="!store.selectedModelKey"
        @click="onSend"
      >
        {{ store.apiTesterLoading ? t('apiTester.sending') : t('apiTester.send') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { usePromptStore } from '../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()

const payloadText = ref('')

const OPENAI_EXAMPLE = JSON.stringify(
  {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ],
    temperature: 0.7,
    max_tokens: 100,
  },
  null,
  2
)

const ANTHROPIC_EXAMPLE = JSON.stringify(
  {
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello!' }],
    max_tokens: 8192,
    temperature: 0.7,
  },
  null,
  2
)

const selectedProtocol = computed(() => {
  const m = store.allModels.find((x) => x.id === store.selectedModelKey)
  if (!m) return ''
  return m.protocol || (m.providerId === 'anthropic' ? 'anthropic' : 'openai')
})

function loadExample() {
  payloadText.value = selectedProtocol.value === 'anthropic' ? ANTHROPIC_EXAMPLE : OPENAI_EXAMPLE
}

function onModelChange() {
  const isEmpty = !payloadText.value.trim()
  const isCurrentExample = payloadText.value === OPENAI_EXAMPLE || payloadText.value === ANTHROPIC_EXAMPLE
  if (isEmpty || isCurrentExample) loadExample()
}

function formatPayload() {
  try {
    payloadText.value = JSON.stringify(JSON.parse(payloadText.value), null, 2)
  } catch {
    ElMessage.error(t('apiTester.invalidJson'))
  }
}

function clearPayload() {
  payloadText.value = ''
  store.apiTesterResponse = ''
  store.apiTesterError = ''
  store.apiTesterDuration = 0
  store.apiTesterStatus = 0
}

async function onSend() {
  let parsed: any
  try {
    parsed = JSON.parse(payloadText.value)
  } catch {
    ElMessage.error(t('apiTester.invalidJson'))
    return
  }
  await store.sendRawRequest(parsed)
}

async function copyResponse() {
  try {
    await navigator.clipboard.writeText(store.apiTesterResponse)
    ElMessage.success(t('apiTester.copied'))
  } catch {
    ElMessage.error(t('apiTester.copyFailed'))
  }
}

onMounted(() => {
  if (!payloadText.value && store.enabledModels.length > 0) loadExample()
})
// [AGC:END]
</script>

<style scoped>
.api-tester { padding: 0; }
.tester-header { margin-bottom: 12px; }
.header-row { display: flex; align-items: center; gap: 12px; }
.label { font-weight: 600; }
.model-select { width: 320px; }
.tester-body { margin-bottom: 12px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; }
.panel-actions { display: flex; align-items: center; gap: 4px; }
.json-editor :deep(textarea) { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; }
.response-display { background: var(--el-fill-color-light); border-radius: 4px; padding: 16px; min-height: 320px; overflow: auto; }
.response-display pre { white-space: pre-wrap; word-break: break-word; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; margin: 0; }
.placeholder { color: var(--el-text-color-placeholder); }
.send-bar { margin-top: 4px; }
.mt-2 { margin-top: 8px; }
</style>
```

- [ ] **Step 2: 确认类型已满足**

`web/src/types/prompt.ts` 的 `TextModelConfig` 已含 `protocol?: 'openai' | 'anthropic'`、`providerId?`、`modelId?`、`name`、`id`（已验证），无需改动。若后续 vue-tsc 报缺字段再补。

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ApiTester.vue web/src/types/prompt.ts
git commit -m "feat: add ApiTester page for swagger-style model invocation"
```

---

### Task 6: 前端 — 导航集成（NavSidebar + App.vue + skills store）

**Files:**
- Modify: `web/src/stores/skills.ts` — `currentView` 类型与 `setView` 支持 `'apiTester'`
- Modify: `web/src/App.vue` — 渲染 `ApiTester`
- Modify: `web/src/components/NavSidebar.vue` — 新增菜单项

**Interfaces:**
- Consumes: Task 5 的 `ApiTester.vue`。
- Produces: 点击侧边栏「API 调用」进入新页面。

- [ ] **Step 1: `skills.ts` 支持新 view**

在 `web/src/stores/skills.ts`：
1. `currentView` 类型联合新增 `'apiTester'`：
```typescript
    currentView: 'list' as 'list' | 'detail' | 'editor' | 'manage' | 'toggle' | 'manager' | 'prompt' | 'promptMaintenance' | 'agent' | 'apiTester',
```
2. `setView` 参数类型新增 `'apiTester'`：
```typescript
    setView(v: 'list' | 'detail' | 'editor' | 'manage' | 'toggle' | 'manager' | 'prompt' | 'promptMaintenance' | 'agent' | 'apiTester') { this.currentView = v },
```

- [ ] **Step 2: `App.vue` 渲染 ApiTester**

在 `web/src/App.vue`：
1. import 区新增：
```typescript
import ApiTester from './components/ApiTester.vue'
```
2. template 新增分支（`agent` 分支之后）：
```html
      <template v-else-if="store.currentView === 'apiTester'"><ApiTester /></template>
```

- [ ] **Step 3: `NavSidebar.vue` 新增菜单项**

在 `web/src/components/NavSidebar.vue`：
1. `@element-plus/icons-vue` import 追加 `Promotion`：
```typescript
import { Document, FolderOpened, EditPen, Setting, Monitor, Switch, Grid, Promotion } from '@element-plus/icons-vue'
```
2. `<el-menu>` 中 `agent` 菜单项之后新增：
```html
      <el-menu-item index="apiTester"><el-icon><Promotion /></el-icon><span>{{ $t('nav.apiTester') }}</span></el-menu-item>
```
3. `activeMenu` computed 中 `agent` 分支之后新增：
```typescript
  if (store.currentView === 'apiTester') return 'apiTester'
```
4. `handleMenuSelect` 中 `agent` 分支之后新增：
```typescript
  } else if (index === 'apiTester') {
    store.setView('apiTester')
```

- [ ] **Step 4: Commit**

```bash
git add web/src/stores/skills.ts web/src/App.vue web/src/components/NavSidebar.vue
git commit -m "feat: add apiTester sidebar navigation entry"
```

---

### Task 7: 前端 — i18n 文案（中英文）

**Files:**
- Modify: `web/src/i18n/locales/zh-CN.json`
- Modify: `web/src/i18n/locales/en.json`

**Interfaces:**
- Consumes: Task 5 的 `t('apiTester.*')` 与 Task 6 的 `$t('nav.apiTester')`。
- Produces: 缺失 key 会触发 vue-i18n 警告并显示 key 名，因此必须补齐。

- [ ] **Step 1: `zh-CN.json` 新增 key**

在 `zh-CN.json` 的 `nav` 对象 `agent` 之后新增 `"apiTester": "API 调用"`；在文件末尾（`agent` 对象之后）新增顶层：

```json
  "apiTester": {
    "selectModel": "模型选择",
    "selectModelPlaceholder": "请选择模型",
    "protocol": "协议",
    "requestPayload": "请求 Payload (JSON)",
    "response": "响应 JSON",
    "responsePlaceholder": "模型返回的原始 JSON 将显示在这里",
    "loadExample": "加载示例",
    "format": "格式化",
    "clear": "清空",
    "send": "发送",
    "sending": "发送中...",
    "duration": "耗时",
    "copy": "复制",
    "copied": "已复制",
    "copyFailed": "复制失败",
    "invalidJson": "请输入合法的 JSON"
  }
```

- [ ] **Step 2: `en.json` 新增 key**

在 `en.json` 的 `nav` 对象 `agent` 之后新增 `"apiTester": "API Tester"`；在文件末尾新增顶层：

```json
  "apiTester": {
    "selectModel": "Model",
    "selectModelPlaceholder": "Select a model",
    "protocol": "Protocol",
    "requestPayload": "Request Payload (JSON)",
    "response": "Response JSON",
    "responsePlaceholder": "The raw JSON response will appear here",
    "loadExample": "Example",
    "format": "Format",
    "clear": "Clear",
    "send": "Send",
    "sending": "Sending...",
    "duration": "Duration",
    "copy": "Copy",
    "copied": "Copied",
    "copyFailed": "Copy failed",
    "invalidJson": "Please enter valid JSON"
  }
```

- [ ] **Step 3: 校验 JSON 语法**

Run: `node -e "JSON.parse(require('fs').readFileSync('web/src/i18n/locales/zh-CN.json','utf8')); JSON.parse(require('fs').readFileSync('web/src/i18n/locales/en.json','utf8')); console.log('ok')"`
Expected: 输出 `ok`。

- [ ] **Step 4: Commit**

```bash
git add web/src/i18n/locales/zh-CN.json web/src/i18n/locales/en.json
git commit -m "feat: add apiTester i18n strings"
```

---

### Task 8: 构建、打包与人工验证

**Files:** 无源码改动（仅验证 + 构建产物）。

- [ ] **Step 1: 后端类型检查**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: 通过。

- [ ] **Step 2: 后端测试**

Run: `npx vitest run`
Expected: 全部用例 PASS（含新增的 `tests/server/routes/llm-raw.test.ts` 4 例）。

- [ ] **Step 3: 前端构建**

Run: `cd web && npm run build`
Expected: `vue-tsc -b && vite build` 成功，产出 `web/dist/`。

- [ ] **Step 4: 浏览器人工验证 golden path**

Run: `npm run web`（启动 `http://127.0.0.1:3010`）。
验证流程：
1. 侧边栏出现「API 调用」入口，点击进入新页面
2. 模型下拉列出已启用模型；选择 Anthropic 协议模型 → 自动加载 Anthropic 风格示例；选择 OpenAI 协议模型 → 自动加载 OpenAI 风格示例
3. 修改 payload，点击「发送」，右侧显示完整原始响应 JSON（含 usage / finish_reason），并显示 HTTP 200 与耗时
4. 输入非法 JSON（如 `{bad`）→ 点发送 → 提示"请输入合法的 JSON"，不发送请求
5. 复制按钮可复制响应；「清空」重置全部状态
6. 中英文切换文案正常

- [ ] **Step 5: 打包产物确认**

Run: `git status --short` 确认 `web/dist/` 构建产物更新；`package.json` 的 `files` 已含 `web/dist/**/*`。若需发布 npm，先与用户确认再执行 `npm publish`（**不要擅自发布**）。

---

## Self-Review

**1. Spec coverage:**
- 后端 sendRaw（openai/anthropic）+ LLMService.sendRaw + `POST /llm/raw` → Task 1、2
- 路由单测 → Task 3
- store 状态 + action → Task 4
- ApiTester.vue（模型下拉 + payload 编辑器 + 完整 JSON 响应 + 复制/耗时 + 协议自适应示例）→ Task 5
- 侧边栏独立入口 → Task 6
- i18n 中英文 → Task 7
- 构建/打包/人工验证 → Task 8
覆盖 spec 全部验收标准。

**2. Placeholder scan:** 每个改动步骤都含完整代码或精确指令，无 TBD/TODO。

**3. Type consistency:**
- `sendRaw(payload, config)`（adapter）与 `sendRaw(payload, provider)`（LLMService）命名一致；`registerLLMRoutes(router, llmService, modelManager, registry)` 与 index.ts 现有调用一致。
- store 字段名 `apiTester*` 在 Task 4 定义、Task 5 消费、Task 7 无类型依赖，一致。
- `currentView` / `setView` 的 `'apiTester'` 在 Task 6 一并修改类型与实现，一致。
