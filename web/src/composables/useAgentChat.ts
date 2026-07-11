import { ref } from 'vue';
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
            id: data.toolCallId,
            name: data.name,
            args: data.args,
            output: null,
            status: 'running',
          });
        }
      },
      onToolResult: (data) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg?.toolCalls) {
          const call = msg.toolCalls.find(c => c.id === data.toolCallId);
          if (call) {
            call.output = data.output;
            call.status = data.output ? 'complete' : 'error';
          }
        }
      },
      onComplete: () => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) {
          msg.isStreaming = false;
        }
        streamingMessageId.value = null;
      },
      onError: (err: string) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) {
          msg.type = 'error';
          msg.content = err;
          msg.isStreaming = false;
        }
        streamingMessageId.value = null;
      },
      onAskUser: () => {},
    });
  }

  const hideToolCalls = ref(false);

  function setHideToolCalls(value: boolean) {
    hideToolCalls.value = value;
  }

  return {
    messages,
    sendMessage,
    isLoading: agent.loading,
    error: agent.error,
    hideToolCalls,
    setHideToolCalls,
  };
}
