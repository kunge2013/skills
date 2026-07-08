# Protocol Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use kunge2013:subagent-driven-development (recommended) or kunge2013:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple protocol selection from provider identity in TextModelConfig, allowing MaaS proxies to use OpenAI-compatible protocol regardless of provider name.

**Architecture:** Add a `protocol` field (`'openai' | 'anthropic'`) to `TextModelConfig`. Backend `LLMService` uses `resolveProtocol()` to select adapter instead of `providerId`. Frontend adds a separate protocol dropdown alongside the existing provider dropdown, with auto-fill defaults.

**Tech Stack:** TypeScript, Vue 3, Pinia, Element Plus, vue-i18n

---

### Task 1: Backend — Add `protocol` field to `TextModelConfig` type

**Files:**
- Modify: `src/server/services/llm/types.ts:44-62`

- [ ] **Step 1: Add `protocol` field to `TextModelConfig`**

In `src/server/services/llm/types.ts`, add the `protocol` field after `providerId`:

```typescript
export interface TextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  activationState?: {
    userConfigured?: boolean;
    autoEnabledBy?: string;
  };
  providerId?: string;
  protocol?: 'openai' | 'anthropic';  // NEW: determines which adapter to use
  modelId?: string;
  providerMeta: TextProvider;
  modelMeta: TextModel;
  connectionConfig: {
    apiKey?: string;
    baseURL?: string;
    [key: string]: any;
  };
  paramOverrides?: Record<string, unknown>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/server/services/llm/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/server/services/llm/types.ts
git commit -m "feat: add protocol field to TextModelConfig type"
```

---

### Task 2: Backend — Add `resolveProtocol` and update `LLMService`

**Files:**
- Modify: `src/server/services/llm/service.ts:1-81`

- [ ] **Step 1: Add `resolveProtocol` function and update all methods**

Replace the entire `src/server/services/llm/service.ts` with:

```typescript
import {
  ILLMService,
  ITextAdapterRegistry,
  Message,
  StreamHandlers,
  LLMResponse,
  ToolDefinition,
  ModelInfo,
  ModelOption,
  TextModelConfig,
} from './types';

export interface IModelManager {
  getModel(key: string): Promise<TextModelConfig | undefined>;
  getAllModels(): Promise<TextModelConfig[]>;
  getEnabledModels(): Promise<TextModelConfig[]>;
}

function resolveProtocol(config: TextModelConfig): string {
  if (config.protocol) return config.protocol;
  // Legacy configs without protocol: derive from providerId
  if (config.providerId === 'anthropic') return 'anthropic';
  // All others (openai/gemini/deepseek/maas/custom) → openai-compatible
  return 'openai';
}

export class LLMService implements ILLMService {
  constructor(
    private registry: ITextAdapterRegistry,
    private modelManager: IModelManager,
  ) {}

  private async getModelConfig(provider: string): Promise<TextModelConfig> {
    const model = await this.modelManager.getModel(provider);
    if (!model) {
      throw new Error(`Model config not found for provider: "${provider}"`);
    }
    return model;
  }

  async sendMessage(messages: Message[], provider: string): Promise<string> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    const response = await adapter.sendMessage(messages, config);
    return response.content;
  }

  async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    return adapter.sendMessage(messages, config);
  }

  async sendMessageStream(messages: Message[], provider: string, callbacks: StreamHandlers): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    await adapter.sendMessageStream(messages, config, callbacks);
  }

  async sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);
    await adapter.sendMessageStreamWithTools(messages, config, tools, callbacks);
  }

  async testConnection(provider: string): Promise<void> {
    const config = await this.getModelConfig(provider);
    const protocol = resolveProtocol(config);
    const adapter = this.registry.getAdapter(protocol);

    await adapter.sendMessage(
      [{ role: 'user', content: 'Hello, this is a connection test.' }],
      config
    );
  }

  async fetchModelList(provider: string, customConfig?: Partial<TextModelConfig>): Promise<ModelOption[]> {
    const adapter = this.registry.getAdapter(provider);
    const models = await this.registry.getModels(
      provider,
      customConfig as TextModelConfig | undefined
    );
    return models.map(m => ({ value: m.id, label: m.name }));
  }
}

export interface IModelManager {
  getModel(key: string): Promise<TextModelConfig | undefined>;
  getAllModels(): Promise<TextModelConfig[]>;
  getEnabledModels(): Promise<TextModelConfig[]>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/server/services/llm/service.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/server/services/llm/service.ts
git commit -m "feat: add resolveProtocol and update LLMService to use protocol for adapter selection"
```

