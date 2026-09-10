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
    const file = path.join(dir, `${dateStr(new Date())}.jsonl`);
    fs.mkdirSync(file);
    const handle = logger.start({
      source: 'test-connection', modelKey: 'openai-gpt4o', protocol: 'openai',
      modelParams: {}, request: {},
    });
    expect(() => handle.complete({ status: 200 })).not.toThrow();
  });
});
