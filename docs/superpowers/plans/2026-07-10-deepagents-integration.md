# DeepAgents Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AgentService layer with LangChain DeepAgents, enabling users to submit natural language requests, receive multi-step execution plans, and trigger sub-agent steps with SSE streaming — all while preserving existing LLMService functionality.

**Architecture:** New `AgentService` sits alongside existing `LLMService`. A `LangChainChatModel` bridge converts existing `ITextProviderAdapter` configs into LangChain `BaseChatModel` instances. A `SkillRegistry` auto-discovers all SKILL.md files. Frontend adds an `AgentPanel` with `useAgent` composable and `GlobalEventBus` for SSE events.

**Tech Stack:** Express 5, Vue 3 (Composition API), TypeScript, LangChain.js (`@langchain/core`, `@langchain/langgraph`, `@langchain/anthropic`, `@langchain/openai`), Element Plus, Pinia, SSE

## Global Constraints

- Minimum test coverage: 80%
- No `any` type in new TypeScript code — use `unknown` with narrowing
- All user inputs validated at API boundaries
- No hardcoded secrets — use environment variables
- Immutable data patterns — spread operator for updates
- Functions <50 lines, files <800 lines, no deep nesting >4 levels
- Commit after each testable deliverable
- Follow existing patterns: service constructor DI, Express route registration function, SSE `data: JSON\n\n` format
- i18n required for all user-facing strings (en + zh-CN)

---

### Task 1: Dependencies & Type Definitions

**Files:**
- Create: `src/server/services/agent/types.ts`
- Create: `web/src/types/agent.ts`
- Modify: `package.json` (add LangChain deps)
- Test: `tests/server/services/agent/types.test.ts`

**Interfaces:**
- Consumes: None (ground floor)
- Produces: All types below, used by every subsequent task

- [ ] **Step 1: Add LangChain dependencies to package.json**

```json
// In dependencies section, add:
"@langchain/core": "^0.3.x",
"@langchain/langgraph": "^0.2.x",
"@langchain/anthropic": "^0.1.x",
"@langchain/openai": "^0.3.x"
```

Run: `npm install`

- [ ] **Step 2: Create backend agent types**

```typescript
// src/server/services/agent/types.ts
import type { TextModelConfig } from '../llm/types';

export interface Plan {
  id: string;
  userMessage: string;
  providerId: string;
  modelKey: string;
  status: PlanStatus;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}

export type PlanStatus = 'planning' | 'pending_review' | 'executing' | 'done' | 'failed';

export interface Step {
  id: string;
  planId: string;
  skillName: string;
  title: string;
  description: string;
  status: StepStatus;
  output: string | null;
  error?: string;
  userQuestions?: UserQuestion[];
  runAt?: string;
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'waiting_user';

export interface UserQuestion {
  question: string;
  answer: string | null;
}

export interface SkillRegistration {
  name: string;
  description: string;
  filePath: string;
  content: string;
  tools: SkillTool[];
}

export interface SkillTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CreatePlanRequest {
  userMessage: string;
  providerId: string;
  modelKey: string;
}

export interface RunStepRequest {
  userAnswers?: UserQuestion[];
}

export interface AgentSSEEvent {
  type: AgentSSEEventType;
  stepId?: string;
  payload: Record<string, unknown>;
}

export type AgentSSEEventType =
  | 'plan_token'
  | 'plan_complete'
  | 'plan_error'
  | 'step_start'
  | 'step_token'
  | 'step_reasoning'
  | 'step_tool_use'
  | 'step_tool_result'
  | 'step_ask_user'
  | 'step_complete'
  | 'step_error';

export interface IAgentService {
  createPlan(req: CreatePlanRequest, onEvent: (e: AgentSSEEvent) => void): Promise<Plan>;
  getPlan(id: string): Plan | undefined;
  getAllPlans(): Plan[];
  runStep(stepId: string, req?: RunStepRequest, onEvent?: (e: AgentSSEEvent) => void): Promise<Step>;
}

export interface ISkillRegistry {
  discover(baseDir: string): Promise<void>;
  get(name: string): SkillRegistration | undefined;
  getAll(): SkillRegistration[];
}
```

- [ ] **Step 3: Create frontend agent types**

```typescript
// web/src/types/agent.ts
export interface Plan {
  id: string;
  userMessage: string;
  providerId: string;
  modelKey: string;
  status: 'planning' | 'pending_review' | 'executing' | 'done' | 'failed';
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}

export interface Step {
  id: string;
  planId: string;
  skillName: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'waiting_user';
  output: string | null;
  error?: string;
  userQuestions?: UserQuestion[];
  runAt?: string;
}

export interface UserQuestion {
  question: string;
  answer: string | null;
}

export interface SkillInfo {
  name: string;
  description: string;
  filePath: string;
}

export interface AgentSSEHandlers {
  onPlanToken: (token: string) => void;
  onPlanComplete: (plan: Plan) => void;
  onPlanError: (error: string) => void;
  onStepStart: (data: { stepId: string; skillName: string; title: string }) => void;
  onStepToken: (data: { stepId: string; token: string }) => void;
  onStepReasoning: (data: { stepId: string; reasoning: string }) => void;
  onStepToolUse: (data: { stepId: string; toolName: string; args: object }) => void;
  onStepToolResult: (data: { stepId: string; toolName: string; result: string }) => void;
  onStepAskUser: (data: { stepId: string; question: string }) => void;
  onStepComplete: (data: { stepId: string; output: string }) => void;
  onStepError: (data: { stepId: string; error: string }) => void;
}
```

- [ ] **Step 4: Write type validation test**

```typescript
// tests/server/services/agent/types.test.ts
import { describe, it, expect } from 'vitest';
import type { Plan, Step, UserQuestion, SkillRegistration, AgentSSEEvent } from '../../../src/server/services/agent/types';

describe('Agent Types', () => {
  it('Plan has required fields', () => {
    const plan: Plan = {
      id: 'test-1',
      userMessage: 'test',
      providerId: 'anthropic',
      modelKey: 'claude-sonnet-4-6',
      status: 'pending_review',
      steps: [],
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };
    expect(plan.id).toBe('test-1');
    expect(plan.status).toBe('pending_review');
    expect(plan.steps).toEqual([]);
  });

  it('Step has required fields', () => {
    const step: Step = {
      id: 'step-1',
      planId: 'test-1',
      skillName: 'openspec-propose',
      title: 'Create proposal',
      description: 'Generate openspec proposal',
      status: 'pending',
      output: null,
    };
    expect(step.status).toBe('pending');
    expect(step.output).toBeNull();
  });

  it('UserQuestion structure', () => {
    const q: UserQuestion = { question: 'Which file?', answer: null };
    expect(q.answer).toBeNull();
  });

  it('SkillRegistration contains content and tools', () => {
    const skill: SkillRegistration = {
      name: 'test-skill',
      description: 'A test skill',
      filePath: '/path/to/SKILL.md',
      content: '# Test Skill\n\nContent here',
      tools: [],
    };
    expect(skill.content).toContain('# Test Skill');
    expect(skill.tools).toEqual([]);
  });

  it('AgentSSEEvent type union', () => {
    const event: AgentSSEEvent = {
      type: 'step_token',
      stepId: 'step-1',
      payload: { token: 'hello' },
    };
    expect(event.type).toBe('step_token');
  });
});
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
npx vitest run tests/server/services/agent/types.test.ts -v
```

