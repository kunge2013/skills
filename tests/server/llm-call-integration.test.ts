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
      connectionConfig: { apiKey: 'sk-test' },
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
