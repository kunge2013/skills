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
