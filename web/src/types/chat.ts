export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  output: string | null;
  status: 'running' | 'complete' | 'error';
}

export type ChatMessageType = 'user' | 'agent' | 'tool_call' | 'error' | 'user_question';

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  content: string;
  timestamp: Date;
  reasoning?: string;
  toolCalls?: ToolCall[];
  question?: string;
  isStreaming?: boolean;
}
