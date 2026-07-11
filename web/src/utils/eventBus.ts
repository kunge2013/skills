import type { AgentSSEHandlers, Plan } from '../types/agent';

type EventBusCallbacks = {
  onContent: (token: string) => void;
  onReasoning: (token: string) => void;
  onToolUse: (data: { toolCallId: string; name: string; args: Record<string, unknown> }) => void;
  onToolResult: (data: { toolCallId: string; output: string }) => void;
  onAskUser: (data: { question: string }) => void;
  onComplete: (data: { content: string; reasoning?: string; plan?: Plan }) => void;
  onError: (error: string) => void;
};

export function createAgentEventBus(): {
  handlers: AgentSSEHandlers;
  parseSSELine: (line: string) => void;
} {
  const callbacks: Partial<EventBusCallbacks> = {};
  let currentEvent: string | null = null;

  function parseSSELine(line: string) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
      return;
    }
    if (!line.startsWith('data: ')) return;
    try {
      const data = JSON.parse(line.slice(6));
      switch (currentEvent) {
        case 'content':
          callbacks.onContent?.(data.token);
          break;
        case 'reasoning':
          callbacks.onReasoning?.(data.token);
          break;
        case 'tool_use':
          callbacks.onToolUse?.(data);
          break;
        case 'tool_result':
          callbacks.onToolResult?.(data);
          break;
        case 'ask_user':
          callbacks.onAskUser?.(data);
          break;
        case 'complete':
          callbacks.onComplete?.(data);
          break;
        case 'error':
          callbacks.onError?.(data.error);
          break;
        case 'step_start':
          // Step start is handled by the plan view, not the chat
          break;
      }
    } catch { /* skip malformed */ }
  }

  const handlers: AgentSSEHandlers = {
    onContent: (t) => callbacks.onContent?.(t),
    onReasoning: (t) => callbacks.onReasoning?.(t),
    onToolUse: (d) => callbacks.onToolUse?.(d),
    onToolResult: (d) => callbacks.onToolResult?.(d),
    onAskUser: (d) => callbacks.onAskUser?.(d),
    onComplete: (d) => callbacks.onComplete?.(d),
    onError: (e) => callbacks.onError?.(e),
  };

  return { handlers, parseSSELine };
}
