import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentService } from '../../../../src/server/services/agent/service';
import { SkillRegistry } from '../../../../src/server/services/agent/registry';
import type { ITextAdapterRegistry, TextModelConfig } from '../../../../src/server/services/llm/types';
import type { IModelManager } from '../../../../src/server/services/llm/service';

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
    getAdapter: vi.fn(),
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
    await expect(service.runStep('nonexistent-step')).rejects.toThrow();
  });
});
