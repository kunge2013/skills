import { ref, shallowRef } from 'vue';
import type { Plan, Step, SkillInfo, ToolCall } from '../types/agent';
import { createAgentApi } from '../api/agent';

const api = createAgentApi();

const currentPlan = ref<Plan | null>(null);
const planTextBuffer = ref('');
const skills = ref<SkillInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const stepOutputs = shallowRef(new Map<string, string>());
const stepToolCalls = shallowRef(new Map<string, ToolCall[]>());
const stepReasoning = shallowRef(new Map<string, string>());

export function useAgent() {
  async function loadSkills() {
    try {
      skills.value = await api.getSkills();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load skills';
      error.value = msg;
    }
  }

  async function createPlan(userMessage: string, modelKey: string) {
    loading.value = true;
    error.value = null;
    planTextBuffer.value = '';
    currentPlan.value = null;
    stepToolCalls.value = new Map();
    stepReasoning.value = new Map();

    try {
      await api.createPlan(userMessage, modelKey, {
        onPlanToken: (token) => {
          planTextBuffer.value += token;
        },
        onPlanComplete: (plan) => {
          currentPlan.value = plan;
          planTextBuffer.value = '';
          loading.value = false;
        },
        onPlanError: (err) => {
          error.value = err;
          loading.value = false;
        },
        onStepStart: () => {},
        onStepToken: () => {},
        onStepReasoning: (data) => {
          stepReasoning.value.set(data.stepId, data.reasoning);
          stepReasoning.value = stepReasoning.value;
        },
        onStepToolUse: (data) => {
          const calls = stepToolCalls.value.get(data.stepId) ?? [];
          calls.push({
            id: `${data.stepId}-${data.toolName}`,
            toolName: data.toolName,
            args: data.args,
            result: null,
            status: 'running',
          });
          stepToolCalls.value.set(data.stepId, calls);
          stepToolCalls.value = stepToolCalls.value;
        },
        onStepToolResult: (data) => {
          const calls = stepToolCalls.value.get(data.stepId) ?? [];
          const call = calls.find(c => c.toolName === data.toolName);
          if (call) {
            call.result = data.result;
            call.status = data.result ? 'complete' : 'error';
          }
          stepToolCalls.value = stepToolCalls.value;
        },
        onStepAskUser: () => {},
        onStepComplete: () => {},
        onStepError: () => {},
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
        onStepToken: (data) => {
          const cur = outputs.get(step.id) || '';
          outputs.set(step.id, cur + data.token);
          stepOutputs.value = outputs;
          step.status = 'running';
        },
        onStepComplete: (data) => {
          step.output = data.output;
          step.status = 'done';
        },
        onStepError: (data) => {
          step.error = data.error;
          step.status = 'failed';
        },
        onStepAskUser: (data) => {
          step.userQuestions = step.userQuestions || [];
          step.userQuestions.push({ question: data.question, answer: null });
          step.status = 'waiting_user';
        },
        onStepReasoning: () => {},
        onStepToolUse: () => {},
        onStepToolResult: () => {},
      });
    } catch (e: unknown) {
      step.error = e instanceof Error ? e.message : 'Step failed';
      step.status = 'failed';
    }
  }

  return {
    currentPlan,
    planTextBuffer,
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
