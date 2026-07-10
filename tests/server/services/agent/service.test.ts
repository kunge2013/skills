import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentService } from '../../../../src/server/services/agent/service';
import { SkillRegistry } from '../../../../src/server/services/agent/registry';
import type { ITextAdapterRegistry, TextModelConfig } from '../../../../src/server/services/llm/types';
import type { IModelManager } from '../../../../src/server/services/llm/service';
import type { AgentSSEEvent } from '../../../../src/server/services/agent/types';

function makeMockModelManager(): IModelManager {
  return {
    getModel: vi.fn().mockResolvedValue({
      id: 'test',
      name: 'Test',
      enabled: true,
      providerMeta: {},
      modelMeta: {},
      connectionConfig: { apiKey: 'test' },
    } as TextModelConfig),
    getAllModels: vi.fn().mockResolvedValue([]),
    getEnabledModels: vi.fn().mockResolvedValue([]),
  };
}

function makeMockRegistry(): ITextAdapterRegistry {
  return {
    getAdapter: vi.fn().mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue({ content: 'OK' }),
      sendMessageStream: vi.fn().mockImplementation((_msgs, _cfg, callbacks) => {
        callbacks.onToken('Step executed with output.');
        callbacks.onComplete({ content: 'Step executed with output.' });
        return Promise.resolve();
      }),
      getProvider: vi.fn().mockReturnValue({ id: 'openai', name: 'OpenAI' }),
      getModels: vi.fn().mockReturnValue([]),
      buildDefaultModel: vi.fn(),
      sendImageUnderstanding: vi.fn(),
      sendImageUnderstandingStream: vi.fn(),
    }),
    getAllProviders: vi.fn().mockReturnValue([]),
    getStaticModels: vi.fn().mockReturnValue([]),
    getDynamicModels: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
    supportsDynamicModels: vi.fn().mockReturnValue(false),
    validateProviderModel: vi.fn().mockReturnValue(true),
  };
}

describe('AgentService', () => {
  let service: AgentService;
  let skillRegistry: SkillRegistry;
  let modelManager: IModelManager;
  let adapterRegistry: ITextAdapterRegistry;

  beforeEach(() => {
    skillRegistry = new SkillRegistry();
    modelManager = makeMockModelManager();
    adapterRegistry = makeMockRegistry();
    service = new AgentService(modelManager, adapterRegistry, skillRegistry);
  });

  it('createPlan stores the plan and returns it', async () => {
    const events: unknown[] = [];
    const plan = await service.createPlan(
      { userMessage: 'test', providerId: 'anthropic', modelKey: 'test' },
      (e) => events.push(e)
    );

    expect(plan).toBeDefined();
    expect(plan.userMessage).toBe('test');
    expect(plan.status).toBe('pending_review');
    expect(plan.id).toBeDefined();
  });

  it('getPlan returns stored plan by id', async () => {
    const plan = await service.createPlan(
      { userMessage: 'find me', providerId: 'openai', modelKey: 'test' },
      () => {}
    );

    const retrieved = service.getPlan(plan.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.userMessage).toBe('find me');
  });

  it('getPlan returns undefined for missing id', () => {
    expect(service.getPlan('nonexistent')).toBeUndefined();
  });

  it('getAllPlans returns all created plans', async () => {
    await service.createPlan({ userMessage: 'plan1', providerId: 'anthropic', modelKey: 'test' }, () => {});
    await service.createPlan({ userMessage: 'plan2', providerId: 'openai', modelKey: 'test' }, () => {});

    const plans = service.getAllPlans();
    expect(plans.length).toBe(2);
  });

  it('runStep fails for non-existent step', async () => {
    await expect(service.runStep('nonexistent-step')).rejects.toThrow('Step not found');
  });

  it('runStep executes a pending step successfully', async () => {
    const plan = await service.createPlan(
      { userMessage: 'test run', providerId: 'anthropic', modelKey: 'test' },
      () => {}
    );

    const stepId = plan.steps[0].id;
    const events: AgentSSEEvent[] = [];
    const result = await service.runStep(stepId, undefined, (e) => events.push(e));

    expect(result.status).toBe('done');
    expect(result.output).toContain('executed');
    expect(result.runAt).toBeDefined();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].type).toBe('step_start');
    expect(events[events.length - 1].type).toBe('step_complete');
  });

  it('runStep rejects non-pending steps', async () => {
    const plan = await service.createPlan(
      { userMessage: 'reject test', providerId: 'anthropic', modelKey: 'test' },
      () => {}
    );

    const stepId = plan.steps[0].id;
    // First call should succeed (step is pending)
    await service.runStep(stepId);

    // Second call should fail (step is now done)
    await expect(service.runStep(stepId)).rejects.toThrow('is not pending');
  });

  it('createPlan emits plan_token and plan_complete events', async () => {
    const events: AgentSSEEvent[] = [];
    await service.createPlan(
      { userMessage: 'event test', providerId: 'anthropic', modelKey: 'test' },
      (e) => events.push(e)
    );

    expect(events.length).toBeGreaterThanOrEqual(2);
    const types = events.map(e => e.type);
    expect(types).toContain('plan_token');
    expect(types).toContain('plan_complete');
  });

  it('createPlan throws when model not found', async () => {
    const failingModelManager = makeMockModelManager();
    vi.mocked(failingModelManager.getModel).mockResolvedValue(undefined);
    const failingService = new AgentService(failingModelManager, adapterRegistry, skillRegistry);

    await expect(
      failingService.createPlan(
        { userMessage: 'no model', providerId: 'anthropic', modelKey: 'missing' },
        () => {}
      )
    ).rejects.toThrow('Model config not found for key: missing');
  });
});