Expected: All 5 tests PASS

- [ ] **Step 6: Run TypeScript type check**

```bash
npx tsc --noEmit -p tsconfig.server.json
```

Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/server/services/agent/types.ts web/src/types/agent.ts tests/server/services/agent/types.test.ts
git commit -m "feat: add agent types and LangChain dependencies"
```

---

### Task 2: SkillRegistry — Auto-Discover All SKILL.md Files

**Files:**
- Create: `src/server/services/agent/registry.ts`
- Test: `tests/server/services/agent/registry.test.ts`

**Interfaces:**
- Consumes: `ISkillRegistry` (from Task 1 types)
- Produces: `SkillRegistry` class, usable by AgentService

- [ ] **Step 1: Write failing test for SkillRegistry**

```typescript
// tests/server/services/agent/registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../../src/server/services/agent/registry';
import fs from 'fs';
import path from 'path';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('discovers SKILL.md files in a directory', async () => {
    const testDir = path.join(process.cwd(), 'skills');
    await registry.discover(testDir);
    const skills = registry.getAll();
    expect(skills.length).toBeGreaterThan(0);
  });

  it('parses frontmatter name and description', async () => {
    const testDir = path.join(process.cwd(), 'skills');
    await registry.discover(testDir);
    const skills = registry.getAll();
    // At least one skill should have a name from frontmatter
    const named = skills.filter(s => s.name.length > 0);
    expect(named.length).toBeGreaterThan(0);
  });

  it('excludes YAML frontmatter from content', async () => {
    const testDir = path.join(process.cwd(), 'skills');
    await registry.discover(testDir);
    const skills = registry.getAll();
    for (const skill of skills) {
      expect(skill.content).not.toMatch(/^---\n/);
    }
  });

  it('get returns undefined for unknown skill', async () => {
    const testDir = path.join(process.cwd(), 'skills');
    await registry.discover(testDir);
    expect(registry.get('nonexistent-skill')).toBeUndefined();
  });

  it('get returns skill by name', async () => {
    const testDir = path.join(process.cwd(), 'skills');
    await registry.discover(testDir);
    const skills = registry.getAll();
    if (skills.length > 0) {
      const found = registry.get(skills[0].name);
      expect(found).toBeDefined();
      expect(found?.name).toBe(skills[0].name);
    }
  });

  it('handles missing directory gracefully', async () => {
    const missingRegistry = new SkillRegistry();
    await missingRegistry.discover('/nonexistent/path');
    expect(missingRegistry.getAll()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server/services/agent/registry.test.ts -v
```

Expected: FAIL with "module not found" for registry.ts

- [ ] **Step 3: Implement SkillRegistry**

```typescript
// src/server/services/agent/registry.ts
import fs from 'fs';
import path from 'path';
import type { SkillRegistration, ISkillRegistry } from './types';

export class SkillRegistry implements ISkillRegistry {
  private skills: Map<string, SkillRegistration> = new Map();

  async discover(baseDir: string): Promise<void> {
    if (!fs.existsSync(baseDir)) {
      console.warn(`[SkillRegistry] Directory not found: ${baseDir}`);
      return;
    }
    const files = this.findSkillFiles(baseDir);
    for (const filePath of files) {
      try {
        const skill = this.parseSkillFile(filePath);
        this.skills.set(skill.name, skill);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[SkillRegistry] Failed to parse ${filePath}: ${message}`);
      }
    }
  }

  get(name: string): SkillRegistration | undefined {
    return this.skills.get(name);
  }

  getAll(): SkillRegistration[] {
    return Array.from(this.skills.values());
  }

  private findSkillFiles(baseDir: string): string[] {
    const results: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.name === 'SKILL.md') {
          results.push(fullPath);
        }
      }
    };
    walk(baseDir);
    return results;
  }

  private parseSkillFile(filePath: string): SkillRegistration {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { name, description, content } = this.extractFrontmatter(raw);

    if (!name) {
      throw new Error(`SKILL.md missing name field: ${filePath}`);
    }

    return {
      name,
      description: description || '',
      filePath,
      content,
      tools: [],
    };
  }

  private extractFrontmatter(raw: string): { name: string; description: string; content: string } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return { name: '', description: '', content: raw };
    }

    const yamlBlock = match[1];
    const body = match[2];

    const nameMatch = yamlBlock.match(/^name:\s*(.+)$/m);
    const descMatch = yamlBlock.match(/^description:\s*(.+)$/m);

    return {
      name: nameMatch ? nameMatch[1].trim() : '',
      description: descMatch ? descMatch[1].trim() : '',
      content: body.trim(),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/server/services/agent/registry.test.ts -v
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/agent/registry.ts tests/server/services/agent/registry.test.ts
git commit -m "feat: add SkillRegistry with auto-discovery of SKILL.md files"
```

---

### Task 3: LangChainChatModel Bridge

**Files:**
- Create: `src/server/services/agent/langchain-chat-model.ts`
- Test: `tests/server/services/agent/langchain-chat-model.test.ts`

**Interfaces:**
- Consumes: `ITextProviderAdapter`, `TextModelConfig` (from existing LLM system), `@langchain/core` types
- Produces: `LangChainChatModel extends BaseChatModel`, usable by DeepAgents

- [ ] **Step 1: Write failing test for LangChainChatModel**

```typescript
// tests/server/services/agent/langchain-chat-model.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LangChainChatModel } from '../../../src/server/services/agent/langchain-chat-model';
import type { ITextProviderAdapter, TextModelConfig, LLMResponse, StreamHandlers, Message } from '../../server/services/llm/types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('LangChainChatModel', () => {
  let mockAdapter: ITextProviderAdapter;
  let mockConfig: TextModelConfig;
  let model: LangChainChatModel;

  beforeEach(() => {
    mockAdapter = {
      sendMessage: vi.fn(),
      sendMessageStream: vi.fn(),
      getProvider: vi.fn(),
      getModels: vi.fn(),
      buildDefaultModel: vi.fn(),
      sendImageUnderstanding: vi.fn(),
      sendImageUnderstandingStream: vi.fn(),
    } as unknown as ITextProviderAdapter;

    mockConfig = {
      id: 'test-model',
      name: 'Test Model',
      enabled: true,
      providerMeta: { id: 'anthropic', name: 'Anthropic' } as any,
      modelMeta: {} as any,
      connectionConfig: { apiKey: 'test-key' },
    };

    model = new LangChainChatModel(mockConfig, mockAdapter);
  });

  it('converts LangChain messages and calls adapter.sendMessage', async () => {
    const mockResponse: LLMResponse = {
      content: 'Hello back!',
      metadata: { model: 'test-model' },
    };
    vi.mocked(mockAdapter.sendMessage).mockResolvedValue(mockResponse);

    const messages = [new HumanMessage('Hello')];
    const result = await model.invoke(messages);

    expect(mockAdapter.sendMessage).toHaveBeenCalled();
    expect(result.content).toBe('Hello back!');
  });

  it('streams tokens via adapter.sendMessageStream', async () => {
    vi.mocked(mockAdapter.sendMessageStream).mockImplementation(
      (_msgs: Message[], _cfg: TextModelConfig, callbacks: StreamHandlers) => {
        callbacks.onToken('Hel');
        callbacks.onToken('lo!');
        callbacks.onComplete({ content: 'Hello!', metadata: {} });
        return Promise.resolve();
      }
    );

    const messages = [new HumanMessage('Stream test')];
    const chunks: string[] = [];

    for await (const chunk of model._streamResponseChunks(messages, {})) {
      if (chunk.text) chunks.push(chunk.text);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('handles adapter errors in stream', async () => {
    vi.mocked(mockAdapter.sendMessageStream).mockImplementation(
      (_msgs: Message[], _cfg: TextModelConfig, callbacks: StreamHandlers) => {
        callbacks.onError(new Error('API timeout'));
        return Promise.resolve();
      }
    );

    const messages = [new HumanMessage('Test')];

    await expect(async () => {
      for await (const _ of model._streamResponseChunks(messages, {})) {
        // consume
      }
    }).rejects.toThrow('API timeout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server/services/agent/langchain-chat-model.test.ts -v
```

Expected: FAIL with "module not found"

- [ ] **Step 3: Implement LangChainChatModel**

```typescript
// src/server/services/agent/langchain-chat-model.ts
import {
  BaseChatModel,
  type BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import {
  type BaseLanguageModelInput,
  type StructuredOutputMethodOptions,
} from '@langchain/core/language_models/base';
import {
  type BaseMessage,
  AIMessage,
  type ChatGeneration,
  ChatGenerationChunk,
  type Runnable,
} from '@langchain/core/messages';
import type { ITextProviderAdapter, TextModelConfig, Message, StreamHandlers, LLMResponse } from '../llm/types';

export class LangChainChatModel extends BaseChatModel {
  private config: TextModelConfig;
  private adapter: ITextProviderAdapter;

  constructor(config: TextModelConfig, adapter: ITextProviderAdapter) {
    super({});
    this.config = config;
    this.adapter = adapter;
  }

  get _llmType(): string {
    return this.config.providerId || 'custom';
  }

  async _generate(
    messages: BaseMessage[],
    _options?: Record<string, unknown>
  ): Promise<ChatGeneration> {
    const converted = this.convertMessages(messages);
    const response = await this.adapter.sendMessage(converted, this.config);
    return this.buildGeneration(response);
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options?: Record<string, unknown>
  ): AsyncGenerator<ChatGenerationChunk> {
    const converted = this.convertMessages(messages);
    const chunks: string[] = [];

    await new Promise<void>((resolve, reject) => {
      this.adapter.sendMessageStream(converted, this.config, {
        onToken: (token: string) => {
          chunks.push(token);
        },
        onComplete: (_response?: LLMResponse) => {
          resolve();
        },
        onError: (err: Error) => {
          reject(err);
        },
      });
    });

    const fullText = chunks.join('');
    yield ChatGenerationChunk.from({ text: fullText, message: new AIMessage(fullText) });
  }

  _combineLLMOutput?(): Record<string, unknown> | undefined {
    return undefined;
  }

  // Implement required abstract methods
  override bindTools(_tools: Record<string, unknown>[], _kwargs?: Record<string, unknown>): Runnable<BaseLanguageModelInput, AIMessage, Record<string, unknown>> {
    throw new Error('bindTools not implemented in bridge layer');
  }

  override withStructuredOutput<
    RunOutputInput = Record<string, unknown>,
    RunOutput = Record<string, unknown>
  >(
    _outputSchema: Record<string, unknown>,
    _config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput, Record<string, unknown>> {
    throw new Error('withStructuredOutput not implemented in bridge layer');
  }

  private convertMessages(messages: BaseMessage[]): Message[] {
    return messages.map((msg) => {
      const role = this.mapRole(msg._getType());
      const content = typeof msg.content === 'string' ? msg.content : '';
      return { role, content };
    });
  }

  private mapRole(type: string): Message['role'] {
    switch (type) {
      case 'human':
        return 'user';
      case 'ai':
        return 'assistant';
      case 'system':
        return 'system';
      case 'tool':
        return 'tool';
      default:
        return 'user';
    }
  }

  private buildGeneration(response: LLMResponse): ChatGeneration {
    const message = new AIMessage(response.content);
    return { message, text: response.content } as ChatGeneration;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/server/services/agent/langchain-chat-model.test.ts -v
```

Expected: All 3 tests PASS

- [ ] **Step 5: Run TypeScript type check**

```bash
npx tsc --noEmit -p tsconfig.server.json
```

- [ ] **Step 6: Commit**

```bash
git add src/server/services/agent/langchain-chat-model.ts tests/server/services/agent/langchain-chat-model.test.ts
git commit -m "feat: add LangChainChatModel bridge to existing ITextProviderAdapter"
```

---

### Task 4: AgentService Core

**Files:**
- Create: `src/server/services/agent/service.ts`
- Test: `tests/server/services/agent/service.test.ts`

**Interfaces:**
- Consumes: `SkillRegistry` (Task 2), `LangChainChatModel` (Task 3), `IModelManager`, `ITextAdapterRegistry` (existing)
- Produces: `AgentService` class implementing `IAgentService`, with `createPlan`, `getPlan`, `runStep`

- [ ] **Step 1: Write failing tests for AgentService**

```typescript
// tests/server/services/agent/service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentService } from '../../../src/server/services/agent/service';
import { SkillRegistry } from '../../../src/server/services/agent/registry';
import type { IModelManager, ITextAdapterRegistry, TextModelConfig } from '../../server/services/llm/types';

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
    const events: any[] = [];
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server/services/agent/service.test.ts -v
```

Expected: FAIL with "module not found"

- [ ] **Step 3: Implement AgentService (phase 1 — plan management + stub execution)**

```typescript
// src/server/services/agent/service.ts
import { v4 as uuidv4 } from 'uuid';
import type { IModelManager, ITextAdapterRegistry } from '../llm/types';
import type {
  Plan,
  Step,
  CreatePlanRequest,
  RunStepRequest,
  AgentSSEEvent,
  IAgentService,
  ISkillRegistry,
} from './types';
import { SkillRegistry } from './registry';

export class AgentService implements IAgentService {
  private plans: Map<string, Plan> = new Map();

  constructor(
    private modelManager: IModelManager,
    private adapterRegistry: ITextAdapterRegistry,
    private skillRegistry: ISkillRegistry = new SkillRegistry(),
  ) {}

  async createPlan(req: CreatePlanRequest, onEvent: (e: AgentSSEEvent) => void): Promise<Plan> {
    const modelConfig = await this.modelManager.getModel(req.modelKey);
    if (!modelConfig) {
      const errorEvent: AgentSSEEvent = {
        type: 'plan_error',
        payload: { error: `Model config not found for key: ${req.modelKey}` },
      };
      onEvent(errorEvent);
      throw new Error(`Model config not found for key: ${req.modelKey}`);
    }

    // Phase 1: Generate a basic plan structure. In later phases this will use
    // LangChain ChatModel for LLM-based planning.
    const skills = this.skillRegistry.getAll();
    const planText = `Based on your request: "${req.userMessage}"\n\nAvailable skills: ${skills.map(s => s.name).join(', ') || 'none registered'}`;
    onEvent({ type: 'plan_token', payload: { token: planText } });

    const plan: Plan = {
      id: uuidv4(),
      userMessage: req.userMessage,
      providerId: req.providerId,
      modelKey: req.modelKey,
      status: 'pending_review',
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.plans.set(plan.id, plan);
    onEvent({ type: 'plan_complete', payload: { plan } });
    return plan;
  }

  getPlan(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  getAllPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  async runStep(stepId: string, req?: RunStepRequest, onEvent?: (e: AgentSSEEvent) => void): Promise<Step> {
    // Phase 1: find step in plans, validate status
    const step = this.findStep(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    if (step.status !== 'pending') {
      throw new Error(`Step ${stepId} is not pending (current status: ${step.status})`);
    }

    step.status = 'running';
    step.runAt = new Date().toISOString();

    if (onEvent) {
      onEvent({
        type: 'step_start',
        stepId,
        payload: { skillName: step.skillName, title: step.title },
      });
      onEvent({
        type: 'step_complete',
        stepId,
        payload: { output: `[Phase 1] Step "${step.title}" executed. Full sub-agent coming in Task 6.` },
      });
    }

    step.output = `[Phase 1] Step "${step.title}" executed.`;
    step.status = 'done';
    return step;
  }

  private findStep(stepId: string): Step | undefined {
    for (const plan of this.plans.values()) {
      const step = plan.steps.find(s => s.id === stepId);
      if (step) return step;
    }
    return undefined;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/server/services/agent/service.test.ts -v
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/agent/service.ts tests/server/services/agent/service.test.ts
git commit -m "feat: add AgentService core with plan management and stub execution"
```

---

### Task 5: API Routes & Server Wiring

**Files:**
- Create: `src/server/routes/agent.ts`
- Modify: `src/server/index.ts` (add agent route registration)
- Test: `tests/server/routes/agent.test.ts`

**Interfaces:**
- Consumes: `AgentService` (Task 4), Express Router
- Produces: `registerAgentRoutes(router, agentService)` function

- [ ] **Step 1: Write failing test for agent routes**

```typescript
// tests/server/routes/agent.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import { registerAgentRoutes } from '../../../src/server/routes/agent';
import type { AgentService } from '../../../src/server/services/agent/service';

function makeMockAgentService(): AgentService {
  return {
    createPlan: vi.fn().mockResolvedValue({
      id: 'plan-1',
      userMessage: 'test',
      providerId: 'anthropic',
      modelKey: 'test',
      status: 'pending_review',
      steps: [],
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
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

describe('Agent Routes', () => {
  let app: express.Express;
  let mockService: AgentService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mockService = makeMockAgentService();
    const router = express.Router();
    registerAgentRoutes(router, mockService);
    app.use('/api/v1/agent', router);
  });

  it('POST /agent/plan returns a plan', async () => {
    const res = await fetch('http://localhost/api/v1/agent/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: 'test', providerId: 'anthropic', modelKey: 'test' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.id).toBe('plan-1');
  });

  it('POST /agent/plan returns 400 without userMessage', async () => {
    const res = await fetch('http://localhost/api/v1/agent/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'anthropic', modelKey: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /agent/plan/:id returns plan', async () => {
    const res = await fetch('http://localhost/api/v1/agent/plan/plan-1');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.id).toBe('plan-1');
  });

  it('GET /agent/plan/:id returns 404 for missing plan', async () => {
    const res = await fetch('http://localhost/api/v1/agent/plan/nonexistent');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Implement agent routes**

```typescript
// src/server/routes/agent.ts
import { Router, Request, Response } from 'express';
import type { AgentService } from '../services/agent/service';

export function registerAgentRoutes(router: Router, agentService: AgentService) {
  // POST /agent/plan — SSE streaming plan generation
  router.post('/agent/plan', async (req: Request, res: Response) => {
    try {
      const { userMessage, providerId, modelKey } = req.body;
      if (!userMessage || !providerId || !modelKey) {
        res.status(400).json({ success: false, error: { message: 'userMessage, providerId, and modelKey are required' } });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      await agentService.createPlan({ userMessage, providerId, modelKey }, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      res.end();
    } catch (error: unknown) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      const message = error instanceof Error ? error.message : String(error);
      res.write(`data: ${JSON.stringify({ type: 'plan_error', payload: { error: message } })}\n\n`);
      res.end();
    }
  });

  // GET /agent/plan/:id — Query plan details
  router.get('/agent/plan/:id', (req: Request, res: Response) => {
    const plan = agentService.getPlan(req.params.id);
    if (!plan) {
      res.status(404).json({ success: false, error: { message: 'Plan not found' } });
      return;
    }
    res.json({ success: true, data: plan });
  });

  // POST /agent/step/:id/run — Trigger step execution (SSE)
  router.post('/agent/step/:id/run', async (req: Request, res: Response) => {
    try {
      const stepId = req.params.id;
      const { userAnswers } = req.body;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      await agentService.runStep(stepId, { userAnswers }, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      res.end();
    } catch (error: unknown) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      const message = error instanceof Error ? error.message : String(error);
      res.write(`data: ${JSON.stringify({ type: 'step_error', stepId: req.params.id, payload: { error: message } })}\n\n`);
      res.end();
    }
  });

  // GET /agent/skills — List registered skills
  router.get('/agent/skills', (_req: Request, res: Response) => {
    // Access skillRegistry through agentService or inject it separately
    // For now, return empty — Task 6 will wire this up properly
    res.json({ success: true, data: [] });
  });
}
```

- [ ] **Step 3: Wire agent routes into server entry point**

In `src/server/index.ts`, add the import and registration after existing route registrations:

```typescript
// Add near top with other route imports:
import { registerAgentRoutes } from './routes/agent';
import { AgentService } from './services/agent/service';

// After LLM Service setup (around line 81):
const agentService = new AgentService(modelManager, registry);

// In route registration section (around line 90):
registerAgentRoutes(router, agentService);
```

- [ ] **Step 4: Run test to verify routes pass**

```bash
npx vitest run tests/server/routes/agent.test.ts -v
```

Expected: All 4 tests PASS

- [ ] **Step 5: TypeScript type check**

```bash
npx tsc --noEmit -p tsconfig.server.json
```

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/agent.ts src/server/index.ts tests/server/routes/agent.test.ts
git commit -m "feat: add agent API routes and wire into server"
```

---

### Task 6: Full AgentService with LangChain Integration

**Files:**
- Modify: `src/server/services/agent/service.ts` (replace stub with real LangChain execution)

**Interfaces:**
- Consumes: `LangChainChatModel` (Task 3), `SkillRegistry` (Task 2)
- Produces: Real `createPlan` with LLM-based planning, real `runStep` with sub-agent execution

- [ ] **Step 1: Update AgentService to use LangChain for real planning**

Replace the stub `createPlan` with LangChain-based implementation:

```typescript
// In src/server/services/agent/service.ts — update imports
import { LangChainChatModel } from './langchain-chat-model';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// Replace createPlan body:
async createPlan(req: CreatePlanRequest, onEvent: (e: AgentSSEEvent) => void): Promise<Plan> {
  const modelConfig = await this.modelManager.getModel(req.modelKey);
  if (!modelConfig) {
    onEvent({ type: 'plan_error', payload: { error: `Model config not found for key: ${req.modelKey}` } });
    throw new Error(`Model config not found for key: ${req.modelKey}`);
  }

  const adapter = this.adapterRegistry.getAdapter(modelConfig.providerId || 'openai');
  const chatModel = new LangChainChatModel(modelConfig, adapter);
  const skills = this.skillRegistry.getAll();

  const skillsList = skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
  const systemPrompt = `You are a planning agent. Given a user request and a list of available skills, generate a structured execution plan.

Available skills:
${skillsList || 'No skills registered.'}

Respond with a JSON array of steps. Each step has: skillName, title, description.
Return ONLY valid JSON, no markdown, no explanation.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(req.userMessage),
  ];

  let fullText = '';
  try {
    // Stream for SSE
    for await (const chunk of chatModel._streamResponseChunks(messages, {})) {
      const token = chunk.text || '';
      fullText += token;
      onEvent({ type: 'plan_token', payload: { token } });
    }

    // Parse the plan
    let steps: Array<{ skillName: string; title: string; description: string }>;
    try {
      const jsonStr = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      steps = JSON.parse(jsonStr);
    } catch {
      steps = [{ skillName: '', title: 'Process request', description: req.userMessage }];
    }

    const plan: Plan = {
      id: uuidv4(),
      userMessage: req.userMessage,
      providerId: req.providerId,
      modelKey: req.modelKey,
      status: 'pending_review',
      steps: steps.map(s => ({
        id: uuidv4(),
        planId: '', // Will be set after plan creation
        skillName: s.skillName,
        title: s.title,
        description: s.description,
        status: 'pending' as const,
        output: null,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Set planId on all steps
    for (const step of plan.steps) {
      step.planId = plan.id;
    }

    this.plans.set(plan.id, plan);
    onEvent({ type: 'plan_complete', payload: { plan } });
    return plan;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    onEvent({ type: 'plan_error', payload: { error: message } });
    throw error;
  }
}
```

- [ ] **Step 2: Update runStep with real sub-agent execution**

```typescript
// Replace runStep body:
async runStep(stepId: string, req?: RunStepRequest, onEvent?: (e: AgentSSEEvent) => void): Promise<Step> {
  const step = this.findStep(stepId);
  if (!step) {
    throw new Error(`Step not found: ${stepId}`);
  }

  if (step.status !== 'pending') {
    throw new Error(`Step ${stepId} is not pending (current status: ${step.status})`);
  }

  const plan = this.plans.get(step.planId);
  if (!plan) {
    throw new Error(`Plan not found for step: ${stepId}`);
  }

  step.status = 'running';
  step.runAt = new Date().toISOString();

  if (onEvent) {
    onEvent({ type: 'step_start', stepId, payload: { skillName: step.skillName, title: step.title } });
  }

  try {
    const modelConfig = await this.modelManager.getModel(plan.modelKey);
    if (!modelConfig) {
      throw new Error(`Model config not found: ${plan.modelKey}`);
    }

    const adapter = this.adapterRegistry.getAdapter(modelConfig.providerId || 'openai');
    const chatModel = new LangChainChatModel(modelConfig, adapter);

    // Assemble system prompt
    const skillReg = this.skillRegistry.get(step.skillName);
    const skillContent = skillReg ? skillReg.content : `Skill "${step.skillName}" not found. Proceed with the task using your general knowledge.`;

    const priorSteps = plan.steps
      .filter(s => s.id !== stepId && s.status === 'done' && s.output)
      .map(s => `### ${s.title}\n${s.output}`)
      .join('\n\n');

    const userQuestions = req?.userAnswers
      ?.filter(q => q.answer)
      .map(q => `User answered "${q.question}": ${q.answer}`)
      .join('\n') || '';

    const systemPrompt = `${skillContent}

Original user request: ${plan.userMessage}
${priorSteps ? `Previous step outputs:\n${priorSteps}` : ''}
${userQuestions ? `User clarifications:\n${userQuestions}` : ''}

Execute the step: ${step.title}. ${step.description}`;

    // Stream execution
    let fullOutput = '';
    for await (const chunk of chatModel._streamResponseChunks(
      [new SystemMessage(systemPrompt), new HumanMessage(step.description)],
      {}
    )) {
      const token = chunk.text || '';
      fullOutput += token;
      if (onEvent) {
        onEvent({ type: 'step_token', stepId, payload: { token } });
      }
    }

    step.output = fullOutput;
    step.status = 'done';
    step.updatedAt = new Date().toISOString();

    if (onEvent) {
      onEvent({ type: 'step_complete', stepId, payload: { output: fullOutput } });
    }

    return step;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    step.error = message;
    step.status = 'failed';
    if (onEvent) {
      onEvent({ type: 'step_error', stepId, payload: { error: message } });
    }
    throw new Error(message);
  }
}
```

- [ ] **Step 3: Add missing `updatedAt` field to Step type**

Check `src/server/services/agent/types.ts` — if `Step` doesn't have `updatedAt`, add it:

```typescript
export interface Step {
  // ... existing fields ...
  updatedAt?: string;
}
```

- [ ] **Step 4: Run all agent tests**

```bash
npx vitest run tests/server/services/agent/ -v
```

Expected: All previous tests still pass

- [ ] **Step 5: TypeScript type check**

```bash
npx tsc --noEmit -p tsconfig.server.json
```

- [ ] **Step 6: Commit**

```bash
git add src/server/services/agent/service.ts src/server/services/agent/types.ts
git commit -m "feat: integrate LangChain into AgentService for real planning and execution"
```

---

### Task 7: Frontend — Agent Panel (Components + Composable + EventBus)

**Files:**
- Create: `web/src/components/agent/AgentPanel.vue`
- Create: `web/src/components/agent/AgentInput.vue`
- Create: `web/src/components/agent/PlanView.vue`
- Create: `web/src/components/agent/StepCard.vue`
- Create: `web/src/components/agent/StepOutput.vue`
- Create: `web/src/components/agent/UserQuestionDialog.vue`
- Create: `web/src/composables/useAgent.ts`
- Create: `web/src/utils/eventBus.ts`
- Create: `web/src/api/agent.ts`
- Modify: `web/src/components/NavSidebar.vue` (add Agent nav item)
- Modify: `web/src/App.vue` (add 'agent' view case)
- Modify: `web/src/stores/skills.ts` (add 'agent' to currentView type)

**Interfaces:**
- Consumes: `ApiClient` pattern from `web/src/api/api-client.ts`, `SkillInfo` type from Task 1
- Produces: Full Agent UI with SSE streaming

- [ ] **Step 1: Create EventBus utility**

```typescript
// web/src/utils/eventBus.ts
import type { AgentSSEHandlers } from '../types/agent';

type EventBusCallbacks = {
  onPlanToken: (token: string) => void;
  onPlanComplete: (plan: import('../types/agent').Plan) => void;
  onPlanError: (error: string) => void;
  onStepStart: (data: { stepId: string; skillName: string; title: string }) => void;
  onStepToken: (data: { stepId: string; token: string }) => void;
  onStepReasoning: (data: { stepId: string; reasoning: string }) => void;
  onStepToolUse: (data: { stepId: string; toolName: string; args: object }) => void;
  onStepToolResult: (data: { stepId: string; toolName: string; result: string }) => void;
  onStepAskUser: (data: { stepId: string; question: string }) => void;
  onStepComplete: (data: { stepId: string; output: string }) => void;
  onStepError: (data: { stepId: string; error: string }) => void;
};

export function createAgentEventBus(): EventBusCallbacks & {
  handlers: AgentSSEHandlers;
  parseSSELine: (line: string) => void;
} {
  const callbacks: Partial<EventBusCallbacks> = {};

  function on(event: keyof EventBusCallbacks, fn: Function) {
    callbacks[event] = fn;
  }

  function emit(event: keyof EventBusCallbacks, data: unknown) {
    callbacks[event]?.(data);
  }

  function parseSSELine(line: string) {
    if (!line.startsWith('data: ')) return;
    try {
      const data = JSON.parse(line.slice(6));
      const type = data.type;

      switch (type) {
        case 'plan_token':
          emit('onPlanToken', data.payload.token);
          break;
        case 'plan_complete':
          emit('onPlanComplete', data.payload.plan);
          break;
        case 'plan_error':
          emit('onPlanError', data.payload.error);
          break;
        case 'step_start':
          emit('onStepStart', { stepId: data.stepId, ...data.payload });
          break;
        case 'step_token':
          emit('onStepToken', { stepId: data.stepId, token: data.payload.token });
          break;
        case 'step_reasoning':
          emit('onStepReasoning', { stepId: data.stepId, reasoning: data.payload.reasoning });
          break;
        case 'step_tool_use':
          emit('onStepToolUse', { stepId: data.stepId, ...data.payload });
          break;
        case 'step_tool_result':
          emit('onStepToolResult', { stepId: data.stepId, ...data.payload });
          break;
        case 'step_ask_user':
          emit('onStepAskUser', { stepId: data.stepId, question: data.payload.question });
          break;
        case 'step_complete':
          emit('onStepComplete', { stepId: data.stepId, output: data.payload.output });
          break;
        case 'step_error':
          emit('onStepError', { stepId: data.stepId, error: data.payload.error });
          break;
      }
    } catch { /* skip malformed */ }
  }

  const handlers: AgentSSEHandlers = {
    onPlanToken: (t) => emit('onPlanToken', t),
    onPlanComplete: (p) => emit('onPlanComplete', p),
    onPlanError: (e) => emit('onPlanError', e),
    onStepStart: (d) => emit('onStepStart', d),
    onStepToken: (d) => emit('onStepToken', d),
    onStepReasoning: (d) => emit('onStepReasoning', d),
    onStepToolUse: (d) => emit('onStepToolUse', d),
    onStepToolResult: (d) => emit('onStepToolResult', d),
    onStepAskUser: (d) => emit('onStepAskUser', d),
    onStepComplete: (d) => emit('onStepComplete', d),
    onStepError: (d) => emit('onStepError', d),
  };

  return { ...callbacks as EventBusCallbacks, on, emit, handlers, parseSSELine };
}
```

- [ ] **Step 2: Create agent API client**

```typescript
// web/src/api/agent.ts
import type { Plan, SkillInfo, AgentSSEHandlers, UserQuestion } from '../types/agent';
import { createAgentEventBus } from '../utils/eventBus';

const API_BASE = '/api/v1';

export function createAgentApi() {
  return {
    createPlan(
      userMessage: string,
      providerId: string,
      modelKey: string,
      handlers: AgentSSEHandlers,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const bus = createAgentEventBus();

        // Wire handlers to event bus
        bus.handlers.onPlanToken = handlers.onPlanToken;
        bus.handlers.onPlanComplete = (plan) => { handlers.onPlanComplete(plan); resolve(); };
        bus.handlers.onPlanError = (error) => { handlers.onPlanError(error); reject(new Error(error)); };

        fetch(`${API_BASE}/agent/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage, providerId, modelKey }),
        })
          .then(async (res) => {
            if (!res.ok) {
              handlers.onPlanError(`HTTP ${res.status}`);
              reject(new Error(`HTTP ${res.status}`));
              return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
              handlers.onPlanError('No response body');
              reject(new Error('No response body'));
              return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                bus.parseSSELine(line);
              }
            }
          })
          .catch((err) => {
            handlers.onPlanError(err.message);
            reject(err);
          });
      });
    },

    getPlan(planId: string): Promise<Plan> {
      return fetch(`${API_BASE}/agent/plan/${planId}`)
        .then(r => r.json())
        .then(j => j.data);
    },

    runStep(
      stepId: string,
      userAnswers?: UserQuestion[],
      handlers?: Partial<AgentSSEHandlers>,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        fetch(`${API_BASE}/agent/step/${stepId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAnswers }),
        })
          .then(async (res) => {
            if (!res.ok) {
              reject(new Error(`HTTP ${res.status}`));
              return;
            }

            const reader = res.body?.getReader();
            if (!reader) { reject(new Error('No response body')); return; }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'step_complete') {
                      handlers?.onStepComplete?.(data.payload);
                      resolve();
                      return;
                    }
                    if (data.type === 'step_error') {
                      handlers?.onStepError?.(data.payload);
                      reject(new Error(data.payload.error));
                      return;
                    }
                    if (data.type === 'step_ask_user') {
                      handlers?.onStepAskUser?.(data.payload);
                    }
                    if (data.type === 'step_token') {
                      handlers?.onStepToken?.(data.payload);
                    }
                    if (data.type === 'step_reasoning') {
                      handlers?.onStepReasoning?.(data.payload);
                    }
                  } catch { /* skip malformed */ }
                }
              }
            }
          })
          .catch(reject);
      });
    },

    getSkills(): Promise<SkillInfo[]> {
      return fetch(`${API_BASE}/agent/skills`)
        .then(r => r.json())
        .then(j => j.data || []);
    },
  };
}
```

- [ ] **Step 3: Create useAgent composable**

```typescript
// web/src/composables/useAgent.ts
import { ref, reactive } from 'vue';
import type { Plan, Step, SkillInfo } from '../types/agent';
import { createAgentApi } from '../api/agent';

const api = createAgentApi();

const currentPlan = ref<Plan | null>(null);
const planTextBuffer = ref('');
const skills = ref<SkillInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const stepOutputs = reactive<Map<string, string>>(new Map());
const stepRunning = reactive<Map<string, boolean>>(new Map());

export function useAgent() {
  async function loadSkills() {
    try {
      skills.value = await api.getSkills();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load skills';
      error.value = msg;
    }
  }

  async function createPlan(userMessage: string, providerId: string, modelKey: string) {
    loading.value = true;
    error.value = null;
    planTextBuffer.value = '';
    currentPlan.value = null;

    try {
      await api.createPlan(userMessage, providerId, modelKey, {
        onPlanToken: (token) => {
          planTextBuffer.value += token;
        },
        onPlanComplete: (plan) => {
          currentPlan.value = plan;
          planTextBuffer.value = '';
          loading.value = false;
        },
        onPlanError: (err) => {
          error.value = err;
          loading.value = false;
        },
        onStepStart: () => {},
        onStepToken: () => {},
        onStepReasoning: () => {},
        onStepToolUse: () => {},
        onStepToolResult: () => {},
        onStepAskUser: () => {},
        onStepComplete: () => {},
        onStepError: () => {},
      });
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Plan creation failed';
      loading.value = false;
    }
  }

  async function runStep(step: Step) {
    stepRunning.set(step.id, true);
    stepOutputs.set(step.id, '');

    try {
      await api.runStep(step.id, undefined, {
        onStepToken: (data) => {
          const current = stepOutputs.get(step.id) || '';
          stepOutputs.set(step.id, current + data.token);
          step.status = 'running';
        },
        onStepComplete: (data) => {
          step.output = data.output;
          step.status = 'done';
          stepRunning.set(step.id, false);
        },
        onStepError: (data) => {
          step.error = data.error;
          step.status = 'failed';
          stepRunning.set(step.id, false);
        },
        onStepAskUser: (data) => {
          // This triggers UserQuestionDialog via event
          step.userQuestions = step.userQuestions || [];
          step.userQuestions.push({ question: data.question, answer: null });
          step.status = 'waiting_user';
          stepRunning.set(step.id, false);
        },
        onStepReasoning: () => {},
        onStepToolUse: () => {},
        onStepToolResult: () => {},
      });
    } catch (e: unknown) {
      step.error = e instanceof Error ? e.message : 'Step failed';
      step.status = 'failed';
      stepRunning.set(step.id, false);
    }
  }

  return {
    currentPlan,
    planTextBuffer,
    skills,
    loading,
    error,
    stepOutputs,
    stepRunning,
    loadSkills,
    createPlan,
    runStep,
  };
}
```

- [ ] **Step 4: Create AgentPanel.vue**

```vue
<!-- web/src/components/agent/AgentPanel.vue -->
<template>
  <div class="agent-panel">
    <h2 class="panel-title">Agent</h2>
    <AgentInput
      :skills="skills"
      :loading="loading"
      @create-plan="handleCreatePlan"
    />
    <div v-if="error" class="error-banner">{{ error }}</div>
    <PlanView
      v-if="currentPlan"
      :plan="currentPlan"
      :plan-buffer="planTextBuffer"
      @run-step="handleRunStep"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAgent } from '../../composables/useAgent'
