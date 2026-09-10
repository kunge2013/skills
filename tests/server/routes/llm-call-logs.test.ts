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

  it('GET /llm-call-logs rejects non-numeric status with 400 and does not call list', async () => {
    const query = {
      list: vi.fn(),
      getById: vi.fn(),
      deleteRange: vi.fn(),
    } as unknown as LLMCallLogQuery;
    const app = buildApp(query);
    const res = await request(app).get('/api/v1/llm-call-logs?status=abc');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Invalid value for param: status');
    expect(query.list).not.toHaveBeenCalled();
  });

  it('DELETE /llm-call-logs rejects non-numeric from with 400 and does not call deleteRange', async () => {
    const query = {
      list: vi.fn(),
      getById: vi.fn(),
      deleteRange: vi.fn(),
    } as unknown as LLMCallLogQuery;
    const app = buildApp(query);
    const res = await request(app).delete('/api/v1/llm-call-logs?from=abc');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Invalid value for param: from');
    expect(query.deleteRange).not.toHaveBeenCalled();
  });
});
