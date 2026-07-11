import { ref, shallowRef } from 'vue';
import type { Plan, Step, SkillInfo, ToolCall } from '../types/agent';
import { createAgentApi } from '../api/agent';

const api = createAgentApi();

const currentPlan = ref<Plan | null>(null);
const planTextBuffer = ref('');
const planReasoningBuffer = ref('');
const skills = ref<SkillInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const stepOutputs = shallowRef(new Map<string, string>());
const stepToolCalls = shallowRef(new Map<string, ToolCall[]>());
const stepReasoning = shallowRef(new Map<string, string>());

export interface StreamingCallbacks {
  onToken: (token: string) => void;
  onReasoning: (reasoning: string) => void;
  onToolUse: (data: { toolCallId: string; name: string; args: Record<string, unknown> }) => void;
  onToolResult: (data: { toolCallId: string; output: string }) => void;
}

export function useAgent() {
  async function loadSkills() {
    try {
      skills.value = await api.getSkills();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load skills';
      error.value = msg;
    }
  }

  async function createPlan(userMessage: string, modelKey: string, callbacks?: StreamingCallbacks) {
    loading.value = true;
    error.value = null;
    planTextBuffer.value = '';
    planReasoningBuffer.value = '';
    currentPlan.value = null;
    stepToolCalls.value = new Map();
    stepReasoning.value = new Map();

    try {
      await api.createPlan(userMessage, modelKey, {
        onContent: (token) => {
          planTextBuffer.value += token;
          callbacks?.onToken(token);
        },
        onReasoning: (reasoning) => {
          planReasoningBuffer.value += reasoning;
          callbacks?.onReasoning(reasoning);
        },
        onComplete: (data) => {
          if (data.plan) {
            currentPlan.value = data.plan;
          }
          planTextBuffer.value = '';
          loading.value = false;
        },
        onError: (err) => {
          error.value = err;
          loading.value = false;
        },
        onToolUse: (data) => {
          callbacks?.onToolUse(data);
          const calls = stepToolCalls.value.get(data.toolCallId) ?? [];
          calls.push({
            id: data.toolCallId,
            name: data.name,
            args: data.args,
            output: null,
            status: 'running',
          });
          stepToolCalls.value.set(data.toolCallId, calls);
          stepToolCalls.value = stepToolCalls.value;
        },
        onToolResult: (data) => {
          callbacks?.onToolResult(data);
          const calls = stepToolCalls.value.get(data.toolCallId) ?? [];
          if (calls.length > 0) {
            const call = calls[calls.length - 1];
            call.output = data.output;
            call.status = data.output ? 'complete' : 'error';
          }
          stepToolCalls.value = stepToolCalls.value;
        },
        onAskUser: () => {},
      });
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Plan creation failed';
      loading.value = false;
    }
  }

  async function runStep(step: Step) {
    const outputs = stepOutputs.value;
    outputs.set(step.id, '');
    stepOutputs.value = outputs;

    try {
      await api.runStep(step.id, undefined, {
        onContent: (data) => {
          const cur = outputs.get(step.id) || '';
          outputs.set(step.id, cur + data.token);
          stepOutputs.value = outputs;
          step.status = 'running';
        },
        onComplete: (data) => {
          step.output = data.output;
          step.status = 'done';
        },
        onError: (data) => {
          step.error = data.error;
          step.status = 'failed';
        },
        onAskUser: (data) => {
          step.userQuestions = step.userQuestions || [];
          step.userQuestions.push({ question: data.question, answer: null });
          step.status = 'waiting_user';
        },
      });
    } catch (e: unknown) {
      step.error = e instanceof Error ? e.message : 'Step failed';
      step.status = 'failed';
    }
  }

  return {
    currentPlan,
    planTextBuffer,
    planReasoningBuffer,
    skills,
    loading,
    error,
    stepOutputs,
    stepToolCalls,
    stepReasoning,
    loadSkills,
    createPlan,
    runStep,
  };
}