import AgentInput from './AgentInput.vue'
import PlanView from './PlanView.vue'
import type { Step } from '../../types/agent'

const {
  currentPlan, planTextBuffer, skills, loading, error,
  loadSkills, createPlan, runStep,
} = useAgent()

onMounted(() => { loadSkills() })

async function handleCreatePlan(data: { message: string; providerId: string; modelKey: string }) {
  await createPlan(data.message, data.providerId, data.modelKey)
}

async function handleRunStep(step: Step) {
  await runStep(step)
}
</script>

<style scoped>
.agent-panel { padding: 20px; max-width: 900px; margin: 0 auto; }
.panel-title { font-size: 20px; margin-bottom: 16px; }
.error-banner { background: #fef0f0; color: #f56c6c; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; }
</style>
```

- [ ] **Step 5: Create AgentInput.vue**

```vue
<!-- web/src/components/agent/AgentInput.vue -->
<template>
  <div class="agent-input">
    <el-input
      v-model="message"
      type="textarea"
      :rows="3"
      :placeholder="$t('agent.inputPlaceholder')"
      @keydown.ctrl.enter="submit"
    />
    <div class="input-controls">
      <el-select v-model="providerId" :placeholder="$t('agent.selectProvider')" size="small" class="provider-select">
        <el-option v-for="skill in skills" :key="skill.name" :label="skill.name" :value="skill.name" />
      </el-select>
      <el-input v-model="modelKey" :placeholder="$t('agent.modelKey')" size="small" class="model-input" />
      <el-button type="primary" :loading="loading" @click="submit">{{ $t('agent.generatePlan') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SkillInfo } from '../../types/agent'

defineProps<{ skills: SkillInfo[]; loading: boolean }>()
const emit = defineEmits<{ 'create-plan': [data: { message: string; providerId: string; modelKey: string }] }>()

const message = ref('')
const providerId = ref('anthropic')
const modelKey = ref('')

function submit() {
  if (!message.value || !providerId.value || !modelKey.value) return
  emit('create-plan', { message: message.value, providerId: providerId.value, modelKey: modelKey.value })
}
</script>

<style scoped>
.agent-input { margin-bottom: 20px; }
.input-controls { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.provider-select { width: 180px; }
.model-input { width: 200px; }
</style>
```

- [ ] **Step 6: Create PlanView.vue**

```vue
<!-- web/src/components/agent/PlanView.vue -->
<template>
  <div class="plan-view">
    <!-- Streaming text during planning -->
    <div v-if="plan.status === 'planning' && planBuffer" class="plan-buffer">
      <pre>{{ planBuffer }}</pre>
    </div>

    <!-- Structured plan -->
    <div v-if="plan.status === 'pending_review' || plan.status === 'executing'" class="plan-steps">
      <h3>{{ $t('agent.planTitle') }}</h3>
      <StepCard
        v-for="step in plan.steps"
        :key="step.id"
        :step="step"
        :output="stepOutputs.get(step.id)"
        @run="$emit('run-step', step)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plan, Step } from '../../types/agent'
import StepCard from './StepCard.vue'

defineProps<{ plan: Plan; planBuffer: string }>()
defineEmits<{ 'run-step': [step: Step] }>()
</script>

<style scoped>
.plan-buffer { background: #1a1a2e; color: #eee; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; margin-bottom: 16px; }
.plan-steps h3 { margin-bottom: 12px; }
</style>
```

- [ ] **Step 7: Create StepCard.vue**

```vue
<!-- web/src/components/agent/StepCard.vue -->
<template>
  <div class="step-card" :class="step.status">
    <div class="step-header">
      <span class="step-title">{{ step.title }}</span>
      <span class="step-status">{{ statusLabel }}</span>
    </div>
    <div class="step-desc">{{ step.description }}</div>
    <div class="step-actions">
      <el-button
        v-if="step.status === 'pending'"
        size="small"
        type="primary"
        @click="$emit('run')"
      >▶</el-button>
      <el-tag v-if="step.status === 'running'" type="warning" size="small">{{ $t('agent.running') }}</el-tag>
      <el-tag v-if="step.status === 'done'" type="success" size="small">{{ $t('agent.done') }}</el-tag>
      <el-tag v-if="step.status === 'failed'" type="danger" size="small">{{ $t('agent.failed') }}</el-tag>
      <el-tag v-if="step.status === 'waiting_user'" type="info" size="small">{{ $t('agent.waitingUser') }}</el-tag>
    </div>
    <StepOutput v-if="step.status !== 'pending'" :step-id="step.id" :output="output ?? ''" :error="step.error" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Step } from '../../types/agent'
import StepOutput from './StepOutput.vue'

const props = defineProps<{ step: Step; output?: string }>()
defineEmits<{ run: [] }>()

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: 'Pending',
    running: 'Running...',
    done: 'Done',
    failed: 'Failed',
    waiting_user: 'Waiting for you',
  };
  return labels[props.step.status] || props.step.status;
})
</script>

