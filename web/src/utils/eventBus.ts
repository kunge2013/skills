import type { AgentSSEHandlers, Plan } from '../types/agent';

export function createAgentEventBus(): {
  handlers: AgentSSEHandlers;
  parseSSELine: (line: string) => void;
} {
  let currentEvent: string | null = null;

  const handlers: AgentSSEHandlers = {
    onContent: () => {},
    onReasoning: () => {},
    onToolUse: () => {},
    onToolResult: () => {},
    onAskUser: () => {},
    onComplete: () => {},
    onError: () => {},
  };

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
          handlers.onContent(data.token);
          break;
        case 'reasoning':
          handlers.onReasoning(data.token);
          break;
        case 'tool_use':
          handlers.onToolUse(data);
          break;
        case 'tool_result':
          handlers.onToolResult(data);
          break;
        case 'ask_user':
          handlers.onAskUser(data);
          break;
        case 'complete':
          handlers.onComplete(data);
          break;
        case 'error':
          handlers.onError(data.error);
          break;
        case 'step_start':
          break;
      }
    } catch { /* skip malformed */ }
  }

  return { handlers, parseSSELine };
}
