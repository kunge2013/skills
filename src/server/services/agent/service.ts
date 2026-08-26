// [AGC:FILE] tool=Cc author=fangkun date=2026-08-26
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
// Use dynamic import() for pi-coding-agent (ESM-only package)
// Type-only imports are erased at compile time and safe here
import type { AgentSession, AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import type { AssistantMessageEventStream } from '@earendil-works/pi-ai';
import type { IModelManager } from '../llm/service';
import type { ITextAdapterRegistry } from '../llm/types';
import type { TextModelConfig } from '../llm/types';
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
import { createLogger } from '../../utils/logger';

// [AGC:START] tool=Cc author=fangkun
const logger = createLogger('pi-sdk');
const agentLogger = createLogger('agent');

// Lazy-load the ESM-only pi SDK at runtime via dynamic import
let _piSdk: typeof import('@earendil-works/pi-coding-agent') | null = null;

async function loadPiSdk(): Promise<typeof import('@earendil-works/pi-coding-agent')> {
  logger.debug('Loading pi-coding-agent SDK...');
  if (!_piSdk) {
    _piSdk = await import('@earendil-works/pi-coding-agent');
  }
  logger.debug('SDK loaded successfully');
  return _piSdk;
}

/**
 * Map our provider IDs to pi's KnownProvider names.
 * Most align directly; only a few need translation.
 */
function mapProviderId(providerId: string): string {
  switch (providerId) {
    case 'gemini':
      return 'google';
    case 'deepseek':
      return 'deepseek';
    default:
      return providerId;
  }
}

/**
 * Create a custom stream function for calling APIs with custom baseURL.
 * This allows pi SDK to work with non-standard endpoints.
 */
function createCustomStreamFunction(
  apiType: 'openai' | 'anthropic',
  baseURL: string,
  apiKey: string,
  modelId: string,
  providerName: string,
) {
  return async (model: any, context: any): Promise<AssistantMessageEventStream> => {
    const { createAssistantMessageEventStream } = await import('@earendil-works/pi-ai');
    const stream = createAssistantMessageEventStream();

    // Convert pi messages to API format
    const messages: any[] = [];
    if (context.systemPrompt) {
      messages.push({ role: 'system', content: context.systemPrompt });
    }
    for (const msg of context.messages || []) {
      if (msg.role === 'user') {
        const textParts = msg.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text) || [];
        messages.push({ role: 'user', content: textParts.join('\n') });
      } else if (msg.role === 'assistant') {
        const textParts = msg.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text) || [];
        messages.push({ role: 'assistant', content: textParts.join('\n') });
      }
    }

    let fullText = '';
    const startTime = Date.now();

    try {
      if (apiType === 'anthropic') {
        const client = new Anthropic({ apiKey, baseURL });
        const response = await client.messages.create({
          model: modelId,
          max_tokens: 4096,
          messages: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content,
          })),
          system: context.systemPrompt,
          stream: true,
        });

        stream.push({
          type: 'start',
          partial: {
            role: 'assistant',
            content: [],
            api: apiType,
            provider: providerName,
            model: modelId,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: 'stop',
            timestamp: startTime,
          },
        });

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const delta = event.delta.text;
            fullText += delta;
            stream.push({
              type: 'text_delta',
              contentIndex: 0,
              delta,
              partial: {
                role: 'assistant',
                content: [{ type: 'text', text: fullText }],
                api: apiType,
                provider: providerName,
                model: modelId,
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
                stopReason: 'stop',
                timestamp: startTime,
              },
            });
          }
        }
      } else {
        // OpenAI compatible
        const client = new OpenAI({ apiKey, baseURL });
        const response = await client.chat.completions.create({
          model: modelId,
          messages,
          stream: true,
        });

        stream.push({
          type: 'start',
          partial: {
            role: 'assistant',
            content: [],
            api: apiType,
            provider: providerName,
            model: modelId,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: 'stop',
            timestamp: startTime,
          },
        });

        for await (const chunk of response) {
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            stream.push({
              type: 'text_delta',
              contentIndex: 0,
              delta,
              partial: {
                role: 'assistant',
                content: [{ type: 'text', text: fullText }],
                api: apiType,
                provider: providerName,
                model: modelId,
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
                stopReason: 'stop',
                timestamp: startTime,
              },
            });
          }
        }
      }

      stream.end({
        role: 'assistant',
        content: [{ type: 'text', text: fullText }],
        api: apiType,
        provider: providerName,
        model: modelId,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: 'stop',
        timestamp: Date.now(),
      });
    } catch (error: unknown) {
      logger.error('Custom stream error', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      stream.end({
        role: 'assistant',
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        api: apiType,
        provider: providerName,
        model: modelId,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: 'error',
        errorMessage: errorMessage,
        timestamp: Date.now(),
      });
    }

    return stream;
  };
}