<style scoped>
.step-card { border: 1px solid #e4e7ed; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.step-card.pending { border-left: 3px solid #909399; }
.step-card.running { border-left: 3px solid #e6a23c; }
.step-card.done { border-left: 3px solid #67c23a; }
.step-card.failed { border-left: 3px solid #f56c6c; }
.step-card.waiting_user { border-left: 3px solid #409eff; }
.step-header { display: flex; justify-content: space-between; align-items: center; }
.step-title { font-weight: 600; }
.step-status { font-size: 12px; color: #909399; }
.step-desc { font-size: 13px; color: #606266; margin: 4px 0 8px; }
.step-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
</style>
```

- [ ] **Step 8: Create StepOutput.vue**

```vue
<!-- web/src/components/agent/StepOutput.vue -->
<template>
  <div class="step-output">
    <div v-if="error" class="error-text">{{ error }}</div>
    <div v-else-if="output" class="output-text">
      <pre>{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ stepId: string; output: string; error?: string }>()
</script>

<style scoped>
.step-output { margin-top: 8px; }
.output-text pre { background: #f5f7fa; padding: 8px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
.error-text { color: #f56c6c; font-size: 13px; }
</style>
```

- [ ] **Step 9: Create UserQuestionDialog.vue**

```vue
<!-- web/src/components/agent/UserQuestionDialog.vue -->
<template>
  <el-dialog :model-value="visible" :title="$t('agent.questionTitle')" width="400px" @close="$emit('close')">
    <p>{{ question }}</p>
    <el-input v-model="answer" type="textarea" :rows="3" :placeholder="$t('agent.answerPlaceholder')" />
    <template #footer>
      <el-button @click="$emit('close')">{{ $t('agent.cancel') }}</el-button>
      <el-button type="primary" @click="submit">{{ $t('agent.submit') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ visible: boolean; question: string }>()
const emit = defineEmits<{ close: []; submit: [answer: string] }>()
const answer = ref('')

function submit() {
  emit('submit', answer.value)
  answer.value = ''
}
</script>
```

- [ ] **Step 10: Wire Agent into NavSidebar**

In `web/src/components/NavSidebar.vue`, add the Agent nav item:

```vue
<!-- Add after the manage menu item, before </el-menu> -->
<el-menu-item index="agent"><el-icon><Monitor /></el-icon><span>{{ $t('nav.agent') }}</span></el-menu-item>
```

Add to imports:
```typescript
import { Document, FolderOpened, EditPen, Setting, Monitor } from '@element-plus/icons-vue'
```

Add to `handleMenuSelect`:
```typescript
} else if (index === 'agent') {
  store.setView('agent')
}
```

- [ ] **Step 11: Wire Agent into App.vue**

In `web/src/App.vue`, add the agent view case:

```vue
<template v-else-if="store.currentView === 'agent'"><AgentPanel /></template>
```

Add import:
```typescript
import AgentPanel from './components/agent/AgentPanel.vue'
```

- [ ] **Step 12: Update skills store currentView type**

In `web/src/stores/skills.ts`, update the `currentView` type to include `'agent'`:

```typescript
currentView: 'list' | 'detail' | 'editor' | 'manage' | 'prompt' | 'promptMaintenance' | 'agent',
```

And update `setView`:
```typescript
setView(v: 'list' | 'detail' | 'editor' | 'manage' | 'prompt' | 'promptMaintenance' | 'agent') { this.currentView = v },
```

- [ ] **Step 13: Add i18n strings for Agent**

Add to both `web/src/i18n/locales/en.ts` (or wherever the locale files are) and `web/src/i18n/locales/zh-CN.ts`:

```typescript
// In the nav section:
'nav.agent': 'Agent',

// New agent section:
'agent': {
  'inputPlaceholder': 'Describe what you want to do...',
  'selectProvider': 'Select Provider',
  'modelKey': 'Model Key',
  'generatePlan': 'Generate Plan',
  'planTitle': 'Execution Plan',
  'running': 'Running...',
  'done': 'Done',
  'failed': 'Failed',
  'waitingUser': 'Waiting for you',
  'questionTitle': 'Agent Question',
  'answerPlaceholder': 'Your answer...',
  'cancel': 'Cancel',
  'submit': 'Submit',
}
```

- [ ] **Step 14: Frontend type check**

```bash
npx vue-tsc --noEmit
```

- [ ] **Step 15: Build and verify**

```bash
npm run build:server
```

- [ ] **Step 16: Commit**

```bash
git add web/src/components/agent/ web/src/composables/useAgent.ts web/src/utils/eventBus.ts web/src/api/agent.ts web/src/components/NavSidebar.vue web/src/App.vue web/src/stores/skills.ts web/src/i18n/
git commit -m "feat: add AgentPanel with SSE streaming, step execution, and i18n"
```

---

### Task 8: Update Routes to Return Registered Skills

**Files:**
- Modify: `src/server/routes/agent.ts` (wire SkillRegistry into skills endpoint)

**Interfaces:**
- Consumes: `SkillRegistry` (Task 2), `AgentService` (Task 4/6)
- Produces: Working `GET /agent/skills` endpoint

- [ ] **Step 1: Update registerAgentRoutes to accept SkillRegistry**

```typescript
// src/server/routes/agent.ts — update function signature
import type { SkillRegistry } from '../services/agent/registry';

export function registerAgentRoutes(router: Router, agentService: AgentService, skillRegistry: SkillRegistry) {
  // ... existing routes ...

  // GET /agent/skills — update to return actual skills
  router.get('/agent/skills', (_req: Request, res: Response) => {
    const skills = skillRegistry.getAll().map(s => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
    }));
    res.json({ success: true, data: skills });
  });
}
```

- [ ] **Step 2: Update server entry point to pass SkillRegistry**

In `src/server/index.ts`, update the route registration:

```typescript
const skillRegistry = new SkillRegistry();
skillRegistry.discover(path.join(projectRoot, 'skills'));

registerAgentRoutes(router, agentService, skillRegistry);
```

- [ ] **Step 3: Verify TypeScript check**

```bash
npx tsc --noEmit -p tsconfig.server.json
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routes/agent.ts src/server/index.ts
git commit -m "feat: wire SkillRegistry into agent routes for skill listing"
```

---

### Task 9: Integration Testing & Full-Stack Verification

**Files:**
- No new files
- Test: Manual end-to-end verification + existing test suite

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass, no regressions

- [ ] **Step 2: Full TypeScript check**

```bash
npx tsc --noEmit -p tsconfig.server.json && npx vue-tsc --noEmit
```

Expected: No new errors

- [ ] **Step 3: Start server and verify /agent/skills**

```bash
npm run build:server
# Start server, then:
curl http://localhost:PORT/api/v1/agent/skills
```

Expected: JSON array of registered skills

- [ ] **Step 4: Test plan generation**

```bash
curl -X POST http://localhost:PORT/api/v1/agent/plan \
  -H 'Content-Type: application/json' \
  -d '{"userMessage":"帮我优化 openspec 的工作流","providerId":"anthropic","modelKey":"test"}'
```

Expected: SSE stream with plan text, then plan_complete event

- [ ] **Step 5: Verify existing LLM endpoints still work**

```bash
curl http://localhost:PORT/api/v1/llm/providers
```

Expected: List of providers (unchanged)

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: verify integration — all tests pass, no regressions"
```
