import { ref, shallowRef } from 'vue';
import type { Plan, Step, SkillInfo } from '../types/agent';
import { createAgentApi } from '../api/agent';

const api = createAgentApi();

const currentPlan = ref<Plan | null>(null);
const planTextBuffer = ref('');
const skills = ref<SkillInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const stepOutputs = shallowRef(new Map<string, string>());
const stepRunning = shallowRef(new Map<string, boolean>());

export function useAgent() {
  async function loadSkills() {
    try {
      skills.value = await api.getSkills();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load skills';
      error.value = msg;
    }
  }

  async function createPlan(userMessage: string, providerId: string, modelKey: string) {
    loading.value = true;
    error.value = null;
    planTextBuffer.value = '';
    currentPlan.value = null;

    try {
      await api.createPlan(userMessage, providerId, modelKey, {
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
        onStepReasoning: () => {},
        onStepToolUse: () => {},
        onStepToolResult: () => {},
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
    const runnings = stepRunning.value;
    outputs.set(step.id, '');
    stepOutputs.value = outputs;
    runnings.set(step.id, true);
    stepRunning.value = runnings;

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
          runnings.delete(step.id);
          stepRunning.value = runnings;
        },
        onStepError: (data) => {
          step.error = data.error;
          step.status = 'failed';
          runnings.delete(step.id);
          stepRunning.value = runnings;
        },
        onStepAskUser: (data) => {
          step.userQuestions = step.userQuestions || [];
          step.userQuestions.push({ question: data.question, answer: null });
          step.status = 'waiting_user';
          runnings.delete(step.id);
          stepRunning.value = runnings;
        },
        onStepReasoning: () => {},
        onStepToolUse: () => {},
        onStepToolResult: () => {},
      });
    } catch (e: unknown) {
      step.error = e instanceof Error ? e.message : 'Step failed';
      step.status = 'failed';
      runnings.delete(step.id);
      stepRunning.value = runnings;
    }
  }

  return {
    currentPlan,
    planTextBuffer,
    skills,
    loading,
    error,
    stepOutputs,
    stepRunning,
    loadSkills,
    createPlan,
    runStep,
  };
}
