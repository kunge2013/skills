import { ref, watch } from 'vue';
import { useAgent } from './useAgent';
import type { ChatMessage } from '../types/chat';

let messageCounter = 0;

function nextId(): string {
  return `msg-${++messageCounter}`;
}

export function useAgentChat() {
  const agent = useAgent();
  const messages = ref<ChatMessage[]>([]);

  async function sendMessage(text: string, modelKey: string) {
    if (!text.trim() || agent.loading.value) return;
    messages.value.push({
      id: nextId(),
      type: 'user',
      content: text,
      timestamp: new Date(),
    });
    await agent.createPlan(text, modelKey);
  }

  // Watch plan completion → append agent message with LLM response
  watch(() => agent.currentPlan.value, (plan) => {
    if (plan && plan.status !== 'planning') {
      const content = plan.responseText || plan.userMessage;
      const reasoning = plan.reasoning || agent.planReasoningBuffer.value || undefined;
      messages.value.push({
        id: nextId(),
        type: 'plan',
        content,
        timestamp: new Date(),
        planId: plan.id,
        reasoning: reasoning || undefined,
      });
    }
  });

  // Watch errors → append error message
  watch(() => agent.error.value, (err) => {
    if (err) {
      messages.value.push({
        id: nextId(),
        type: 'error',
        content: err,
        timestamp: new Date(),
      });
    }
  });

  return {
    messages,
    sendMessage,
    isLoading: agent.loading,
    error: agent.error,
    currentPlan: agent.currentPlan,
    stepOutputs: agent.stepOutputs,
    stepToolCalls: agent.stepToolCalls,
    planTextBuffer: agent.planTextBuffer,
    planReasoningBuffer: agent.planReasoningBuffer,
  };
}
