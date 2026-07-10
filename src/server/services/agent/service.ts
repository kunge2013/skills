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

  async runStep(stepId: string, _req?: RunStepRequest, onEvent?: (e: AgentSSEEvent) => void): Promise<Step> {
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