---

### Task 3: Frontend — Add `protocol` to types and `LLMProvider`

**Files:**
- Modify: `web/src/types/prompt.ts:1-11,45-53`

- [ ] **Step 1: Add `protocol` to `TextModelConfig` and `defaultProtocol` to `LLMProvider`**

In `web/src/types/prompt.ts`, update both interfaces:

```typescript
export interface TextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerId?: string;
  protocol?: 'openai' | 'anthropic';  // NEW
  modelId?: string;
  providerMeta: any;
  modelMeta: any;
  connectionConfig: Record<string, any>;
  paramOverrides?: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface PromptRecord {
  id: string;
  originalContent: string;
  optimizedContent: string;
  templateId: string;
  modelKey: string;
  optimizationMode: 'system' | 'user';
  createdAt: number;
  iterationCount: number;
  parentIds: string[];
}

// [AGC:START] tool=Cc author=fangkun
export interface Template {
  id: string;
  name: string;
  description?: string;
  type: string;
  templateType: 'simple' | 'advanced';
  content: { system: string; user?: string };
  category?: string;

  // 系统变量列表,测试时自动填充或隐藏
  systemVariables?: string[];
}
// [AGC:END]

export interface LLMProvider {
  id: string;
  name: string;
  corsRestricted?: boolean;
  requiresApiKey?: boolean;
  defaultBaseURL?: string;
  supportsDynamicModels?: boolean;
  apiKeyUrl?: string;
  defaultProtocol?: 'openai' | 'anthropic';  // NEW
}

// [AGC:START] tool=Cc author=fangkun
export interface TemplateTestRecord {
  id: string;
  templateId: string;
  templateName: string;

  // 用户输入的变量值
  variables: Record<string, string>;

  // 替换后的提示词
  processedSystemPrompt: string;
  processedUserPrompt: string;

  // 模型信息
  modelKey: string;
  modelInfo: {
    id: string;
    name: string;
    providerId: string;
  };

  // 测试结果
  output: string;
  timestamp: number;
  duration?: number;  // 毫秒
}
// [AGC:END]
```

- [ ] **Step 2: Commit**

```bash
git add web/src/types/prompt.ts
git commit -m "feat: add protocol field to frontend TextModelConfig and LLMProvider types"
```

---

### Task 4: Frontend — Update store (`prompt.ts`)

**Files:**
- Modify: `web/src/stores/prompt.ts:11-16,149-156,187-209,235-268`

- [ ] **Step 1: Update `LLM_PROVIDERS` with `defaultProtocol` and add `custom` provider**

Replace lines 11-16 in `web/src/stores/prompt.ts`:

```typescript
const LLM_PROVIDERS: LLMProvider[] = [
  { id: 'openai', name: 'OpenAI', requiresApiKey: true, defaultBaseURL: 'https://api.openai.com/v1', supportsDynamicModels: false, defaultProtocol: 'openai' },
  { id: 'anthropic', name: 'Anthropic', requiresApiKey: true, defaultBaseURL: 'https://api.anthropic.com', supportsDynamicModels: false, apiKeyUrl: 'https://console.anthropic.com/settings/keys', defaultProtocol: 'anthropic' },
  { id: 'gemini', name: 'Google Gemini', requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false, apiKeyUrl: 'https://aistudio.google.com/app/apikey', defaultProtocol: 'openai' },
  { id: 'deepseek', name: 'DeepSeek', requiresApiKey: true, defaultBaseURL: 'https://api.deepseek.com/v1', supportsDynamicModels: false, apiKeyUrl: 'https://platform.deepseek.com/api_keys', defaultProtocol: 'openai' },
  { id: 'custom', name: '自定义/MaaS', requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false, defaultProtocol: 'openai' },
]
```