/**
 * Build a pi AgentSession configured from an existing TextModelConfig.
 * Uses in-memory auth + model registry with runtime API key override.
 */
async function createPiSession(
  modelConfig: TextModelConfig,
  systemPrompt: string,
): Promise<AgentSession> {
  logger.debug('Creating session for model', { modelId: modelConfig.id, provider: modelConfig.providerId });
  const { AuthStorage, ModelRegistry, SessionManager, DefaultResourceLoader, getAgentDir, createAgentSession } =
    await loadPiSdk();

  const authStorage = AuthStorage.create();
  const apiKey = modelConfig.connectionConfig?.apiKey;
  const baseURL = modelConfig.connectionConfig?.baseURL;

  const modelRegistry = ModelRegistry.create(authStorage);

  // Try to find the exact model in built-in models
  const piProvider = mapProviderId(modelConfig.providerId || 'openai');
  const modelId = modelConfig.modelId || modelConfig.id;
  let model = modelRegistry.find(piProvider, modelId);

  if (!model && baseURL) {
    // Custom model with custom baseURL - register it as a custom provider with custom stream function
    if (!apiKey) {
      throw new Error(`Model "${modelConfig.id}" has no API key configured. Please set the API key in model settings.`);
    }
    // Determine API type from protocol
    const protocol = modelConfig.protocol || (modelConfig.providerId === 'anthropic' ? 'anthropic' : 'openai');
    const apiType = protocol === 'anthropic' ? 'anthropic' : 'openai';
    logger.debug('Registering custom provider', { provider: piProvider, baseURL, api: apiType });
    const customProviderName = `custom-${piProvider}-${modelId}`;

    // Create custom stream function for this provider
    const streamFn = createCustomStreamFunction(apiType, baseURL, apiKey, modelId, customProviderName);

    modelRegistry.registerProvider(customProviderName, {
      name: modelConfig.name || customProviderName,
      baseUrl: baseURL,
      apiKey: apiKey,
      api: apiType as 'openai' | 'anthropic',
      streamSimple: streamFn as any, // Use our custom API call logic
      models: [{
        id: modelId,
        name: modelConfig.name || modelId,
        api: apiType as 'openai' | 'anthropic',
        baseUrl: baseURL,
        reasoning: modelConfig.modelMeta?.capabilities?.supportsReasoning || false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: modelConfig.modelMeta?.capabilities?.maxContextLength || 128000,
        maxTokens: 4096,
      }],
    });

    model = modelRegistry.find(customProviderName, modelId);
    logger.debug('Custom model registered', { modelId: model?.id });
  } else if (!model) {
    logger.warn('Model not found, checking available models');
    const available = modelRegistry.getAvailable();
    logger.debug('Available models', { models: available.map(m => `${m.provider}/${m.id}`).join(', ') });
    model = available.find(
      (m) => m.id === modelId || m.id.includes(modelId),
    ) ?? available[0];
  }

  if (apiKey) {
    // Set runtime API key for the provider being used
    const providerForKey = model?.provider || piProvider;
    logger.debug('Setting API key for provider', { provider: providerForKey });
    authStorage.setRuntimeApiKey(providerForKey, apiKey);
  }

  logger.info('Using model', { model: `${model?.provider}/${model?.id}` });

  // Use DefaultResourceLoader to override the system prompt
  logger.debug('Creating resource loader');
  const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    systemPromptOverride: () => systemPrompt,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  logger.debug('Reloading resources');
  await loader.reload();
  logger.debug('Resources loaded');

  logger.debug('Creating agent session');
  const { session } = await createAgentSession({
    model,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    resourceLoader: loader,
    noTools: 'all',
  });
  logger.debug('Agent session created');

  return session;
}

