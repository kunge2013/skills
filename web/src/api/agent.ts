import type { Plan, SkillInfo, AgentSSEHandlers, UserQuestion } from '../types/agent';
import { createAgentEventBus } from '../utils/eventBus';

const API_BASE = '/api/v1';

export function createAgentApi() {
  return {
    createPlan(
      userMessage: string,
      providerId: string,
      modelKey: string,
      handlers: AgentSSEHandlers,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const bus = createAgentEventBus();

        bus.handlers.onPlanToken = handlers.onPlanToken;
        bus.handlers.onPlanComplete = (plan) => { handlers.onPlanComplete(plan); resolve(); };
        bus.handlers.onPlanError = (error) => { handlers.onPlanError(error); reject(new Error(error)); };

        fetch(`${API_BASE}/agent/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage, providerId, modelKey }),
        })
          .then(async (res) => {
            if (!res.ok) {
              handlers.onPlanError(`HTTP ${res.status}`);
              reject(new Error(`HTTP ${res.status}`));
              return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
              handlers.onPlanError('No response body');
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
            handlers.onPlanError(err.message);
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
      handlers?: Partial<AgentSSEHandlers>,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
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
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'step_complete') {
                      handlers?.onStepComplete?.(data.payload);
                      resolve();
                      return;
                    }
                    if (data.type === 'step_error') {
                      handlers?.onStepError?.(data.payload);
                      reject(new Error(data.payload.error));
                      return;
                    }
                    if (data.type === 'step_ask_user') {
                      handlers?.onStepAskUser?.(data.payload);
                    }
                    if (data.type === 'step_token') {
                      handlers?.onStepToken?.(data.payload);
                    }
                    if (data.type === 'step_reasoning') {
                      handlers?.onStepReasoning?.(data.payload);
                    }
                  } catch { /* skip malformed */ }
                }
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
