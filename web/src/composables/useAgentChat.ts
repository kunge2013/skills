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
  const streamingMessageId = ref<string | null>(null);

  async function sendMessage(text: string, modelKey: string) {
    if (!text.trim() || agent.loading.value) return;

    // Create user message
    messages.value.push({
      id: nextId(),
      type: 'user',
      content: text,
      timestamp: new Date(),
    });

    // Create live streaming agent message immediately
    const agentMsgId = nextId();
    messages.value.push({
      id: agentMsgId,
      type: 'agent',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      toolCalls: [],
    });
    streamingMessageId.value = agentMsgId;

    await agent.createPlan(text, modelKey, {
      onToken: (token) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) msg.content += token;
      },
      onReasoning: (reasoning) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) msg.reasoning = (msg.reasoning || '') + reasoning;
      },
      onToolUse: (data) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) {
          msg.toolCalls = msg.toolCalls || [];
          msg.toolCalls.push({
            id: `${data.stepId || ''}-${data.toolName}`,
            toolName: data.toolName,
            args: data.args,
            result: null,
            status: 'running',
          });
        }
      },
      onToolResult: (data) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg?.toolCalls) {
          const call = msg.toolCalls.find(c => c.toolName === data.toolName);
          if (call) {
            call.result = data.result;
            call.status = data.result ? 'complete' : 'error';
          }
        }
      },
    });
  }

  // Watch plan completion → finalize streaming message
  watch(() => agent.currentPlan.value, (plan) => {
    if (plan && plan.status !== 'planning' && streamingMessageId.value) {
      const msg = messages.value.find(m => m.id === streamingMessageId.value);
      if (msg) {
        msg.isStreaming = false;
        if (!msg.content && plan.responseText) {
          msg.content = plan.responseText;
        }
      }
      streamingMessageId.value = null;
    }
  });

  // Watch errors → finalize or create error message
  watch(() => agent.error.value, (err) => {
    if (err && streamingMessageId.value) {
      const msg = messages.value.find(m => m.id === streamingMessageId.value);
      if (msg) {
        msg.type = 'error';
        msg.content = err;
        msg.isStreaming = false;
      }
      streamingMessageId.value = null;
    } else if (err) {
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
  };
}