/**
 * Collect streaming output from a pi session into text,
 * forwarding SSE events to the caller.
 */
async function collectSessionOutput(
  session: AgentSession,
  prompt: string,
  onEvent: (e: AgentSSEEvent) => void,
): Promise<{ fullText: string; reasoningText: string }> {
  logger.debug('Collecting output', { prompt: prompt.substring(0, 50) + '...' });
  let fullText = '';
  let reasoningText = '';

  session.subscribe((event: AgentSessionEvent) => {
    // Extract text from message_end events (assistant messages)
    if (event.type === 'message_end') {
      const msg = (event as any).message;
      if (msg?.role === 'assistant' && msg?.content) {
        const textContent = msg.content.find((c: any) => c.type === 'text');
        if (textContent?.text) {
          fullText = textContent.text;
          logger.debug('Extracted assistant text', { length: fullText.length });
          onEvent({ event: 'content', data: { token: fullText } });
        }
      }
    }

    // Also handle message_update for streaming text_delta (if supported)
    if (event.type === 'message_update') {
      const ame = (event as any).assistantMessageEvent;
      if (ame?.type === 'text_delta' && ame.delta) {
        fullText += ame.delta;
        onEvent({ event: 'content', data: { token: ame.delta } });
      } else if (ame?.type === 'thinking_delta' && ame.delta) {
        reasoningText += ame.delta;
        onEvent({ event: 'reasoning', data: { token: ame.delta } });
      }
    }

    if (event.type === 'tool_execution_start') {
      onEvent({
        event: 'tool_use',
        data: { tool: (event as { toolName?: string }).toolName || '' },
      });
    }
    if (event.type === 'tool_execution_end') {
      onEvent({
        event: 'tool_result',
        data: {
          tool: (event as { toolName?: string }).toolName || '',
          isError: (event as { isError?: boolean }).isError || false,
        },
      });
    }
  });

  await session.prompt(prompt);
  logger.debug('session.prompt() completed');

  // Fallback: if reasoning wasn't streamed but is embedded in the text
  if (!reasoningText && fullText.includes('<thinking>')) {
    const match = fullText.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (match) {
      reasoningText = match[1].trim();
      fullText = fullText.replace(/<thinking>[\s\S]*?<\/thinking>\s*/, '').trim();
    }
  }

  logger.debug('Output collected', { fullTextLength: fullText.length });
  return { fullText, reasoningText };
}
// [AGC:END]

export class AgentService implements IAgentService {
  private plans: Map<string, Plan> = new Map();

  constructor(
    private modelManager: IModelManager,
    private adapterRegistry: ITextAdapterRegistry,
    private skillRegistry: ISkillRegistry = new SkillRegistry(),
  ) {}

  // [AGC:START] tool=Cc author=fangkun
  async createPlan(req: CreatePlanRequest, onEvent: (e: AgentSSEEvent) => void): Promise<Plan> {
    agentLogger.info('createPlan called', { modelKey: req.modelKey });
    const modelConfig = await this.modelManager.getModel(req.modelKey);
    if (!modelConfig) {
      const errorEvent: AgentSSEEvent = {
        event: 'error',
        data: { error: `Model config not found for key: ${req.modelKey}` },
      };
      onEvent(errorEvent);
      throw new Error(`Model config not found for key: ${req.modelKey}`);
    }

    const skills = this.skillRegistry.getAll();
    const skillsList = skills.map((s) => `- ${s.name}: ${s.description}`).join('\n');
    const systemPrompt = `You are a helpful AI assistant. Answer the user's question directly and helpfully.

Available skills you can use:
${skillsList || 'No skills registered.'}

If the user's request matches a skill, use that skill's expertise. Otherwise answer directly.`;

    const session = await createPiSession(modelConfig, systemPrompt);
    try {
      const { fullText, reasoningText } = await collectSessionOutput(
        session,
        req.userMessage,
        onEvent,
      );

      let steps: Array<{ skillName: string; title: string; description: string }>;
      try {
        const jsonStr = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        steps = JSON.parse(jsonStr) as Array<{ skillName: string; title: string; description: string }>;
      } catch {
        steps = [{ skillName: '', title: 'Response', description: req.userMessage }];
      }

      const planId = uuidv4();
      const now = new Date().toISOString();
      const planSteps: Step[] = steps.map((s) => ({
        id: uuidv4(),
        planId,
        skillName: s.skillName,
        title: s.title,
        description: s.description,
        status: 'pending' as const,
        output: null,
      }));

      const plan: Plan = {
        id: planId,
        userMessage: req.userMessage,
        responseText: fullText,
        reasoning: reasoningText,
        providerId: req.providerId || '',
        modelKey: req.modelKey,
        status: 'pending_review',
        steps: planSteps,
        createdAt: now,
        updatedAt: now,
      };

      this.plans.set(plan.id, plan);
      onEvent({
        event: 'complete',
        data: { content: fullText, reasoning: reasoningText || undefined, plan },
      });
      return plan;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      onEvent({ event: 'error', data: { error: message } });
      throw error;
    } finally {
      session.dispose();
    }
  }
  // [AGC:END]