- [ ] **Step 2: Add `protocol` to `newModel` and `editForm` state**

Replace lines 149-156 in `web/src/stores/prompt.ts`:

```typescript
    newModel: {
      id: '', name: '', providerId: '', protocol: 'openai' as 'openai' | 'anthropic', modelId: '', apiKey: '', baseURL: '',
    },
    // Edit state
    editingModelId: null as string | null,
    editForm: {
      id: '', name: '', providerId: '', protocol: 'openai' as 'openai' | 'anthropic', modelId: '', apiKey: '', baseURL: '',
    },
```

- [ ] **Step 3: Update `addModelEntry()` to include `protocol`**

Replace lines 187-209 in `web/src/stores/prompt.ts`:

```typescript
    async addModelEntry() {
      try {
        const config: TextModelConfig = {
          id: this.newModel.id,
          name: this.newModel.name,
          enabled: true,
          providerId: this.newModel.providerId,
          protocol: this.newModel.protocol,
          modelId: this.newModel.modelId,
          providerMeta: { id: this.newModel.providerId, name: this.newModel.providerId, requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false },
          modelMeta: { id: this.newModel.modelId, name: this.newModel.name, providerId: this.newModel.providerId, capabilities: { supportsTools: true, maxContextLength: 128000 }, parameterDefinitions: [] },
          connectionConfig: {
            apiKey: this.newModel.apiKey,
            baseURL: this.newModel.baseURL || undefined,
          },
        }
        await apiPost('/models', { key: this.newModel.id, config })
        this.newModel = { id: '', name: '', providerId: '', protocol: 'openai', modelId: '', apiKey: '', baseURL: '' }
        this.showAddModel = false
        await this.loadModels()
      } catch (e: any) {
        alert(e.message)
      }
    },
```

- [ ] **Step 4: Update `startEditModel()` to load `protocol`**

Replace lines 235-246 in `web/src/stores/prompt.ts`:

```typescript
    startEditModel(model: TextModelConfig) {
      this.editingModelId = model.id
      // Derive protocol from config or providerId for legacy configs
      const derivedProtocol = model.protocol || (model.providerId === 'anthropic' ? 'anthropic' : 'openai')
      this.editForm = {
        id: model.id,
        name: model.name,
        providerId: model.providerId || '',
        protocol: derivedProtocol as 'openai' | 'anthropic',
        modelId: model.modelId || '',
        apiKey: '',
        baseURL: model.connectionConfig?.baseURL || '',
      }
      this.showAddModel = false
    },
```

- [ ] **Step 5: Update `cancelEditModel()` to include `protocol`**

Replace line 249 in `web/src/stores/prompt.ts`:

```typescript
      this.editForm = { id: '', name: '', providerId: '', protocol: 'openai', modelId: '', apiKey: '', baseURL: '' }
```

- [ ] **Step 6: Update `saveEditModel()` to include `protocol`**

Replace lines 251-268 in `web/src/stores/prompt.ts`:

```typescript
    async saveEditModel() {
      if (!this.editingModelId) return
      const updates: TextModelConfig = {
        id: this.editForm.id,
        name: this.editForm.name,
        enabled: true,
        providerId: this.editForm.providerId,
        protocol: this.editForm.protocol,
        modelId: this.editForm.modelId,
        providerMeta: { id: this.editForm.providerId, name: this.editForm.providerId, requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false },
        modelMeta: { id: this.editForm.modelId, name: this.editForm.name, providerId: this.editForm.providerId, capabilities: { supportsTools: true, maxContextLength: 128000 }, parameterDefinitions: [] },
        connectionConfig: {
          apiKey: this.editForm.apiKey || undefined,
          baseURL: this.editForm.baseURL || undefined,
        },
      }
      await this.updateModel(this.editingModelId, updates)
      this.cancelEditModel()
    },
```

- [ ] **Step 7: Commit**

```bash
git add web/src/stores/prompt.ts
git commit -m "feat: update prompt store with protocol field and custom provider"
```

---

