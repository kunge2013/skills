import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerAgentRoutes } from '../../../src/server/routes/agent';
import type { AgentService } from '../../../src/server/services/agent/service';
import type { SkillRegistry } from '../../../src/server/services/agent/registry';

function makeMockAgentService(): AgentService {
  return {
    createPlan: vi.fn().mockImplementation((_req: unknown, onEvent: (e: unknown) => void) => {
      const plan = {
        id: 'plan-1',
        userMessage: 'test',
        providerId: 'anthropic',
        modelKey: 'test',
        status: 'pending_review',
        steps: [],
        createdAt: '2026-07-10T00:00:00Z',
        updatedAt: '2026-07-10T00:00:00Z',
      };
      onEvent({ type: 'plan_complete', payload: { plan } });
      return Promise.resolve(plan);
    }),
    getPlan: vi.fn().mockImplementation((id: string) => {
      if (id === 'plan-1') {
        return { id: 'plan-1', userMessage: 'test', providerId: 'anthropic', modelKey: 'test', status: 'pending_review', steps: [], createdAt: '2026-07-10T00:00:00Z', updatedAt: '2026-07-10T00:00:00Z' };
      }
      return undefined;
    }),
    getAllPlans: vi.fn().mockReturnValue([]),
    runStep: vi.fn().mockResolvedValue({
      id: 'step-1',
      planId: 'plan-1',
      skillName: 'test-skill',
      title: 'Test',
      description: 'test',
      status: 'done',
      output: 'done',
    }),
  } as unknown as AgentService;
}

function makeMockSkillRegistry(): SkillRegistry {
  return {
    discover: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue([]),
  } as unknown as SkillRegistry;
}

describe('Agent Routes', () => {
  let app: express.Express;
  let mockService: AgentService;
  let mockRegistry: SkillRegistry;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mockService = makeMockAgentService();
    mockRegistry = makeMockSkillRegistry();
    const router = express.Router();
    registerAgentRoutes(router, mockService, mockRegistry);
    app.use('/api/v1', router);
  });

  it('POST /agent/plan returns a plan', async () => {
    const res = await request(app)
      .post('/api/v1/agent/plan')
      .set('Content-Type', 'application/json')
      .send({ userMessage: 'test', providerId: 'anthropic', modelKey: 'test' });
    expect(res.status).toBe(200);
    // SSE response is text, not JSON — check raw body contains plan data
    expect(res.text).toContain('plan-1');
  });

  it('POST /agent/plan returns 400 without userMessage', async () => {
    const res = await request(app)
      .post('/api/v1/agent/plan')
      .set('Content-Type', 'application/json')
      .send({ providerId: 'anthropic', modelKey: 'test' });
    expect(res.status).toBe(400);
  });

  it('GET /agent/plan/:id returns plan', async () => {
    const res = await request(app).get('/api/v1/agent/plan/plan-1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('plan-1');
  });

  it('GET /agent/plan/:id returns 404 for missing plan', async () => {
    const res = await request(app).get('/api/v1/agent/plan/nonexistent');
    expect(res.status).toBe(404);
  });

  it('GET /agent/skills returns empty array when no skills registered', async () => {
    const res = await request(app).get('/api/v1/agent/skills');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
