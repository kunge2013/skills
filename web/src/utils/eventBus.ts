import type { AgentSSEHandlers, Plan } from '../types/agent';

type EventBusCallbacks = {
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
};

export function createAgentEventBus(): {
  on: (event: keyof EventBusCallbacks, fn: (...args: unknown[]) => void) => void;
  emit: (event: keyof EventBusCallbacks, data: unknown) => void;
  handlers: AgentSSEHandlers;
  parseSSELine: (line: string) => void;
} {
  const callbacks: Partial<EventBusCallbacks> = {};

  function on(event: keyof EventBusCallbacks, fn: (...args: unknown[]) => void) {
    callbacks[event] = fn as never;
  }

  function emit(event: keyof EventBusCallbacks, data: unknown) {
    (callbacks[event] as (d: unknown) => void)?.(data);
  }

  function parseSSELine(line: string) {
    if (!line.startsWith('data: ')) return;
    try {
      const data = JSON.parse(line.slice(6));
      const type = data.type;

      switch (type) {
        case 'plan_token':
          handlers.onPlanToken(data.payload.token);
          break;
        case 'plan_reasoning':
          handlers.onPlanReasoning(data.reasoning);
          break;
        case 'plan_complete':
          handlers.onPlanComplete(data.payload.plan);
          break;
        case 'plan_error':
          handlers.onPlanError(data.payload.error);
          break;
        case 'step_start':
          handlers.onStepStart({ stepId: data.stepId, ...data.payload });
          break;
        case 'step_token':
          handlers.onStepToken({ stepId: data.stepId, token: data.payload.token });
          break;
        case 'step_reasoning':
          handlers.onStepReasoning({ stepId: data.stepId, reasoning: data.payload.reasoning });
          break;
        case 'step_tool_use':
          handlers.onStepToolUse({ stepId: data.stepId, ...data.payload });
          break;
        case 'step_tool_result':
          handlers.onStepToolResult({ stepId: data.stepId, ...data.payload });
          break;
        case 'step_ask_user':
          handlers.onStepAskUser({ stepId: data.stepId, question: data.payload.question });
          break;
        case 'step_complete':
          handlers.onStepComplete({ stepId: data.stepId, output: data.payload.output });
          break;
        case 'step_error':
          handlers.onStepError({ stepId: data.stepId, error: data.payload.error });
          break;
      }
    } catch { /* skip malformed */ }
  }

  const handlers: AgentSSEHandlers = {
    onPlanToken: (t) => emit('onPlanToken', t),
    onPlanReasoning: (t) => emit('onPlanReasoning', t),
    onPlanComplete: (p) => emit('onPlanComplete', p),
    onPlanError: (e) => emit('onPlanError', e),
    onStepStart: (d) => emit('onStepStart', d),
    onStepToken: (d) => emit('onStepToken', d),
    onStepReasoning: (d) => emit('onStepReasoning', d),
    onStepToolUse: (d) => emit('onStepToolUse', d),
    onStepToolResult: (d) => emit('onStepToolResult', d),
    onStepAskUser: (d) => emit('onStepAskUser', d),
    onStepComplete: (d) => emit('onStepComplete', d),
    onStepError: (d) => emit('onStepError', d),
  };

  return { on, emit, handlers, parseSSELine };
}
