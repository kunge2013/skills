// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
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
