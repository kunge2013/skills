import { ref, watch } from 'vue';
import { useAgent } from './useAgent';
import type { ChatMessage } from '../types/chat';
import type { Step } from '../types/agent';

let messageCounter = 0;

function nextId(): string {
  return `msg-${++messageCounter}`;
}

export function useAgentChat() {
  const agent = useAgent();
  const messages = ref<ChatMessage[]>([]);

  async function sendMessage(text: string, providerId: string, modelKey: string) {
    if (!text.trim() || agent.loading.value) return;
    messages.value.push({
      id: nextId(),
      type: 'user',
      content: text,
      timestamp: new Date(),
    });
    await agent.createPlan(text, providerId, modelKey);
  }

  // Watch plan completion → append agent message with plan reference
  watch(() => agent.currentPlan, (plan) => {
    if (plan && plan.status !== 'planning') {
      messages.value.push({
        id: nextId(),
        type: 'plan',
        content: plan.summary ?? plan.title,
        timestamp: new Date(),
        planId: plan.id,
      });
    }
  });

  // Watch errors → append error message
  watch(() => agent.error, (err) => {
    if (err) {
      messages.value.push({
        id: nextId(),
        type: 'error',
        content: err,
        timestamp: new Date(),
      });
    }
  });

  async function runStep(step: Step) {
    const outputs = agent.stepOutputs.value;
    outputs.set(step.id, '');
    agent.stepOutputs.value = outputs;

    try {
      await agent.runStep(step);
    } catch (e: unknown) {
      step.error = e instanceof Error ? e.message : 'Step failed';
      step.status = 'failed';
    }
  }

  return {
    messages,
    sendMessage,
    runStep,
    isLoading: agent.loading,
    error: agent.error,
    currentPlan: agent.currentPlan,
    stepOutputs: agent.stepOutputs,
    stepToolCalls: agent.stepToolCalls,
    planTextBuffer: agent.planTextBuffer,
  };
}
