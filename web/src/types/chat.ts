export interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result: string | null;
  status: 'running' | 'complete' | 'error';
}

export type ChatMessageType = 'user' | 'agent' | 'plan' | 'tool_call' | 'error' | 'user_question';

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  content: string;
  timestamp: Date;
  reasoning?: string;
  planId?: string;
  toolCalls?: ToolCall[];
  stepId?: string;
  question?: string;
  isStreaming?: boolean;  // true while tokens are still arriving
}
