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
  name: string;
  args: Record<string, unknown>;
  output: string | null;
  status: 'running' | 'complete' | 'error';
}

export interface AgentSSEHandlers {
  onContent: (token: string) => void;
  onReasoning: (token: string) => void;
  onToolUse: (data: { toolCallId: string; name: string; args: Record<string, unknown> }) => void;
  onToolResult: (data: { toolCallId: string; output: string }) => void;
  onAskUser: (data: { question: string }) => void;
  onComplete: (data: { content: string; reasoning?: string; plan?: Plan }) => void;
  onError: (error: string) => void;
}
