# Protocol Decoupling Design

## Problem

`TextModelConfig.providerId` conflates two concerns: "who provides the model" vs "what protocol to speak". A MaaS proxy (e.g. iFlytek) may serve Anthropic models but speak OpenAI-compatible protocol. Currently, setting `providerId: "anthropic"` forces the Anthropic adapter, which sends requests in Anthropic Messages API format — incompatible with OpenAI-compatible proxies, resulting in 403 errors.

## Decision

Add a `protocol` field to `TextModelConfig` that decouples protocol selection from provider identity. Protocol has only two values: `openai` (OpenAI-compatible) and `anthropic` (Anthropic-compatible). All providers except Anthropic use the OpenAI-compatible protocol with different baseURLs.

## Data Model

### TextModelConfig (backend: `src/server/services/llm/types.ts`)

```typescript
export interface TextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerId?: string;    // Provider identity — for UI display/categorization
  protocol?: 'openai' | 'anthropic';  // NEW: determines which adapter to use
  modelId?: string;
  providerMeta: TextProvider;
  modelMeta: TextModel;
  connectionConfig: { ... };
  paramOverrides?: Record<string, unknown>;
}
```

### TextModelConfig (frontend: `web/src/types/prompt.ts`)

```typescript
protocol?: 'openai' | 'anthropic';
```

## Backend Logic

### resolveProtocol

```typescript
function resolveProtocol(config: TextModelConfig): string {
  if (config.protocol) return config.protocol;
  // Legacy configs without protocol: derive from providerId
  if (config.providerId === 'anthropic') return 'anthropic';
  // All others (openai/gemini/deepseek/maas/custom) → openai-compatible
  return 'openai';
}
```

### LLMService adapter selection

All methods (`sendMessage`, `sendMessageStructured`, `sendMessageStream`, `sendMessageStreamWithTools`, `testConnection`) change from:

```typescript
const adapter = this.registry.getAdapter(config.providerId || provider);
```

to:

```typescript
const protocol = resolveProtocol(config);
const adapter = this.registry.getAdapter(protocol);
```

### TextAdapterRegistry

No changes. All adapters (openai/anthropic/gemini/deepseek) remain registered. Only `openai` and `anthropic` are selected by `resolveProtocol` at runtime. Gemini/DeepSeek adapters are retained but not actively used.

### ModelManager

No changes. It only handles JSON storage.

## Frontend UI

### Protocol options (fixed, two choices)

```typescript
const PROTOCOL_OPTIONS = [
  { value: 'openai', label: 'OpenAI 兼容协议' },
  { value: 'anthropic', label: 'Anthropic 兼容协议' },
]
```

### Provider options (with defaultProtocol)

```typescript
const LLM_PROVIDERS: LLMProvider[] = [
  { id: 'openai', name: 'OpenAI', defaultProtocol: 'openai', ... },
  { id: 'anthropic', name: 'Anthropic', defaultProtocol: 'anthropic', ... },
  { id: 'gemini', name: 'Google Gemini', defaultProtocol: 'openai', ... },
  { id: 'deepseek', name: 'DeepSeek', defaultProtocol: 'openai', ... },
  { id: 'custom', name: '自定义/MaaS', defaultProtocol: 'openai', ... },
]
```

### PROVIDER_DEFAULTS

```typescript
const PROVIDER_DEFAULTS = {
  openai:    { protocol: 'openai',    baseURL: 'https://api.openai.com/v1', modelId: 'gpt-4o' },
  anthropic: { protocol: 'anthropic', baseURL: 'https://api.anthropic.com', modelId: 'claude-sonnet-4-20250514' },
  gemini:    { protocol: 'openai',    baseURL: '', modelId: 'gemini-2.0-flash' },
  deepseek:  { protocol: 'openai',    baseURL: 'https://api.deepseek.com/v1', modelId: 'deepseek-chat' },
  custom:    { protocol: 'openai',    baseURL: '', modelId: '' },
}
```

### ModelsView.vue form changes

- Add independent "Protocol" dropdown (openai/anthropic) separate from "Provider" dropdown
- Add "custom/MaaS" option to provider dropdown
- `onProviderChange` / `onEditProviderChange` auto-fill protocol from `PROVIDER_DEFAULTS`
- User can manually override protocol after auto-fill

### Store changes (prompt.ts)

- `newModel` / `editForm` state: add `protocol` field
- `addModelEntry()` / `saveEditModel()`: write `protocol` into `TextModelConfig`
- Loading existing models: if `config.protocol` is empty, derive display value using same logic as `resolveProtocol`

### LLMProvider type

```typescript
export interface LLMProvider {
  id: string;
  name: string;
  defaultProtocol?: 'openai' | 'anthropic';  // NEW
  // ... existing fields
}
```

## Backward Compatibility

No data migration needed. `resolveProtocol` derives protocol from `providerId` for legacy configs:

| providerId | Derived protocol |
|---|---|
| `anthropic` | `anthropic` |
| `openai` | `openai` |
| `gemini` | `openai` |
| `deepseek` | `openai` |
| `maas` / any other | `openai` |

## Files Changed

| File | Change |
|---|---|
| `src/server/services/llm/types.ts` | Add `protocol` field to `TextModelConfig` |
| `src/server/services/llm/service.ts` | Add `resolveProtocol()`, update all methods to use it |
| `web/src/types/prompt.ts` | Add `protocol` field to `TextModelConfig` |
| `web/src/stores/prompt.ts` | Add `defaultProtocol` to providers, add `custom` provider, add `protocol` to form state, write `protocol` on save |
| `web/src/components/prompt/ModelsView.vue` | Add protocol dropdown, add custom provider option, update change handlers |
| `web/src/i18n/locales/en.json` | Add protocol-related i18n keys |
| `web/src/i18n/locales/zh-CN.json` | Add protocol-related i18n keys |

## Files NOT Changed

- `ModelManager` — JSON storage only
- `TextAdapterRegistry` — adapter registration unchanged
- Individual adapter files — internal logic unchanged
- `TemplateTestPanel.vue` — only selects model, no protocol config
