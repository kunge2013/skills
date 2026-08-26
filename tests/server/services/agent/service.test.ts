// [AGC:FILE] tool=Cc author=fangkun date=2026-08-26
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentSession, AgentSessionEvent } from '@earendil-works/pi-coding-agent';

// Mock pi-coding-agent before importing AgentService
function createMockSession(responseText: string): AgentSession {
  const listeners: Array<(event: AgentSessionEvent) => void> = [];
  return {
    prompt: vi.fn().mockImplementation(async () => {
      // Simulate streaming text_delta events
      for (const listener of listeners) {
        listener({
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta: responseText },
        } as unknown as AgentSessionEvent);
      }
    }),
    subscribe: vi.fn().mockImplementation((listener: (event: AgentSessionEvent) => void) => {
      listeners.push(listener);
      return () => {};
    }),
    dispose: vi.fn(),
    sessionId: 'mock-session-id',
    sessionFile: undefined,
    agent: {
      state: { messages: [], tools: [], systemPrompt: '' },
      waitForIdle: vi.fn().mockResolvedValue(undefined),
    },
    model: undefined,
    thinkingLevel: 'off',
    messages: [],
    isStreaming: false,
    steer: vi.fn(),
    followUp: vi.fn(),
    setModel: vi.fn(),
    setThinkingLevel: vi.fn(),
    cycleModel: vi.fn(),
    cycleThinkingLevel: vi.fn(),
    navigateTree: vi.fn(),
    compact: vi.fn(),
    abortCompaction: vi.fn(),
    abort: vi.fn(),
  } as unknown as AgentSession;
}

vi.mock('@earendil-works/pi-coding-agent', () => {
  let lastMockSession: AgentSession | null = null;
  return {
    AuthStorage: {
      create: vi.fn().mockReturnValue({
        setRuntimeApiKey: vi.fn(),
      }),
    },
    ModelRegistry: {
      create: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue(undefined),
        getAvailable: vi.fn().mockReturnValue([
          { id: 'claude-sonnet-4-20250514', provider: 'anthropic' },
        ]),
      }),
    },
    SessionManager: {
      inMemory: vi.fn().mockReturnValue({}),
    },
    DefaultResourceLoader: class {
      reload = vi.fn().mockResolvedValue(undefined);
      constructor() {}
    },
    getAgentDir: vi.fn().mockReturnValue('/mock/agent/dir'),
    createAgentSession: vi.fn().mockImplementation(() => {
      lastMockSession = createMockSession('Step executed with output.');
      return Promise.resolve({
        session: lastMockSession,
        extensionsResult: { extensions: [], errors: [], runtime: {} },
      });
    }),
    __getLastMockSession: () => lastMockSession,
  };
});

import { AgentService } from '../../../../src/server/services/agent/service';
import { SkillRegistry } from '../../../../src/server/services/agent/registry';
import type { ITextAdapterRegistry, TextModelConfig, TextProvider, TextModel } from '../../../../src/server/services/llm/types';
import type { IModelManager } from '../../../../src/server/services/llm/service';
import type { AgentSSEEvent } from '../../../../src/server/services/agent/types';

function makeMockModelManager(): IModelManager {
  return {
    getModel: vi.fn().mockResolvedValue({
      id: 'test',
      name: 'Test',
      enabled: true,
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      providerMeta: { id: 'anthropic', name: 'Anthropic' } as Partial<TextProvider> as TextProvider,
      modelMeta: { id: 'claude-sonnet-4-20250514', name: 'Test', providerId: 'anthropic', capabilities: { supportsTools: true }, parameterDefinitions: [] } as Partial<TextModel> as TextModel,
      connectionConfig: { apiKey: 'test-key' },
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
    expect(events[0].event).toBe('step_start');
    expect(events[events.length - 1].event).toBe('complete');
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

  it('createPlan emits content and complete events', async () => {
    const events: AgentSSEEvent[] = [];
    await service.createPlan(
      { userMessage: 'event test', providerId: 'anthropic', modelKey: 'test' },
      (e) => events.push(e)
    );

    expect(events.length).toBeGreaterThanOrEqual(2);
    const eventTypes = events.map(e => e.event);
    expect(eventTypes).toContain('content');
    expect(eventTypes).toContain('complete');
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
