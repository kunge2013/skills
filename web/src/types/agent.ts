export interface Plan {
  id: string;
  userMessage: string;
  responseText: string;
  reasoning: string;
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
  updatedAt?: string;
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

export interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result: string | null;
  status: 'running' | 'complete' | 'error';
}

export interface AgentSSEHandlers {
  onPlanToken: (token: string) => void;
  onPlanReasoning: (token: string) => void;
  onPlanComplete: (plan: Plan) => void;
  onPlanError: (error: string) => void;
  onStepStart: (data: { stepId: string; skillName: string; title: string }) => void;
  onStepToken: (data: { stepId: string; token: string }) => void;
  onStepReasoning: (data: { stepId: string; reasoning: string }) => void;
  onStepToolUse: (data: { stepId: string; toolName: string; args: Record<string, unknown> }) => void;
  onStepToolResult: (data: { stepId: string; toolName: string; result: string }) => void;
  onStepAskUser: (data: { stepId: string; question: string }) => void;
  onStepComplete: (data: { stepId: string; output: string }) => void;
  onStepError: (data: { stepId: string; error: string }) => void;
}
