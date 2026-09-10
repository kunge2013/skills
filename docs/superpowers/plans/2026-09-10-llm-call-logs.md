<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-10 -->

# LLM 调用日志记录与查询 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 记录所有 LLM 调用(请求报文、响应报文、模型参数、耗时、状态)到按日轮转的 JSONL 文件,并通过 REST API 与前端页面查询。

**Architecture:** 在 `LLMService` 层统一采集 —— 新建 `LLMCallLogger`(追加写 JSONL,异步串行队列,失败不影响主流程)注入 `LLMService` 包裹各方法;新建 `LLMCallLogQuery` 读取/过滤/分页;新增 REST 路由与前端「调用日志」页面。JSON 高亮复用 ApiTester 逻辑,抽到共享工具 `web/src/utils/jsonHighlight.ts`。

**Tech Stack:** Express + TypeScript(服务端),Vue 3 + Pinia + Element Plus + vue-i18n(前端),Vitest + supertest(测试),JSONL 文件存储。

## Global Constraints

- 日志写盘失败只 `console.warn`,绝不能影响 LLM 调用结果或抛错
- 记录按用户确认**原样全录**;服务端 API key 存在模型配置,不进请求 payload
- 模型参数 `modelParams` = `{ modelId, ...paramOverrides }`,从 `TextModelConfig` 推导
- `modelKey` 取 `config.id`(如 `openai-gpt4o`)
- 流式调用在完成后一次性写入完整记录(包裹回调累计),不实时追加
- 单个损坏 JSONL 行跳过,不中断整体查询
- 新代码遵循仓库 AGC 标注约定:`[AGC:START] tool=Cc author=fangkun` / `[AGC:END]`,新文件首行 `[AGC:FILE] tool=Cc author=fangkun date=YYYY-MM-DD`
- 测试命令:`npx vitest run tests/...`;前端构建:`cd web && npm run build`

---

### Task 1: LLMCallLogger 与日志类型(后端核心)

**Files:**
- Create: `src/server/services/llm-call/types.ts`
- Create: `src/server/services/llm-call/logger.ts`
- Test: `tests/server/services/llm-call-logger.test.ts`

**Interfaces:**
- Produces:
  - `type LLMCallSource = 'apiTester' | 'prompt' | 'stream' | 'test-connection'`
  - `interface LLMCallLogRecord { id: string; timestamp: number; durationMs: number; source: LLMCallSource; modelKey: string; protocol: 'openai' | 'anthropic'; modelParams: Record<string, unknown>; request: Record<string, unknown>; response: Record<string, unknown> | null; status: number; error: string | null }`
  - `interface LLMCallStart { source: LLMCallSource; modelKey: string; protocol: 'openai' | 'anthropic'; modelParams: Record<string, unknown>; request: Record<string, unknown> }`
  - `interface LLMCallHandle { complete(result: { response?: unknown; status: number; error?: string }): void }`
  - `class LLMCallLogger { constructor(logDir: string); start(init: LLMCallStart): LLMCallHandle }`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/server/services/llm-call-logger.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LLMCallLogger } from '../../../src/server/services/llm-call/logger';

