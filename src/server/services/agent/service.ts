import { v4 as uuidv4 } from 'uuid';
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

    const planId = uuidv4();
    const now = new Date().toISOString();

    const step: Step = {
      id: uuidv4(),
      planId,
      skillName: '',
      title: 'Process request',
      description: req.userMessage,
      status: 'pending',
      output: null,
    };

    const plan: Plan = {
      id: planId,
      userMessage: req.userMessage,
      providerId: req.providerId,
      modelKey: req.modelKey,
      status: 'pending_review',
      steps: [step],
      createdAt: now,
      updatedAt: now,
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

  async runStep(stepId: string, _req?: RunStepRequest, onEvent?: (e: AgentSSEEvent) => void): Promise<Step> {
    // Phase 1: find step in plans, validate status
    const { plan, step } = this.findStepWithPlan(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    if (step.status !== 'pending') {
      throw new Error(`Step ${stepId} is not pending (current status: ${step.status})`);
    }

    const runningStep: Step = { ...step, status: 'running', runAt: new Date().toISOString() };

    if (onEvent) {
      onEvent({
        type: 'step_start',
        stepId,
        payload: { skillName: runningStep.skillName, title: runningStep.title },
      });
      onEvent({
        type: 'step_complete',
        stepId,
        payload: { output: `[Phase 1] Step "${runningStep.title}" executed. Full sub-agent coming in Task 6.` },
      });
    }

    const doneStep: Step = { ...runningStep, output: `[Phase 1] Step "${runningStep.title}" executed.`, status: 'done' };
    // plan is guaranteed to exist here because step was found within it
    if (!plan) throw new Error(`Internal error: plan not found for step ${stepId}`);
    const updatedPlan: Plan = { ...plan, steps: plan.steps.map(s => (s.id === stepId ? doneStep : s)) };
    this.plans.set(updatedPlan.id, updatedPlan);

    return doneStep;
  }

  private findStepWithPlan(stepId: string): { plan: Plan | undefined; step: Step | undefined } {
    for (const plan of this.plans.values()) {
      const step = plan.steps.find(s => s.id === stepId);
      if (step) return { plan, step };
    }
    return { plan: undefined, step: undefined };
  }
}
