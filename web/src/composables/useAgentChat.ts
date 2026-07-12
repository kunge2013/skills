import { ref, nextTick } from 'vue';
import { useAgent } from './useAgent';
import type { ChatMessage } from '../types/chat';

let messageCounter = 0;

function nextId(): string {
  return `msg-${++messageCounter}`;
}

function updateMessage(messages: ChatMessage[], id: string | null, patch: Partial<ChatMessage>) {
  if (!id) return;
  const idx = messages.findIndex(m => m.id === id);
  if (idx === -1) return;
  messages[idx] = { ...messages[idx], ...patch };
  // Trigger reactivity by reassigning the array
  // eslint-disable-next-line no-self-assign
  messages.length = messages.length;
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
        updateMessage(messages.value, streamingMessageId.value, {
          content: (messages.value.find(m => m.id === streamingMessageId.value)?.content || '') + token,
        });
      },
      onReasoning: (reasoning) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        const currentReasoning = msg?.reasoning || '';
        const newReasoning = currentReasoning + reasoning;
        // Also show reasoning in main content if content is empty
        const newContent = (!msg?.content ? newReasoning : msg?.content) || '';
        updateMessage(messages.value, streamingMessageId.value, {
          reasoning: newReasoning,
          content: newContent,
        });
      },
      onToolUse: (data) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) {
          const toolCalls = msg.toolCalls || [];
          toolCalls.push({
            id: data.toolCallId,
            name: data.name,
            args: data.args,
            output: null,
            status: 'running',
          });
          updateMessage(messages.value, streamingMessageId.value, { toolCalls: [...toolCalls] });
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
          updateMessage(messages.value, streamingMessageId.value, { toolCalls: [...msg.toolCalls] });
        }
      },
      onComplete: () => {
        updateMessage(messages.value, streamingMessageId.value, { isStreaming: false });
        streamingMessageId.value = null;
      },
      onError: (err: string) => {
        updateMessage(messages.value, streamingMessageId.value, {
          type: 'error',
          content: err,
          isStreaming: false,
        });
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
