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

  function patchStreaming(patch: Partial<ChatMessage>) {
    const id = streamingMessageId.value;
    if (!id) return;
    // Create a NEW array reference so Vue detects the change
    messages.value = messages.value.map(m =>
      m.id === id ? { ...m, ...patch } : m
    );
  }

  function getStreamingMsg(): ChatMessage | undefined {
    return messages.value.find(m => m.id === streamingMessageId.value);
  }

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
        const msg = getStreamingMsg();
        if (msg) patchStreaming({ content: msg.content + token });
      },
      onReasoning: (reasoning) => {
        const msg = getStreamingMsg();
        if (!msg) return;
        const newReasoning = (msg.reasoning || '') + reasoning;
        patchStreaming({ reasoning: newReasoning });
      },
      onToolUse: (data) => {
        const msg = getStreamingMsg();
        if (msg) {
          const toolCalls = [...(msg.toolCalls || []), {
            id: data.toolCallId,
            name: data.name,
            args: data.args,
            output: null,
            status: 'running' as const,
          }];
          patchStreaming({ toolCalls });
        }
      },
      onToolResult: (data) => {
        const msg = getStreamingMsg();
        if (!msg?.toolCalls) return;
        const toolCalls = msg.toolCalls.map(c =>
          c.id === data.toolCallId
            ? { ...c, output: data.output, status: data.output ? 'complete' as const : 'error' as const }
            : c
        );
        patchStreaming({ toolCalls });
      },
      onComplete: () => {
        patchStreaming({ isStreaming: false });
        streamingMessageId.value = null;
      },
      onError: (err: string) => {
        patchStreaming({ type: 'error', content: err, isStreaming: false });
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