  getPlan(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  getAllPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  // [AGC:START] tool=Cc author=fangkun
  async runStep(stepId: string, req?: RunStepRequest, onEvent?: (e: AgentSSEEvent) => void): Promise<Step> {
    const { plan, step } = this.findStepWithPlan(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    if (step.status !== 'pending') {
      throw new Error(`Step ${stepId} is not pending (current status: ${step.status})`);
    }

    if (!plan) {
      throw new Error(`Plan not found for step: ${stepId}`);
    }

    const runningStep: Step = { ...step, status: 'running', runAt: new Date().toISOString() };

    if (onEvent) {
      onEvent({
        event: 'step_start',
        data: { stepId, skillName: runningStep.skillName, title: runningStep.title },
      });
    }

    const noopEvent = (_e: AgentSSEEvent) => {};
    const emit = onEvent ?? noopEvent;

    try {
      const modelConfig = await this.modelManager.getModel(plan.modelKey);
      if (!modelConfig) {
        throw new Error(`Model config not found: ${plan.modelKey}`);
      }

      const skillReg = this.skillRegistry.get(step.skillName);
      const skillContent = skillReg
        ? skillReg.content
        : `Skill "${step.skillName}" not found. Proceed with the task using your general knowledge.`;

      const priorSteps = plan.steps
        .filter((s) => s.id !== stepId && s.status === 'done' && s.output)
        .map((s) => `### ${s.title}\n${s.output}`)
        .join('\n\n');

      const userQuestions =
        req?.userAnswers
          ?.filter((q) => q.answer)
          .map((q) => `User answered "${q.question}": ${q.answer}`)
          .join('\n') || '';

      const systemPrompt = `${skillContent}

Original user request: ${plan.userMessage}
${priorSteps ? `Previous step outputs:\n${priorSteps}` : ''}
${userQuestions ? `User clarifications:\n${userQuestions}` : ''}

Execute the step: ${step.title}. ${step.description}`;

      const session = await createPiSession(modelConfig, systemPrompt);
      try {
        const { fullText } = await collectSessionOutput(session, step.description, emit);

        const doneStep: Step = {
          ...runningStep,
          output: fullText,
          status: 'done',
          updatedAt: new Date().toISOString(),
        };

        emit({ event: 'complete', data: { content: fullText } });

        const updatedPlan: Plan = {
          ...plan,
          steps: plan.steps.map((s) => (s.id === stepId ? doneStep : s)),
          updatedAt: new Date().toISOString(),
        };
        this.plans.set(updatedPlan.id, updatedPlan);

        return doneStep;
      } finally {
        session.dispose();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const failedStep: Step = { ...runningStep, error: message, status: 'failed' };
      emit({ event: 'error', data: { error: message } });
      const updatedPlan: Plan = {
        ...plan,
        steps: plan.steps.map((s) => (s.id === stepId ? failedStep : s)),
        updatedAt: new Date().toISOString(),
      };
      this.plans.set(updatedPlan.id, updatedPlan);
      throw error instanceof Error ? error : new Error(message);
    }
  }
  // [AGC:END]

  private findStepWithPlan(stepId: string): { plan: Plan | undefined; step: Step | undefined } {
    for (const plan of this.plans.values()) {
      const step = plan.steps.find((s) => s.id === stepId);
      if (step) return { plan, step };
    }
    return { plan: undefined, step: undefined };
  }
}
