import { v4 as uuidv4 } from 'uuid';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { IModelManager } from '../llm/service';
import type { ITextAdapterRegistry } from '../llm/types';
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
import { LangChainChatModel } from './langchain-chat-model';

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

    const adapter = this.adapterRegistry.getAdapter(modelConfig.providerId || 'openai');
    const chatModel = new LangChainChatModel(modelConfig, adapter);
    const skills = this.skillRegistry.getAll();

    const skillsList = skills.map((s) => `- ${s.name}: ${s.description}`).join('\n');
    const systemPrompt = `You are a helpful AI assistant. Answer the user's question directly and helpfully.

Available skills you can use:
${skillsList || 'No skills registered.'}

If the user's request matches a skill, use that skill's expertise. Otherwise answer directly.`;

    const messages = [new SystemMessage(systemPrompt), new HumanMessage(req.userMessage)];
    let fullText = '';
    try {
      for await (const chunk of chatModel._streamResponseChunks(messages, {})) {
        const token = chunk.text || '';
        fullText += token;
        onEvent({ type: 'plan_token', payload: { token } });
      }

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
        providerId: req.providerId || '',
        modelKey: req.modelKey,
        status: 'pending_review',
        steps: planSteps,
        createdAt: now,
        updatedAt: now,
      };

      this.plans.set(plan.id, plan);
      onEvent({ type: 'plan_complete', payload: { plan } });
      return plan;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      onEvent({ type: 'plan_error', payload: { error: message } });
      throw error;
    }
  }

  getPlan(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  getAllPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

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
        type: 'step_start',
        stepId,
        payload: { skillName: runningStep.skillName, title: runningStep.title },
      });
    }

    try {
      const modelConfig = await this.modelManager.getModel(plan.modelKey);
      if (!modelConfig) {
        throw new Error(`Model config not found: ${plan.modelKey}`);
      }

      const adapter = this.adapterRegistry.getAdapter(modelConfig.providerId || 'openai');
      const chatModel = new LangChainChatModel(modelConfig, adapter);

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

      let fullOutput = '';
      for await (const chunk of chatModel._streamResponseChunks(
        [new SystemMessage(systemPrompt), new HumanMessage(step.description)],
        {},
      )) {
        const token = chunk.text || '';
        fullOutput += token;
        if (onEvent) {
          onEvent({ type: 'step_token', stepId, payload: { token } });
        }
      }

      const doneStep: Step = {
        ...runningStep,
        output: fullOutput,
        status: 'done',
        updatedAt: new Date().toISOString(),
      };

      if (onEvent) {
        onEvent({ type: 'step_complete', stepId, payload: { output: fullOutput } });
      }

      const updatedPlan: Plan = {
        ...plan,
        steps: plan.steps.map((s) => (s.id === stepId ? doneStep : s)),
        updatedAt: new Date().toISOString(),
      };
      this.plans.set(updatedPlan.id, updatedPlan);

      return doneStep;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const failedStep: Step = { ...runningStep, error: message, status: 'failed' };
      if (onEvent) {
        onEvent({ type: 'step_error', stepId, payload: { error: message } });
      }
      const updatedPlan: Plan = {
        ...plan,
        steps: plan.steps.map((s) => (s.id === stepId ? failedStep : s)),
        updatedAt: new Date().toISOString(),
      };
      this.plans.set(updatedPlan.id, updatedPlan);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  private findStepWithPlan(stepId: string): { plan: Plan | undefined; step: Step | undefined } {
    for (const plan of this.plans.values()) {
      const step = plan.steps.find(s => s.id === stepId);
      if (step) return { plan, step };
    }
    return { plan: undefined, step: undefined };
  }
}