### Task 5: Frontend — Update `ModelsView.vue` UI

**Files:**
- Modify: `web/src/components/prompt/ModelsView.vue:1-154`

- [ ] **Step 1: Update template — add protocol dropdown and provider rename**

Replace the entire `<template>` section (lines 1-98) with:

```html
<template>
  <div class="models-view">
    <div class="models-header">
      <h2>{{ t('prompt.modelsTitle') }}</h2>
      <el-button @click="onAddModelToggle">
        {{ store.showAddModel ? t('prompt.cancel') : t('prompt.addModel') }}
      </el-button>
    </div>

    <el-card v-if="store.showAddModel" shadow="never" class="add-model-form">
      <el-form label-position="top">
        <el-form-item :label="t('prompt.modelKey')">
          <el-input v-model="store.newModel.id" />
        </el-form-item>
        <el-form-item :label="t('prompt.displayName')">
          <el-input v-model="store.newModel.name" />
        </el-form-item>
        <el-form-item :label="t('prompt.selectProvider')">
          <el-select v-model="store.newModel.providerId" @change="onProviderChange">
            <el-option label="" value="" />
            <el-option
              v-for="p in store.llmProviders"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('prompt.selectProtocol')">
          <el-select v-model="store.newModel.protocol">
            <el-option
              v-for="opt in PROTOCOL_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('prompt.modelId')">
          <el-input v-model="store.newModel.modelId" />
        </el-form-item>
        <el-form-item :label="t('prompt.apiKey')">
          <el-input v-model="store.newModel.apiKey" type="password" show-password />
        </el-form-item>
        <el-form-item :label="t('prompt.baseURL')">
          <el-input v-model="store.newModel.baseURL" />
        </el-form-item>
        <el-button type="primary" @click="store.addModelEntry()">{{ t('prompt.saveModel') }}</el-button>
      </el-form>
    </el-card>

    <div class="models-list">
      <el-card v-for="model in store.allModels" :key="model.id" shadow="never" class="model-card">
        <div class="model-info">
          <span class="model-name">{{ model.name }}</span>
          <span class="model-id">{{ model.id }}</span>
        </div>
        <div class="model-actions">
          <el-switch
            :model-value="model.enabled"
            @change="() => store.toggleModel(model)"
            :active-text="t('prompt.enabled')"
            :inactive-text="t('prompt.disabled')"
          />
          <el-button size="small" @click="store.startEditModel(model)">
            {{ t('prompt.edit') }}
          </el-button>
          <el-button type="danger" size="small" @click="store.deleteModel(model.id)">{{ t('prompt.delete') }}</el-button>
        </div>

        <el-form v-if="store.editingModelId === model.id" label-position="top" class="edit-form">
          <el-form-item :label="t('prompt.modelKey')">
            <el-input :model-value="model.id" disabled />
          </el-form-item>
          <el-form-item :label="t('prompt.displayName')">
            <el-input v-model="store.editForm.name" />
          </el-form-item>
          <el-form-item :label="t('prompt.selectProvider')">
            <el-select v-model="store.editForm.providerId" @change="onEditProviderChange">
              <el-option label="" value="" />
              <el-option
                v-for="p in store.llmProviders"
                :key="p.id"
                :label="p.name"
                :value="p.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('prompt.selectProtocol')">
            <el-select v-model="store.editForm.protocol">
              <el-option
                v-for="opt in PROTOCOL_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('prompt.modelId')">
            <el-input v-model="store.editForm.modelId" />
          </el-form-item>
          <el-form-item :label="t('prompt.apiKey')">
            <el-input v-model="store.editForm.apiKey" type="password" show-password :placeholder="t('prompt.apiKeyLeaveBlank')" />
          </el-form-item>
          <el-form-item :label="t('prompt.baseURL')">
            <el-input v-model="store.editForm.baseURL" />
          </el-form-item>
          <div class="edit-actions">
            <el-button type="primary" @click="onSaveEdit">{{ t('prompt.save') }}</el-button>
            <el-button @click="store.cancelEditModel()">{{ t('prompt.cancel') }}</el-button>
          </div>
        </el-form>
      </el-card>
    </div>

    <el-empty v-if="store.allModels.length === 0" :description="t('prompt.emptyModels')" />
  </div>
</template>
```

