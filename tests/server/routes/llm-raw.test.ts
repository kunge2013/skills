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
