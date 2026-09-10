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