function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('LLMCallLogger', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-log-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('writes one complete JSONL record on complete()', () => {
    const logger = new LLMCallLogger(dir);
    const handle = logger.start({
      source: 'apiTester', modelKey: 'openai-gpt4o', protocol: 'openai',
      modelParams: { modelId: 'gpt-4o', temperature: 0.7 },
      request: { messages: [{ role: 'user', content: 'Hi' }] },
    });
    handle.complete({ response: { id: 'resp-1' }, status: 200 });

    // flush is synchronous via queue chain; give one microtask tick
    const file = path.join(dir, `${dateStr(new Date())}.jsonl`);
    expect(fs.existsSync(file)).toBe(true);
    const line = fs.readFileSync(file, 'utf-8').trim();
    const rec = JSON.parse(line);
    expect(rec.id).toBeTruthy();
    expect(rec.modelKey).toBe('openai-gpt4o');
    expect(rec.protocol).toBe('openai');
    expect(rec.source).toBe('apiTester');
    expect(rec.modelParams).toEqual({ modelId: 'gpt-4o', temperature: 0.7 });
    expect(rec.request.messages[0].content).toBe('Hi');
    expect(rec.response.id).toBe('resp-1');
    expect(rec.status).toBe(200);
    expect(rec.error).toBeNull();
    expect(rec.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof rec.timestamp).toBe('number');
  });

  it('records error and keeps response null when complete with error', () => {
    const logger = new LLMCallLogger(dir);
    const handle = logger.start({
      source: 'prompt', modelKey: 'anthropic-sonnet', protocol: 'anthropic',
      modelParams: { modelId: 'claude-sonnet-4-20250514' },
      request: { messages: [] },
    });
    handle.complete({ status: 500, error: 'boom' });
    const file = path.join(dir, `${dateStr(new Date())}.jsonl`);
    const rec = JSON.parse(fs.readFileSync(file, 'utf-8').trim());
    expect(rec.status).toBe(500);
    expect(rec.error).toBe('boom');
    expect(rec.response).toBeNull();
  });

  it('does not throw when writing fails (appendFile error swallowed)', () => {
    const logger = new LLMCallLogger(dir);
    // make the target file an existing directory so appendFile fails (EISDIR)
    const file = path.join(dir, `${dateStr(new Date())}.jsonl`);
    fs.mkdirSync(file);
    const handle = logger.start({
      source: 'test-connection', modelKey: 'openai-gpt4o', protocol: 'openai',
      modelParams: {}, request: {},
    });
    expect(() => handle.complete({ status: 200 })).not.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/server/services/llm-call-logger.test.ts`
Expected: FAIL — "Cannot find module" / "LLMCallLogger is not a constructor"

- [ ] **Step 3: 实现 types.ts**

```typescript
// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// src/server/services/llm-call/types.ts

export type LLMCallSource = 'apiTester' | 'prompt' | 'stream' | 'test-connection';

export interface LLMCallLogRecord {
  id: string;
  timestamp: number;
  durationMs: number;
  source: LLMCallSource;
  modelKey: string;
  protocol: 'openai' | 'anthropic';
  modelParams: Record<string, unknown>;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  status: number;
  error: string | null;
}
```

- [ ] **Step 4: 实现 logger.ts**

```typescript
// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// src/server/services/llm-call/logger.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LLMCallLogRecord, LLMCallSource } from './types';

export interface LLMCallStart {
  source: LLMCallSource;
  modelKey: string;
  protocol: 'openai' | 'anthropic';
  modelParams: Record<string, unknown>;
  request: Record<string, unknown>;
}

export interface LLMCallHandle {
  complete(result: { response?: unknown; status: number; error?: string }): void;
}

// [AGC:START] tool=Cc author=fangkun
export class LLMCallLogger {
  private queue: Promise<void> = Promise.resolve();

  constructor(private logDir: string) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Serialize appends so concurrent calls never interleave mid-line.
  private enqueue(fn: () => Promise<void>): void {
    this.queue = this.queue.then(fn).catch((err: Error) => {
      console.warn(`[LLMCallLogger] write failed: ${err.message}`);
    });
  }

  private dateFile(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return path.join(this.logDir, `${y}-${m}-${day}.jsonl`);
  }

  start(init: LLMCallStart): LLMCallHandle {
    const startedAt = Date.now();
    const record: LLMCallLogRecord = {
      id: uuidv4(),
      timestamp: startedAt,
      durationMs: 0,
      source: init.source,
      modelKey: init.modelKey,
      protocol: init.protocol,
      modelParams: init.modelParams,
      request: init.request,
      response: null,
      status: 0,
      error: null,
    };
    return {
      complete: (result: { response?: unknown; status: number; error?: string }) => {
        record.durationMs = Date.now() - startedAt;
        record.response = result.response !== undefined ? (result.response as Record<string, unknown>) : null;
        record.status = result.status;
        record.error = result.error ?? null;
        this.enqueue(() =>
          fs.promises.appendFile(this.dateFile(new Date()), JSON.stringify(record) + '\n', 'utf-8'),
        );
      },
    };
  }
}
// [AGC:END]
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/server/services/llm-call-logger.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 提交**

```bash
git add src/server/services/llm-call/types.ts src/server/services/llm-call/logger.ts tests/server/services/llm-call-logger.test.ts
git commit -m "feat: add LLMCallLogger writing JSONL call logs"
```

---

### Task 2: LLMCallLogQuery 查询(后端)

**Files:**
- Create: `src/server/services/llm-call/query.ts`
- Test: `tests/server/services/llm-call-query.test.ts`

**Interfaces:**
- Consumes: `LLMCallLogRecord` from Task 1.
- Produces:
  - `interface LLMCallLogFilter { from?: number; to?: number; modelKey?: string; source?: string; status?: number }`
  - `interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number }`
  - `class LLMCallLogQuery { constructor(logDir: string); list(filter: LLMCallLogFilter, page?: number, pageSize?: number): Promise<Paginated<LLMCallLogRecord>>; getById(id: string): Promise<LLMCallLogRecord | null>; deleteRange(from: number, to: number): Promise<number> }`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/server/services/llm-call-query.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LLMCallLogQuery } from '../../../src/server/services/llm-call/query';
import { LLMCallLogRecord } from '../../../src/server/services/llm-call/types';

const day = 86400000;

function makeRecord(partial: Partial<LLMCallLogRecord>): LLMCallLogRecord {
  return {
    id: 'r1', timestamp: Date.now(), durationMs: 100, source: 'apiTester',
    modelKey: 'openai-gpt4o', protocol: 'openai', modelParams: {},
    request: { messages: [] }, response: null, status: 200, error: null,
    ...partial,
  };
}

describe('LLMCallLogQuery', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-query-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('returns empty list when dir has no logs', async () => {
    const q = new LLMCallLogQuery(dir);
    const result = await q.list({});
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('filters by modelKey/source/status and sorts desc', async () => {
    const t = Date.now();
    fs.writeFileSync(path.join(dir, '2026-09-10.jsonl'), [
      JSON.stringify(makeRecord({ id: 'a', timestamp: t, source: 'prompt', modelKey: 'openai-gpt4o', status: 200 })),
      JSON.stringify(makeRecord({ id: 'b', timestamp: t - 1000, source: 'apiTester', modelKey: 'openai-gpt4o', status: 500, error: 'x' })),
      JSON.stringify(makeRecord({ id: 'c', timestamp: t - 2000, source: 'prompt', modelKey: 'anthropic-sonnet', status: 200 })),
    ].join('\n') + '\n');
    const q = new LLMCallLogQuery(dir);

    const all = await q.list({});
    expect(all.total).toBe(3);
    expect(all.items.map(i => i.id)).toEqual(['a', 'b', 'c']); // desc

    const filtered = await q.list({ source: 'prompt' });
    expect(filtered.items.map(i => i.id)).toEqual(['a', 'c']);

    const byStatus = await q.list({ status: 200 });
    expect(byStatus.items.map(i => i.id)).toEqual(['a', 'c']);

    const byModel = await q.list({ modelKey: 'openai-gpt4o' });
    expect(byModel.items.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('filters by time range and paginates', async () => {
    const t = Date.now();
    fs.writeFileSync(path.join(dir, '2026-09-10.jsonl'), [
      JSON.stringify(makeRecord({ id: 'a', timestamp: t })),
      JSON.stringify(makeRecord({ id: 'b', timestamp: t - day })),
      JSON.stringify(makeRecord({ id: 'c', timestamp: t - day * 2 })),
    ].join('\n') + '\n');
    const q = new LLMCallLogQuery(dir);

    const recent = await q.list({ from: t - day - 1000 });
    expect(recent.items.map(i => i.id)).toEqual(['a', 'b']);

    const page1 = await q.list({}, 1, 2);
    expect(page1.items.map(i => i.id)).toEqual(['a', 'b']);
    expect(page1.total).toBe(3);

    const page2 = await q.list({}, 2, 2);
    expect(page2.items.map(i => i.id)).toEqual(['c']);
  });

  it('skips corrupted lines', async () => {
    fs.writeFileSync(path.join(dir, '2026-09-10.jsonl'),
      JSON.stringify(makeRecord({ id: 'ok' })) + '\nNOT_JSON\n' + JSON.stringify(makeRecord({ id: 'ok2' })) + '\n');
    const q = new LLMCallLogQuery(dir);
    const result = await q.list({});
    expect(result.total).toBe(2);
  });

  it('getById finds record and returns null when missing', async () => {
    fs.writeFileSync(path.join(dir, '2026-09-10.jsonl'),
      JSON.stringify(makeRecord({ id: 'find-me' })) + '\n');
    const q = new LLMCallLogQuery(dir);
    expect((await q.getById('find-me'))?.id).toBe('find-me');
    expect(await q.getById('nope')).toBeNull();
  });

  it('deleteRange removes files whose date is within range', async () => {
    fs.writeFileSync(path.join(dir, '2026-09-09.jsonl'), '{}x\n');
    fs.writeFileSync(path.join(dir, '2026-09-10.jsonl'), '{}x\n');
    fs.writeFileSync(path.join(dir, '2026-09-11.jsonl'), '{}x\n');
    const q = new LLMCallLogQuery(dir);
    const from = new Date(2026, 8, 10).getTime();
    const to = new Date(2026, 8, 10, 23, 59, 59).getTime();
    const deleted = await q.deleteRange(from, to);
    expect(deleted).toBe(1);
    expect(fs.existsSync(path.join(dir, '2026-09-10.jsonl'))).toBe(false);
    expect(fs.existsSync(path.join(dir, '2026-09-09.jsonl'))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/server/services/llm-call-query.test.ts`
Expected: FAIL — "Cannot find module" / "LLMCallLogQuery is not a constructor"

- [ ] **Step 3: 实现 query.ts**

```typescript
// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// src/server/services/llm-call/query.ts
import fs from 'fs';
import path from 'path';
import { LLMCallLogRecord } from './types';

export interface LLMCallLogFilter {
  from?: number;
  to?: number;
  modelKey?: string;
  source?: string;
  status?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// [AGC:START] tool=Cc author=fangkun
export class LLMCallLogQuery {
  constructor(private logDir: string) {}

  private readAll(filter: LLMCallLogFilter): LLMCallLogRecord[] {
    if (!fs.existsSync(this.logDir)) return [];
    const files = fs.readdirSync(this.logDir).filter(f => f.endsWith('.jsonl'));
    const records: LLMCallLogRecord[] = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.logDir, file), 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const rec = JSON.parse(line) as LLMCallLogRecord;
          if (filter.from !== undefined && rec.timestamp < filter.from) continue;
          if (filter.to !== undefined && rec.timestamp > filter.to) continue;
          if (filter.modelKey && rec.modelKey !== filter.modelKey) continue;
          if (filter.source && rec.source !== filter.source) continue;
          if (filter.status !== undefined && rec.status !== filter.status) continue;
          records.push(rec);
        } catch {
          // skip corrupted line
        }
      }
    }
    return records;
  }

  async list(filter: LLMCallLogFilter, page = 1, pageSize = 20): Promise<Paginated<LLMCallLogRecord>> {
    const all = this.readAll(filter).sort((a, b) => b.timestamp - a.timestamp);
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize };
  }

  async getById(id: string): Promise<LLMCallLogRecord | null> {
    if (!fs.existsSync(this.logDir)) return null;
    const files = fs.readdirSync(this.logDir).filter(f => f.endsWith('.jsonl')).sort().reverse();
    for (const file of files) {
      const lines = fs.readFileSync(path.join(this.logDir, file), 'utf-8').split('\n').reverse();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const rec = JSON.parse(line) as LLMCallLogRecord;
          if (rec.id === id) return rec;
        } catch {
          // skip corrupted line
        }
      }
    }
    return null;
  }

  private toYMD(ts: number): string {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async deleteRange(from: number, to: number): Promise<number> {
    if (!fs.existsSync(this.logDir)) return 0;
    const fromDate = this.toYMD(from);
    const toDate = this.toYMD(to);
    let deleted = 0;
    for (const file of fs.readdirSync(this.logDir).filter(f => f.endsWith('.jsonl'))) {
      const name = file.replace('.jsonl', '');
      if (name >= fromDate && name <= toDate) {
        fs.unlinkSync(path.join(this.logDir, file));
        deleted++;
      }
    }
    return deleted;
  }
}
// [AGC:END]
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/server/services/llm-call-query.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 提交**

```bash
git add src/server/services/llm-call/query.ts tests/server/services/llm-call-query.test.ts
git commit -m "feat: add LLMCallLogQuery for filtering and pagination"
```

---

### Task 3: 将 Logger 接入 LLMService(后端)

**Files:**
- Modify: `src/server/services/llm/service.ts`
- Test: `tests/server/services/llm-service-log.test.ts`

**Interfaces:**
- Consumes: `LLMCallLogger`, `LLMCallStart`, `LLMCallHandle` from Task 1.
- Produces: `LLMService` constructor gains optional 3rd param `logger?: LLMCallLogger` (backward compatible; existing `new LLMService(registry, modelManager)` callers unaffected).

- [ ] **Step 1: 写失败测试**

```typescript
// tests/server/services/llm-service-log.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LLMService } from '../../../src/server/services/llm/service';
import { LLMCallLogger } from '../../../src/server/services/llm-call/logger';
import { ITextAdapterRegistry, ITextProviderAdapter, TextModelConfig } from '../../../src/server/services/llm/types';

const config: TextModelConfig = {
  id: 'openai-gpt4o', name: 'GPT-4o', enabled: true, providerId: 'openai', protocol: 'openai',
  modelId: 'gpt-4o',
  providerMeta: { id: 'openai', name: 'OpenAI', requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false },
  modelMeta: { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', capabilities: { supportsTools: true }, parameterDefinitions: [] },
  connectionConfig: { apiKey: 'sk-test' },
  paramOverrides: { temperature: 0.2 },
};

function readRecords(dir: string): any[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).flatMap(file =>
    fs.readFileSync(path.join(dir, file), 'utf-8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)),
  );
}

describe('LLMService logging', () => {
  let dir: string;
  let logger: LLMCallLogger;
  let service: LLMService;
  let adapter: ITextProviderAdapter;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-svc-'));
    logger = new LLMCallLogger(dir);
    const registry = {
      getAdapter: vi.fn(() => adapter),
    } as unknown as ITextAdapterRegistry;
    const modelManager = { getModel: vi.fn(() => Promise.resolve(config)) } as any;
    adapter = {
      sendMessage: vi.fn(() => Promise.resolve({ content: 'hello', metadata: { model: 'gpt-4o' } })),
      sendRaw: vi.fn(() => Promise.resolve({ id: 'raw-1' })),
      sendMessageStream: vi.fn(),
      sendMessageStreamWithTools: vi.fn(),
      sendImageUnderstanding: vi.fn(),
      sendImageUnderstandingStream: vi.fn(),
      getProvider: vi.fn(() => ({ id: 'openai', name: 'OpenAI', requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false })),
      getModels: vi.fn(() => []),
      buildDefaultModel: vi.fn(),
    } as unknown as ITextProviderAdapter;
    service = new LLMService(registry, modelManager, logger);
  });

  it('sendMessage logs request, modelParams and response', async () => {
    const content = await service.sendMessage([{ role: 'user', content: 'Hi' }], 'openai-gpt4o');
    expect(content).toBe('hello');
    const recs = readRecords(dir);
    expect(recs.length).toBe(1);
    expect(recs[0].source).toBe('prompt');
    expect(recs[0].modelKey).toBe('openai-gpt4o');
    expect(recs[0].modelParams).toEqual({ modelId: 'gpt-4o', temperature: 0.2 });
    expect(recs[0].request.messages[0].content).toBe('Hi');
    expect(recs[0].response.content).toBe('hello');
    expect(recs[0].status).toBe(200);
  });

  it('sendRaw logs the raw payload and raw response', async () => {
    const result = await service.sendRaw({ model: 'gpt-4o', messages: [] }, 'openai-gpt4o');
    expect(result.id).toBe('raw-1');
    const recs = readRecords(dir);
    expect(recs.length).toBe(1);
    expect(recs[0].source).toBe('apiTester');
    expect(recs[0].request.model).toBe('gpt-4o');
    expect(recs[0].response.id).toBe('raw-1');
  });

  it('logs status 500 and error message when sendRaw throws', async () => {
    (adapter.sendRaw as any).mockRejectedValueOnce(new Error('bad key'));
    await expect(service.sendRaw({ messages: [] }, 'openai-gpt4o')).rejects.toThrow('bad key');
    const recs = readRecords(dir);
    expect(recs.length).toBe(1);
    expect(recs[0].status).toBe(500);
    expect(recs[0].error).toBe('bad key');
    expect(recs[0].response).toBeNull();
  });

  it('logs stream calls with accumulated content on onComplete', async () => {
    let captured: any = {};
    (adapter.sendMessageStream as any).mockImplementation(async (_m: any, _c: any, cb: any) => {
      captured = cb;
      cb.onToken('Hi');
      cb.onComplete({ content: 'Hi there', metadata: { model: 'gpt-4o' } });
    });
    const onComplete = vi.fn();
    await service.sendMessageStream([{ role: 'user', content: 'Hi' }], 'openai-gpt4o', { onToken: vi.fn(), onComplete, onError: vi.fn() });
    expect(onComplete).toHaveBeenCalled();
    const recs = readRecords(dir);
    expect(recs.length).toBe(1);
    expect(recs[0].source).toBe('stream');
    expect(recs[0].status).toBe(200);
    expect(recs[0].response.content).toBe('Hi there');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/server/services/llm-service-log.test.ts`
Expected: FAIL — `readRecords(dir)` is empty, `recs.length` is 0

- [ ] **Step 3: 实现 service.ts 改造**

在 `src/server/services/llm/service.ts`:
1. 引入类型与 logger:
```typescript
import { LLMCallLogger } from '../llm-call/logger';
```
2. 构造函数增加可选第三参:
```typescript
constructor(
  private registry: ITextAdapterRegistry,
  private modelManager: IModelManager,
  private logger?: LLMCallLogger,
) {}
```
3. 新增两个私有辅助方法:
```typescript
// [AGC:START] tool=Cc author=fangkun
private modelParamsOf(config: TextModelConfig): Record<string, unknown> {
  return { modelId: config.modelId || config.modelMeta?.id, ...(config.paramOverrides || {}) };
}

private protocolOf(config: TextModelConfig): 'openai' | 'anthropic' {
  return resolveProtocol(config);
}
// [AGC:END]
```
4. 逐个包裹方法。替换 `sendMessage`、`sendMessageStructured`、`sendRaw`、`testConnection`、`sendMessageStream`、`sendMessageStreamWithTools` 的实现为:

```typescript
// [AGC:START] tool=Cc author=fangkun
async sendMessage(messages: Message[], provider: string): Promise<string> {
  const config = await this.getModelConfig(provider);
  const protocol = this.protocolOf(config);
  const adapter = this.registry.getAdapter(protocol);
  const handle = this.logger?.start({
    source: 'prompt', modelKey: config.id, protocol,
    modelParams: this.modelParamsOf(config), request: { messages },
  });
  try {
    const response = await adapter.sendMessage(messages, config);
    handle?.complete({
      response: { content: response.content, ...(response.metadata ? { metadata: response.metadata } : {}) },
      status: 200,
    });
    return response.content;
  } catch (e: any) {
    handle?.complete({ status: 500, error: e.message });
    throw e;
  }
}

async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
  const config = await this.getModelConfig(provider);
  const protocol = this.protocolOf(config);
  const adapter = this.registry.getAdapter(protocol);
  const handle = this.logger?.start({
    source: 'prompt', modelKey: config.id, protocol,
    modelParams: this.modelParamsOf(config), request: { messages },
  });
  try {
    const response = await adapter.sendMessage(messages, config);
    handle?.complete({ response: response as unknown as Record<string, unknown>, status: 200 });
    return response;
  } catch (e: any) {
    handle?.complete({ status: 500, error: e.message });
    throw e;
  }
}

async sendRaw(payload: Record<string, any>, provider: string): Promise<Record<string, any>> {
  const config = await this.getModelConfig(provider);
  const protocol = this.protocolOf(config);
  const adapter = this.registry.getAdapter(protocol);
  if (!adapter.sendRaw) {
    throw new Error(`Provider "${provider}" does not support raw invocation`);
  }
  const handle = this.logger?.start({
    source: 'apiTester', modelKey: config.id, protocol,
    modelParams: this.modelParamsOf(config), request: payload,
  });
  try {
    const result = await adapter.sendRaw(payload, config);
    handle?.complete({ response: result, status: 200 });
    return result;
  } catch (e: any) {
    handle?.complete({ status: 500, error: e.message });
    throw e;
  }
}

async testConnection(provider: string): Promise<void> {
  const config = await this.getModelConfig(provider);
  const protocol = this.protocolOf(config);
  const adapter = this.registry.getAdapter(protocol);
  const testMessages: Message[] = [{ role: 'user', content: 'Hello, this is a connection test.' }];
  const handle = this.logger?.start({
    source: 'test-connection', modelKey: config.id, protocol,
    modelParams: this.modelParamsOf(config), request: { messages: testMessages },
  });
  try {
    const response = await adapter.sendMessage(testMessages, config);
    handle?.complete({ response: { content: response.content }, status: 200 });
  } catch (e: any) {
    handle?.complete({ status: 500, error: e.message });
    throw e;
  }
}

async sendMessageStream(messages: Message[], provider: string, callbacks: StreamHandlers): Promise<void> {
  const config = await this.getModelConfig(provider);
  const protocol = this.protocolOf(config);
  const adapter = this.registry.getAdapter(protocol);
  const handle = this.logger?.start({
    source: 'stream', modelKey: config.id, protocol,
    modelParams: this.modelParamsOf(config), request: { messages },
  });
  const wrapped: StreamHandlers = {
    onToken: callbacks.onToken,
    onReasoningToken: callbacks.onReasoningToken,
    onToolCall: callbacks.onToolCall,
    onComplete: (response) => {
      handle?.complete({
        response: response
          ? { content: response.content, reasoning: response.reasoning, ...(response.metadata ? { metadata: response.metadata } : {}) }
          : undefined,
        status: 200,
      });
      callbacks.onComplete(response);
    },
    onError: (error) => {
      handle?.complete({ status: 500, error: error.message });
      callbacks.onError(error);
    },
  };
  await adapter.sendMessageStream(messages, config, wrapped);
}

async sendMessageStreamWithTools(
  messages: Message[],
  provider: string,
  tools: ToolDefinition[],
  callbacks: StreamHandlers
): Promise<void> {
  const config = await this.getModelConfig(provider);
  const protocol = this.protocolOf(config);
  const adapter = this.registry.getAdapter(protocol);
  const handle = this.logger?.start({
    source: 'stream', modelKey: config.id, protocol,
    modelParams: this.modelParamsOf(config), request: { messages, tools },
  });
  const wrapped: StreamHandlers = {
    onToken: callbacks.onToken,
    onReasoningToken: callbacks.onReasoningToken,
    onToolCall: callbacks.onToolCall,
    onComplete: (response) => {
      handle?.complete({
        response: response
          ? { content: response.content, reasoning: response.reasoning, ...(response.metadata ? { metadata: response.metadata } : {}) }
          : undefined,
        status: 200,
      });
      callbacks.onComplete(response);
    },
    onError: (error) => {
      handle?.complete({ status: 500, error: error.message });
      callbacks.onError(error);
    },
  };
  await adapter.sendMessageStreamWithTools(messages, config, tools, wrapped);
}
// [AGC:END]
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/server/services/llm-service-log.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 提交**

```bash
git add src/server/services/llm/service.ts tests/server/services/llm-service-log.test.ts
git commit -m "feat: log all LLM calls through LLMService"
```

---

### Task 4: REST 路由与组装(后端)

**Files:**
- Create: `src/server/routes/llm-call-logs.ts`
- Modify: `src/server/prompt-server.ts`
- Test: `tests/server/routes/llm-call-logs.test.ts`

**Interfaces:**
- Consumes: `LLMCallLogQuery` (Task 2).
- Produces: `registerLLMCallLogRoutes(router: Router, query: LLMCallLogQuery): void`; endpoints under `/api/v1`:
  - `GET /llm-call-logs?from&to&modelKey&source&status&page&pageSize` → `{ success: true, data: Paginated<LLMCallLogRecord> }`
  - `GET /llm-call-logs/:id` → `{ success: true, data: LLMCallLogRecord }` or `404 { success: false, error: { message } }`
  - `DELETE /llm-call-logs?from&to` → `{ success: true, data: { deleted: number } }`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/server/routes/llm-call-logs.test.ts
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerLLMCallLogRoutes } from '../../../src/server/routes/llm-call-logs';
import { LLMCallLogQuery } from '../../../src/server/services/llm-call/query';
import { LLMCallLogRecord } from '../../../src/server/services/llm-call/types';

function buildApp(query: LLMCallLogQuery): express.Express {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerLLMCallLogRoutes(router, query);
  app.use('/api/v1', router);
  return app;
}

describe('LLM call logs route', () => {
  it('GET /llm-call-logs returns paginated list', async () => {
    const query = {
      list: vi.fn(() => Promise.resolve({ items: [{ id: 'a' }], total: 1, page: 1, pageSize: 20 })),
      getById: vi.fn(),
      deleteRange: vi.fn(),
    } as unknown as LLMCallLogQuery;
    const app = buildApp(query);
    const res = await request(app).get('/api/v1/llm-call-logs?page=1&pageSize=10&modelKey=openai-gpt4o');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items[0].id).toBe('a');
    expect(query.list).toHaveBeenCalledWith({ modelKey: 'openai-gpt4o' }, 1, 10);
  });

  it('GET /llm-call-logs/:id returns record or 404', async () => {
    const query = {
      list: vi.fn(),
      getById: vi.fn((id: string) => Promise.resolve(id === 'abc' ? { id: 'abc' } as LLMCallLogRecord : null)),
      deleteRange: vi.fn(),
    } as unknown as LLMCallLogQuery;
    const app = buildApp(query);
    const ok = await request(app).get('/api/v1/llm-call-logs/abc');
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe('abc');
    const missing = await request(app).get('/api/v1/llm-call-logs/nope');
    expect(missing.status).toBe(404);
  });

  it('DELETE /llm-call-logs deletes range', async () => {
    const query = {
      list: vi.fn(),
      getById: vi.fn(),
      deleteRange: vi.fn(() => Promise.resolve(2)),
    } as unknown as LLMCallLogQuery;
    const app = buildApp(query);
    const res = await request(app).delete('/api/v1/llm-call-logs?from=100&to=200');
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(2);
    expect(query.deleteRange).toHaveBeenCalledWith(100, 200);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/server/routes/llm-call-logs.test.ts`
Expected: FAIL — "Cannot find module" / "registerLLMCallLogRoutes is not a function"

- [ ] **Step 3: 实现路由**

```typescript
// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// src/server/routes/llm-call-logs.ts
import { Router } from 'express';
import { LLMCallLogQuery, LLMCallLogFilter } from '../services/llm-call/query';

// [AGC:START] tool=Cc author=fangkun
export function registerLLMCallLogRoutes(router: Router, query: LLMCallLogQuery): void {
  router.get('/llm-call-logs', async (req, res) => {
    try {
      const { from, to, modelKey, source, status } = req.query;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
      const filter: LLMCallLogFilter = {};
      if (from !== undefined) filter.from = Number(from);
      if (to !== undefined) filter.to = Number(to);
      if (modelKey) filter.modelKey = String(modelKey);
      if (source) filter.source = String(source);
      if (status !== undefined) filter.status = Number(status);
      const data = await query.list(filter, page, pageSize);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  router.get('/llm-call-logs/:id', async (req, res) => {
    try {
      const record = await query.getById(req.params.id);
      if (!record) {
        res.status(404).json({ success: false, error: { message: 'Log not found' } });
        return;
      }
      res.json({ success: true, data: record });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  router.delete('/llm-call-logs', async (req, res) => {
    try {
      const { from, to } = req.query;
      const deleted = await query.deleteRange(Number(from ?? 0), Number(to ?? Date.now()));
      res.json({ success: true, data: { deleted } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });
}
// [AGC:END]
```

- [ ] **Step 4: 组装到 prompt-server.ts**

在 `src/server/prompt-server.ts` 中:
1. 新增 import:
```typescript
import { LLMCallLogger } from './services/llm-call/logger';
import { LLMCallLogQuery } from './services/llm-call/query';
import { registerLLMCallLogRoutes } from './routes/llm-call-logs';
```
2. 在 `const llmService = new LLMService(registry, modelManager);` 处替换为:
```typescript
const llmCallLogDir = path.join(dataDir, 'llm-call-logs');
const llmCallLogger = new LLMCallLogger(llmCallLogDir);
const llmCallQuery = new LLMCallLogQuery(llmCallLogDir);
const llmService = new LLMService(registry, modelManager, llmCallLogger);
```
3. 在 `registerLLMRoutes(...)` 之后新增:
```typescript
registerLLMCallLogRoutes(router, llmCallQuery);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/server/routes/llm-call-logs.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 提交**

```bash
git add src/server/routes/llm-call-logs.ts src/server/prompt-server.ts tests/server/routes/llm-call-logs.test.ts
git commit -m "feat: add /llm-call-logs query REST routes"
```

---

### Task 5: 后端端到端集成测试

**Files:**
- Test: `tests/server/llm-call-integration.test.ts`

**Interfaces:**
- Consumes: `createApp` pipeline pieces (prompt-server wiring from Task 4), `FileStorageProvider`.

- [ ] **Step 1: 写失败测试**

```typescript
// tests/server/llm-call-integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { FileStorageProvider } from '../../src/server/storage/file-provider';
import { ModelManager } from '../../src/server/services/model/manager';
import { TextAdapterRegistry } from '../../src/server/services/llm/adapters/registry';
import { LLMService } from '../../src/server/services/llm/service';
import { LLMCallLogger } from '../../src/server/services/llm-call/logger';
import { LLMCallLogQuery } from '../../src/server/services/llm-call/query';
import { registerLLMRoutes } from '../../src/server/routes/llm';
import { registerLLMCallLogRoutes } from '../../src/server/routes/llm-call-logs';

describe('LLM call logs integration', () => {
  let dir: string;
  let app: express.Express;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-int-'));
    const storage = new FileStorageProvider(dir);
    const modelManager = new ModelManager(storage);
    await modelManager.addModel('openai-gpt4o', {
      id: 'openai-gpt4o', name: 'GPT-4o', enabled: true, providerId: 'openai', protocol: 'openai',
      modelId: 'gpt-4o',
      providerMeta: { id: 'openai', name: 'OpenAI', requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false },
      modelMeta: { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', capabilities: { supportsTools: true }, parameterDefinitions: [] },
      connectionConfig: { apiKey: 'sk-test', baseURL: 'http://127.0.0.1:9/v1' }, // unreachable base → sendRaw will throw
      paramOverrides: { temperature: 0.5 },
    });
    const registry = new TextAdapterRegistry();
    registry.register(createStubAdapter());
    const logDir = path.join(dir, 'llm-call-logs');
    const logger = new LLMCallLogger(logDir);
    const query = new LLMCallLogQuery(logDir);
    const llmService = new LLMService(registry, modelManager, logger);
    app = express();
    app.use(express.json());
    const router = express.Router();
    registerLLMRoutes(router, llmService, modelManager, registry);
    registerLLMCallLogRoutes(router, query);
    app.use('/api/v1', router);
  });

  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('a /llm/raw call is captured and queryable via /llm-call-logs', async () => {
    // stub adapter returns a raw response
    const res = await request(app)
      .post('/api/v1/llm/raw')
      .set('Content-Type', 'application/json')
      .send({ modelKey: 'openai-gpt4o', payload: { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app).get('/api/v1/llm-call-logs?source=apiTester');
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);
    expect(list.body.data.total).toBe(1);
    const rec = list.body.data.items[0];
    expect(rec.modelKey).toBe('openai-gpt4o');
    expect(rec.modelParams).toEqual({ modelId: 'gpt-4o', temperature: 0.5 });
    expect(rec.request.messages[0].content).toBe('Hi');
    expect(rec.status).toBe(200);

    const detail = await request(app).get(`/api/v1/llm-call-logs/${rec.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.id).toBe(rec.id);
  });
});

// Minimal adapter so the registry works without real provider SDKs.
function createStubAdapter() {
  return {
    getProvider: () => ({ id: 'openai', name: 'OpenAI', requiresApiKey: true, defaultBaseURL: '', supportsDynamicModels: false }),
    getModels: () => [],
    sendMessage: async () => ({ content: 'hello' }),
    sendRaw: async (payload: any) => ({ id: 'raw-1', echo: payload }),
    sendMessageStream: async () => {},
    sendMessageStreamWithTools: async () => {},
    sendImageUnderstanding: async () => ({ content: '' }),
    sendImageUnderstandingStream: async () => {},
    buildDefaultModel: (modelId: string) => ({ id: modelId, name: modelId, providerId: 'openai', capabilities: { supportsTools: false }, parameterDefinitions: [] }),
  } as any;
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/server/llm-call-integration.test.ts`
Expected: FAIL — `total` is 0 (logger/query not wired yet)

- [ ] **Step 3: 运行全部后端测试确认链路打通**

Run: `npx vitest run tests/`
Expected: PASS (现有 llm-raw 等测试 + 本集成测试)

- [ ] **Step 4: 提交**

```bash
git add tests/server/llm-call-integration.test.ts
git commit -m "test: add end-to-end LLM call logging integration test"
```

---

### Task 6: 抽取 jsonHighlight 共享工具(前端)

**Files:**
- Create: `web/src/utils/jsonHighlight.ts`
- Modify: `web/src/components/ApiTester.vue`(删除本地实现,改为 import)
- Test: `tests/web/json-highlight.test.ts`

**Interfaces:**
- Produces: `function highlightJson(json: string, pair?: [number, number] | null): string`; `function escapeHtml(str: string): string`. Both ESM exports.

- [ ] **Step 1: 写失败测试**

```typescript
// tests/web/json-highlight.test.ts
import { describe, it, expect } from 'vitest';
import { escapeHtml, highlightJson } from '../../web/src/utils/jsonHighlight';

describe('jsonHighlight', () => {
  it('escapes HTML in string values', () => {
    expect(escapeHtml('<a>&"')).toBe('&lt;a&gt;&amp;&quot;');
  });

  it('wraps keys/strings/numbers/keywords with token classes', () => {
    const html = highlightJson('{"a":"x", "n": 1, "b": true}');
    expect(html).toContain('tok-key');
    expect(html).toContain('tok-string');
    expect(html).toContain('tok-number');
    expect(html).toContain('tok-keyword');
    expect(html).not.toContain('<a>');
  });

  it('highlights matching bracket pair and region when pair given', () => {
    const html = highlightJson('{"a":[1,2]}', [5, 10]);
    expect(html).toContain('tok-bracket');
    expect(html).toContain('tok-bracket-region');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/web/json-highlight.test.ts`
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: 创建 jsonHighlight.ts**

从 `ApiTester.vue` 的 `<script setup>` 中把 `escapeHtml`、`isBracket`、`buildBracketMap`、`renderGap`、`highlightJson` 五个纯函数原样搬出为模块导出(保持逻辑不变):

```typescript
// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// web/src/utils/jsonHighlight.ts

// [AGC:START] tool=Cc author=fangkun
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const isBracket = (ch: string): boolean => ch === '{' || ch === '}' || ch === '[' || ch === ']'

export function buildBracketMap(text: string): Map<number, number> {
  const map = new Map<number, number>()
  const stack: number[] = []
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{' || ch === '[') {
      stack.push(i)
    } else if (ch === '}' || ch === ']') {
      const open = stack.pop()
      if (open !== undefined) {
        map.set(open, i)
        map.set(i, open)
      }
    }
  }
  return map
}

function renderGap(json: string, start: number, end: number, lo: number, hi: number): string {
  if (start >= end) return ''
  const highlight = lo >= 0 && hi >= 0
  let out = ''
  let buf = ''
  let bufCls = ''
  const flush = () => {
    if (!buf) return
    out += bufCls ? `<span class="${bufCls}">${escapeHtml(buf)}</span>` : escapeHtml(buf)
    buf = ''
    bufCls = ''
  }
  for (let i = start; i < end; i++) {
    let cls = ''
    if (highlight) {
      if (i === lo || i === hi) cls = 'tok-bracket'
      else if (i > lo && i < hi) cls = 'tok-bracket-region'
    }
    if (cls !== bufCls) { flush(); bufCls = cls }
    buf += json[i]
  }
  flush()
  return out
}

export function highlightJson(json: string, pair: [number, number] | null = null): string {
  const regex =
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  const lo = pair ? Math.min(pair[0], pair[1]) : -1
  const hi = pair ? Math.max(pair[0], pair[1]) : -1
  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(json)) !== null) {
    result += renderGap(json, lastIndex, match.index, lo, hi)
    let tokenHtml: string
    if (match[1]) {
      if (match[2]) {
        tokenHtml = `<span class="tok-key">${escapeHtml(match[1])}</span>${escapeHtml(match[2])}`
      } else {
        tokenHtml = `<span class="tok-string">${escapeHtml(match[1])}</span>`
      }
    } else {
      const token = match[0]
      const cls = /^(?:true|false|null)$/.test(token) ? 'tok-keyword' : 'tok-number'
      tokenHtml = `<span class="${cls}">${escapeHtml(token)}</span>`
    }
    const interior = lo >= 0 && hi >= 0 && match.index >= lo && regex.lastIndex <= hi
    result += interior ? `<span class="tok-bracket-region">${tokenHtml}</span>` : tokenHtml
    lastIndex = regex.lastIndex
  }
  result += renderGap(json, lastIndex, json.length, lo, hi)
  return result
}
// [AGC:END]
```

- [ ] **Step 4: 改 ApiTester.vue 引用共享工具**

在 `web/src/components/ApiTester.vue` 的 `<script setup>` 中:
1. 新增 import:
```typescript
import { highlightJson, escapeHtml, isBracket, buildBracketMap } from '../utils/jsonHighlight'
```
2. 删除本文件内 `escapeHtml`、`isBracket`、`buildBracketMap`、`renderGap`、`highlightJson` 五个本地函数定义(保留 `onInputActive`、`syncScroll`、`onOutputClick`、`onInputChanged` 等编辑交互逻辑,它们调用导入的函数)。
3. 保留下方 scoped 样式中的 `.tok-*` 与 `.editor-*` 规则(本任务只提取 JS 逻辑)。

- [ ] **Step 5: 运行测试 + 构建确认**

Run: `npx vitest run tests/web/json-highlight.test.ts`
Expected: PASS (3 tests)

Run: `cd web && npm run build`
Expected: 构建成功(类型检查通过)

- [ ] **Step 6: 提交**

```bash
git add web/src/utils/jsonHighlight.ts web/src/components/ApiTester.vue tests/web/json-highlight.test.ts
git commit -m "refactor: extract jsonHighlight util for reuse"
```

---

### Task 7: LLM 调用日志 Pinia Store(前端)

**Files:**
- Create: `web/src/stores/llmCallLogs.ts`

**Interfaces:**
- Produces:
  - `interface LLMCallLogRecord { id: string; timestamp: number; durationMs: number; source: string; modelKey: string; protocol: string; modelParams: Record<string, unknown>; request: Record<string, unknown>; response: Record<string, unknown> | null; status: number; error: string | null }`
  - `interface LLMCallLogFilter { from?: number; to?: number; modelKey?: string; source?: string; status?: number }`
  - `useLLMCallLogsStore()`: state `{ items, total, page, pageSize, loading, filters }`; actions `fetchList()`, `clearRange(from, to)`, `setFilters(partial)`, `setPage(p)`.

- [ ] **Step 1: 实现 store**

```typescript
// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// web/src/stores/llmCallLogs.ts
import { defineStore } from 'pinia'

const API_BASE = '/api/v1'

export interface LLMCallLogRecord {
  id: string
  timestamp: number
  durationMs: number
  source: string
  modelKey: string
  protocol: string
  modelParams: Record<string, unknown>
  request: Record<string, unknown>
  response: Record<string, unknown> | null
  status: number
  error: string | null
}

export interface LLMCallLogFilter {
  from?: number
  to?: number
  modelKey?: string
  source?: string
  status?: number
}

// [AGC:START] tool=Cc author=fangkun
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.success === false && json.error) throw new Error(json.error.message)
  return json.data !== undefined ? json.data : json
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.success === false && json.error) throw new Error(json.error.message)
  return json.data !== undefined ? json.data : json
}

export const useLLMCallLogsStore = defineStore('llmCallLogs', {
  state: () => ({
    items: [] as LLMCallLogRecord[],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    filters: {} as LLMCallLogFilter,
  }),
  actions: {
    setFilters(partial: Partial<LLMCallLogFilter>) {
      this.filters = { ...this.filters, ...partial }
      this.page = 1
    },
    setPage(p: number) {
      this.page = p
    },
    async fetchList() {
      this.loading = true
      try {
        const params = new URLSearchParams()
        params.set('page', String(this.page))
        params.set('pageSize', String(this.pageSize))
        if (this.filters.from !== undefined) params.set('from', String(this.filters.from))
        if (this.filters.to !== undefined) params.set('to', String(this.filters.to))
        if (this.filters.modelKey) params.set('modelKey', this.filters.modelKey)
        if (this.filters.source) params.set('source', this.filters.source)
        if (this.filters.status !== undefined) params.set('status', String(this.filters.status))
        const data = await apiGet<{ items: LLMCallLogRecord[]; total: number }>(`/llm-call-logs?${params.toString()}`)
        this.items = data.items
        this.total = data.total
      } finally {
        this.loading = false
      }
    },
    async clearRange(from: number, to: number): Promise<{ deleted: number }> {
      return apiDelete<{ deleted: number }>(`/llm-call-logs?from=${from}&to=${to}`)
    },
  },
})
// [AGC:END]
```

- [ ] **Step 2: 构建验证**

Run: `cd web && npm run build`
Expected: 构建成功(store 无类型错误)

- [ ] **Step 3: 提交**

```bash
git add web/src/stores/llmCallLogs.ts
git commit -m "feat: add LLM call logs Pinia store"
```

---

### Task 8: 调用日志页面 LLMCallLogs.vue(前端)

**Files:**
- Create: `web/src/components/LLMCallLogs.vue`

**Interfaces:**
- Consumes: `useLLMCallLogsStore` (Task 7), `highlightJson` (Task 6), `usePromptStore`(取 `allModels` 供模型下拉), `useI18n`。

- [ ] **Step 1: 实现组件**

```vue
<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-10 -->
<template>
  <div class="llm-call-logs">
    <div class="filter-bar">
      <el-date-picker
        v-model="dateRange"
        type="datetimerange"
        :start-placeholder="t('llmCallLogs.filterStart')"
        :end-placeholder="t('llmCallLogs.filterEnd')"
        style="width: 320px"
      />
      <el-select v-model="filters.modelKey" :placeholder="t('llmCallLogs.filterModel')" clearable style="width: 200px">
        <el-option v-for="m in promptStore.allModels" :key="m.id" :label="m.name" :value="m.id" />
      </el-select>
      <el-select v-model="filters.source" :placeholder="t('llmCallLogs.filterSource')" clearable style="width: 140px">
        <el-option v-for="s in SOURCES" :key="s" :label="t(`llmCallLogs.source.${s}`)" :value="s" />
      </el-select>
      <el-select v-model="filters.status" :placeholder="t('llmCallLogs.filterStatus')" clearable style="width: 120px">
        <el-option :label="t('llmCallLogs.statusSuccess')" :value="200" />
        <el-option :label="t('llmCallLogs.statusFailed')" :value="500" />
      </el-select>
      <el-button type="primary" @click="handleSearch" :loading="store.loading">{{ t('llmCallLogs.search') }}</el-button>
      <el-button @click="handleReset">{{ t('llmCallLogs.reset') }}</el-button>
      <el-button type="danger" plain @click="handleClear" :disabled="!store.total">{{ t('llmCallLogs.clearLogs') }}</el-button>
    </div>

    <el-table :data="store.items" v-loading="store.loading" @row-click="openDetail" class="log-table">
      <el-table-column prop="timestamp" :label="t('llmCallLogs.columns.time')" width="180">
        <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
      </el-table-column>
      <el-table-column prop="modelKey" :label="t('llmCallLogs.columns.model')" min-width="160" />
      <el-table-column prop="source" :label="t('llmCallLogs.columns.source')" width="120">
        <template #default="{ row }">{{ t(`llmCallLogs.source.${row.source}`) }}</template>
      </el-table-column>
      <el-table-column prop="status" :label="t('llmCallLogs.columns.status')" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 200 ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="durationMs" :label="t('llmCallLogs.columns.duration')" width="110">
        <template #default="{ row }">{{ row.durationMs }} ms</template>
      </el-table-column>
      <el-table-column :label="t('llmCallLogs.columns.summary')" min-width="220">
        <template #default="{ row }">{{ summarize(row) }}</template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        layout="total, prev, pager, next"
        :total="store.total"
        :page-size="store.pageSize"
        :current-page="store.page"
        @current-change="handlePageChange"
      />
    </div>

    <el-drawer v-model="drawerOpen" :title="t('llmCallLogs.detailTitle')" size="55%">
      <div v-if="detail" class="detail">
        <section v-if="Object.keys(detail.modelParams).length">
          <h4>{{ t('llmCallLogs.detail.params') }}</h4>
          <pre class="json-block" v-html="highlightJson(JSON.stringify(detail.modelParams, null, 2))"></pre>
        </section>
        <section>
          <h4>{{ t('llmCallLogs.detail.request') }}</h4>
          <pre class="json-block" v-html="highlightJson(JSON.stringify(detail.request, null, 2))"></pre>
        </section>
        <section v-if="detail.response">
          <h4>{{ t('llmCallLogs.detail.response') }}</h4>
          <pre class="json-block" v-html="highlightJson(JSON.stringify(detail.response, null, 2))"></pre>
        </section>
        <section v-if="detail.error">
          <h4>{{ t('llmCallLogs.detail.error') }}</h4>
          <el-alert type="error" :title="detail.error" show-icon />
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useLLMCallLogsStore, type LLMCallLogRecord, type LLMCallLogFilter } from '../stores/llmCallLogs'
import { usePromptStore } from '../stores/prompt'
import { highlightJson } from '../utils/jsonHighlight'

const { t } = useI18n()
const store = useLLMCallLogsStore()
const promptStore = usePromptStore()

const SOURCES = ['apiTester', 'prompt', 'stream', 'test-connection'] as const

const filters = ref<Partial<LLMCallLogFilter>>({})
const dateRange = ref<[Date, Date] | null>(null)
const drawerOpen = ref(false)
const detail = ref<LLMCallLogRecord | null>(null)

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function summarize(row: LLMCallLogRecord): string {
  const req = row.request as any
  const messages: any[] | undefined = req?.messages
  if (Array.isArray(messages) && messages.length > 0) {
    const last = messages[messages.length - 1]
    const text = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '')
    return text.length > 80 ? text.slice(0, 80) + '…' : text
  }
  const s = JSON.stringify(req ?? '')
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

function applyFilters() {
  store.setFilters({
    from: dateRange.value?.[0]?.getTime(),
    to: dateRange.value?.[1]?.getTime(),
    modelKey: filters.value.modelKey,
    source: filters.value.source,
    status: filters.value.status,
  })
}

async function handleSearch() {
  applyFilters()
  await store.fetchList()
}

function handleReset() {
  dateRange.value = null
  filters.value = {}
  store.setFilters({ from: undefined, to: undefined, modelKey: undefined, source: undefined, status: undefined })
  store.fetchList()
}

async function handlePageChange(p: number) {
  store.setPage(p)
  await store.fetchList()
}

function openDetail(row: LLMCallLogRecord) {
  detail.value = row
  drawerOpen.value = true
}

async function handleClear() {
  const from = dateRange.value?.[0]?.getTime() ?? 0
  const to = dateRange.value?.[1]?.getTime() ?? Date.now()
  const r = await store.clearRange(from, to)
  if (r.deleted > 0) ElMessage.success(`${t('llmCallLogs.cleared')} ${r.deleted}`)
  else ElMessage.info(t('llmCallLogs.nothingCleared'))
  await store.fetchList()
}

onMounted(async () => {
  await store.fetchList()
})
// [AGC:END]
</script>

<style scoped>
.llm-call-logs { height: 100%; display: flex; flex-direction: column; padding: 16px; box-sizing: border-box; }
.filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; }
.log-table { flex: 1; }
.pager { margin-top: 12px; display: flex; justify-content: flex-end; }
.detail section { margin-bottom: 16px; }
.detail h4 { margin: 0 0 8px; }
.json-block { background: #1e1e1e; color: #d4d4d4; border-radius: 6px; padding: 12px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; line-height: 1.6; max-height: 40vh; overflow: auto; }
.json-block :deep(.tok-key) { color: #9cdcfe; }
.json-block :deep(.tok-string) { color: #ce9178; }
.json-block :deep(.tok-number) { color: #b5cea8; }
.json-block :deep(.tok-keyword) { color: #569cd6; }
.json-block :deep(.tok-bracket) { background: #264f78; color: #fff; border-radius: 2px; box-shadow: 0 0 0 1px #569cd6; }
.json-block :deep(.tok-bracket-region) { background: rgba(86, 156, 214, 0.12); }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `cd web && npm run build`
Expected: 构建成功(组件无类型/模板错误)

- [ ] **Step 3: 提交**

```bash
git add web/src/components/LLMCallLogs.vue
git commit -m "feat: add LLM call logs page with filters and detail drawer"
```

---

### Task 9: 导航入口 + 视图接线 + i18n(前端)

**Files:**
- Modify: `web/src/stores/skills.ts`
- Modify: `web/src/components/NavSidebar.vue`
- Modify: `web/src/App.vue`
- Modify: `web/src/i18n/locales/zh-CN.json`
- Modify: `web/src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `LLMCallLogs` component (Task 8).
- Produces: `currentView` union gains `'llmCallLogs'`; nav menu item `llmCallLogs`; i18n keys `nav.llmCallLogs` and `llmCallLogs.*`.

- [ ] **Step 1: skills.ts 增加视图类型**

`web/src/stores/skills.ts` 两处:`currentView` 类型联合与 `setView` 参数,均增加 `'llmCallLogs'`:
```typescript
currentView: 'list' as 'list' | 'detail' | 'editor' | 'manage' | 'toggle' | 'manager' | 'prompt' | 'promptMaintenance' | 'agent' | 'apiTester' | 'llmCallLogs',
```
```typescript
setView(v: 'list' | 'detail' | 'editor' | 'manage' | 'toggle' | 'manager' | 'prompt' | 'promptMaintenance' | 'agent' | 'apiTester' | 'llmCallLogs') { this.currentView = v },
```

- [ ] **Step 2: NavSidebar.vue 增加菜单项**

在 `web/src/components/NavSidebar.vue`:
1. 图标 import 增加 `Notebook`:
```typescript
import { Document, FolderOpened, EditPen, Setting, Monitor, Switch, Grid, Promotion, Notebook } from '@element-plus/icons-vue'
```
2. `el-menu` 中 `apiTester` 项之后新增:
```html
<el-menu-item index="llmCallLogs"><el-icon><Notebook /></el-icon><span>{{ $t('nav.llmCallLogs') }}</span></el-menu-item>
```
3. `activeMenu` computed 增加分支:
```typescript
if (store.currentView === 'llmCallLogs') return 'llmCallLogs'
```
4. `handleMenuSelect` 增加分支:
```typescript
} else if (index === 'llmCallLogs') {
  store.setView('llmCallLogs')
}
```

- [ ] **Step 3: App.vue 增加视图分支**

在 `web/src/App.vue`:
1. 模板中 `apiTester` 行之后新增:
```html
<template v-else-if="store.currentView === 'llmCallLogs'"><LLMCallLogs /></template>
```
2. import 增加:
```typescript
import LLMCallLogs from './components/LLMCallLogs.vue'
```

- [ ] **Step 4: i18n 文案**

`web/src/i18n/locales/zh-CN.json`:
1. `nav` 块内 `"apiTester": "API 调用"` 后新增:
```json
"llmCallLogs": "调用日志"
```
2. 文件末尾 `"apiTester": { ... }` 块后新增顶级块:
```json
"llmCallLogs": {
  "filterStart": "开始时间",
  "filterEnd": "结束时间",
  "filterModel": "模型",
  "filterSource": "来源",
  "filterStatus": "状态",
  "search": "查询",
  "reset": "重置",
  "clearLogs": "清理日志",
  "nothingCleared": "区间内没有日志",
  "cleared": "已清理",
  "columns": { "time": "时间", "model": "模型", "source": "来源", "status": "状态", "duration": "耗时", "summary": "请求摘要" },
  "source": { "apiTester": "API 测试", "prompt": "提示词", "stream": "流式对话", "testConnection": "连接测试" },
  "statusSuccess": "成功",
  "statusFailed": "失败",
  "detailTitle": "调用详情",
  "detail": { "params": "模型参数", "request": "请求报文", "response": "响应报文", "error": "错误" }
}
```

`web/src/i18n/locales/en.json` 对应英文:
```json
"llmCallLogs": "Call Logs"
```
```json
"llmCallLogs": {
  "filterStart": "Start time",
  "filterEnd": "End time",
  "filterModel": "Model",
  "filterSource": "Source",
  "filterStatus": "Status",
  "search": "Search",
  "reset": "Reset",
  "clearLogs": "Clear logs",
  "nothingCleared": "No logs in range",
  "cleared": "Cleared",
  "columns": { "time": "Time", "model": "Model", "source": "Source", "status": "Status", "duration": "Duration", "summary": "Summary" },
  "source": { "apiTester": "API Tester", "prompt": "Prompt", "stream": "Stream", "testConnection": "Test Connection" },
  "statusSuccess": "Success",
  "statusFailed": "Failed",
  "detailTitle": "Call Detail",
  "detail": { "params": "Model Params", "request": "Request", "response": "Response", "error": "Error" }
}
```

- [ ] **Step 5: 构建验证**

Run: `cd web && npm run build`
Expected: 构建成功

- [ ] **Step 6: 提交**

```bash
git add web/src/stores/skills.ts web/src/components/NavSidebar.vue web/src/App.vue web/src/i18n/locales/zh-CN.json web/src/i18n/locales/en.json
git commit -m "feat: add call logs navigation entry and i18n strings"
```

---

### Task 10: 全量验证与人工冒烟

**Files:**
- Run-only(无源码改动)。

- [ ] **Step 1: 跑全部测试**

Run: `npx vitest run`
Expected: PASS(含新增 logger/query/route/集成/前端 util 测试)

- [ ] **Step 2: 服务端构建**

Run: `npm run build:server`(等价 `tsc -p tsconfig.server.json`)
Expected: 无类型错误

- [ ] **Step 3: 前端构建**

Run: `cd web && npm run build`
Expected: 构建成功

- [ ] **Step 4: 人工冒烟(浏览器)**

1. 启动后端 `npm run web`(或 `node src/cli.js web`),前端 `cd web && npm run dev`
2. 打开页面 → 侧边栏出现「调用日志」
3. 在「API 调用」页发送一次请求 → 切到「调用日志」→ 能看到该条记录(来源=API 测试)
4. 用筛选(模型/来源/状态/时间)与分页验证过滤生效
5. 点击行打开抽屉 → 请求/响应报文高亮显示,模型参数区显示 modelId 与 temperature
6. 点击「清理日志」→ 记录消失
7. 检查 `data/llm-call-logs/2026-09-10.jsonl` 文件内容与页面一致

- [ ] **Step 5: 提交验证脚本/截图(如有)并总结**

提交计划/测试产物(如人工冒烟有截图则加入 `docs/`),然后总结实现结果。

---

## Self-Review

**1. Spec coverage:**
- 全量采集(sendMessage/sendRaw/流式/testConnection)→ Task 3 ✅
- JSONL 按日轮转 → Task 1 ✅
- 模型参数/请求/响应/耗时/状态记录 → Task 1 + Task 3 ✅
- 查询 REST API(列表/详情/删除)→ Task 4 ✅
- 前端页面(筛选/列表/抽屉)→ Task 8,导航 + i18n → Task 9 ✅
- JSON 高亮复用 → Task 6 ✅
- 错误处理(写失败不影响、损坏行跳过)→ Task 1 / Task 2 测试覆盖 ✅
- 测试(单测/路由/集成)→ Task 1/2/3/4/5/6 ✅

**2. Placeholder scan:** 无 TBD/TODO;每个代码步骤都有完整实现代码。

**3. Type consistency:**
- `LLMCallSource` / `LLMCallLogRecord` / `LLMCallHandle` 在 Task 1 定义,Task 3/4/5/7 引用一致。
- `LLMCallLogFilter` 在 Task 2 定义,Task 4 路由与 Task 7 store 复用同一形状。
- `registerLLMCallLogRoutes(router, query)` 签名在 Task 4 定义,Task 5 集成测试按此调用。
- `highlightJson(json, pair?)` 签名在 Task 6 定义,Task 8 按此调用。
- `modelKey` 统一为 `config.id`;`source` 取值 4 种常量在 Task 1 与 Task 8/9 i18n 一一对应。