- [ ] **Step 2: Update script — add PROTOCOL_OPTIONS and update PROVIDER_DEFAULTS and handlers**

Replace the entire `<script setup lang="ts">` section (lines 100-141) with:

```typescript
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePromptStore } from '../../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()

const PROTOCOL_OPTIONS = [
  { value: 'openai', label: 'OpenAI 兼容协议' },
  { value: 'anthropic', label: 'Anthropic 兼容协议' },
]

const PROVIDER_DEFAULTS: Record<string, { protocol: 'openai' | 'anthropic'; baseURL: string; modelId: string }> = {
  openai: { protocol: 'openai', baseURL: 'https://api.openai.com/v1', modelId: 'gpt-4o' },
  anthropic: { protocol: 'anthropic', baseURL: 'https://api.anthropic.com', modelId: 'claude-sonnet-4-20250514' },
  gemini: { protocol: 'openai', baseURL: '', modelId: 'gemini-2.0-flash' },
  deepseek: { protocol: 'openai', baseURL: 'https://api.deepseek.com/v1', modelId: 'deepseek-chat' },
  custom: { protocol: 'openai', baseURL: '', modelId: '' },
}

function onProviderChange() {
  const pId = store.newModel.providerId
  const defaults = PROVIDER_DEFAULTS[pId]
  if (defaults) {
    store.newModel.protocol = defaults.protocol
    store.newModel.baseURL = defaults.baseURL
    store.newModel.modelId = defaults.modelId
  }
}

function onEditProviderChange() {
  const pId = store.editForm.providerId
  const defaults = PROVIDER_DEFAULTS[pId]
  if (defaults) {
    store.editForm.protocol = defaults.protocol
    if (!store.editForm.baseURL) store.editForm.baseURL = defaults.baseURL
    if (!store.editForm.modelId) store.editForm.modelId = defaults.modelId
  }
}

function onAddModelToggle() {
  store.cancelEditModel()
  store.showAddModel = !store.showAddModel
}

async function onSaveEdit() {
  if (!store.editForm.name || !store.editForm.modelId) {
    alert(t('prompt.editModelValidation'))
    return
  }
  await store.saveEditModel()
}
</script>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/prompt/ModelsView.vue
git commit -m "feat: add protocol dropdown and provider/protocol separation in model config UI"
```

---

### Task 6: Frontend — Add i18n keys

**Files:**
- Modify: `web/src/i18n/locales/zh-CN.json:173`
- Modify: `web/src/i18n/locales/en.json:173`

- [ ] **Step 1: Add `selectProvider` key to zh-CN.json**

In `web/src/i18n/locales/zh-CN.json`, change line 173 and add a new key after it:

```json
    "selectProvider": "选择供应商",
    "selectProtocol": "选择协议",
```

(Replace the existing `"selectProtocol": "选择协议"` line — it stays the same, but we add `"selectProvider"` before it.)

- [ ] **Step 2: Add `selectProvider` key to en.json**

In `web/src/i18n/locales/en.json`, change line 173 and add a new key after it:

```json
    "selectProvider": "Select Provider",
    "selectProtocol": "Select Protocol",
```

- [ ] **Step 3: Commit**

```bash
git add web/src/i18n/locales/zh-CN.json web/src/i18n/locales/en.json
git commit -m "feat: add selectProvider i18n key for protocol decoupling"
```

---

### Task 7: Verify end-to-end

- [ ] **Step 1: Build the backend**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 2: Build the frontend**

Run: `cd web && npx vue-tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Start the server and test in browser**

Run: `npm run dev`
Expected: Server starts, UI loads, model config page shows both "供应商" and "协议" dropdowns

- [ ] **Step 4: Test backward compatibility**

1. Check that existing models (without `protocol` field) still work
2. Edit an existing model — verify `protocol` should be auto-derived from `providerId`
3. Add a new model with provider "自定义/MaaS" and protocol "OpenAI 兼容协议" — verify it saves with `protocol: "openai"`

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
