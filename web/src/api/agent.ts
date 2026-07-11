import type { Plan, SkillInfo, AgentSSEHandlers, UserQuestion } from '../types/agent';
import { createAgentEventBus } from '../utils/eventBus';

const API_BASE = '/api/v1';

export function createAgentApi() {
  return {
    createPlan(
      userMessage: string,
      modelKey: string,
      handlers: AgentSSEHandlers,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const bus = createAgentEventBus();

        bus.handlers.onComplete = (data) => { handlers.onComplete(data); resolve(); };
        bus.handlers.onError = (error) => { handlers.onError(error); reject(new Error(error)); };

        // Wire pass-through handlers
        bus.handlers.onContent = handlers.onContent;
        bus.handlers.onReasoning = handlers.onReasoning;
        bus.handlers.onToolUse = handlers.onToolUse;
        bus.handlers.onToolResult = handlers.onToolResult;
        bus.handlers.onAskUser = handlers.onAskUser;

        fetch(`${API_BASE}/agent/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage, modelKey }),
        })
          .then(async (res) => {
            if (!res.ok) {
              handlers.onError(`HTTP ${res.status}`);
              reject(new Error(`HTTP ${res.status}`));
              return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
              handlers.onError('No response body');
              reject(new Error('No response body'));
              return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                bus.parseSSELine(line);
              }
            }
          })
          .catch((err) => {
            handlers.onError(err.message);
            reject(err);
          });
      });
    },

    getPlan(planId: string): Promise<Plan> {
      return fetch(`${API_BASE}/agent/plan/${planId}`)
        .then(r => r.json())
        .then(j => j.data);
    },

    runStep(
      stepId: string,
      userAnswers?: UserQuestion[],
      handlers?: {
        onContent?: (data: { token: string }) => void;
        onComplete?: (data: { content: string }) => void;
        onError?: (data: { error: string }) => void;
        onAskUser?: (data: { question: string }) => void;
      },
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const bus = createAgentEventBus();

        bus.handlers.onComplete = () => { handlers?.onComplete?.({ content: '' }); resolve(); };
        bus.handlers.onError = (error) => { handlers?.onError?.({ error }); reject(new Error(error)); };
        bus.handlers.onContent = (token) => { handlers?.onContent?.({ token }); };
        bus.handlers.onAskUser = (data) => { handlers?.onAskUser?.(data); };

        fetch(`${API_BASE}/agent/step/${stepId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAnswers }),
        })
          .then(async (res) => {
            if (!res.ok) {
              reject(new Error(`HTTP ${res.status}`));
              return;
            }

            const reader = res.body?.getReader();
            if (!reader) { reject(new Error('No response body')); return; }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                bus.parseSSELine(line);
              }
            }
          })
          .catch(reject);
      });
    },

    getSkills(): Promise<SkillInfo[]> {
      return fetch(`${API_BASE}/agent/skills`)
        .then(r => r.json())
        .then(j => j.data || []);
    },
  };
}
