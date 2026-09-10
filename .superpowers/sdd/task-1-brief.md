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

