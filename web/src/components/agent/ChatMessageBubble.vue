<template>
  <div class="chat-message" :class="`chat-message--${message.type}`">
    <div class="chat-bubble" :class="bubbleClasses">
      <AgentMessageContent v-if="isAgentType" :message="message" />
      <p v-else class="user-text">{{ message.content }}</p>
    </div>
    <div class="chat-timestamp">{{ formatTime(message.timestamp) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AgentMessageContent from './AgentMessageContent.vue'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{ message: ChatMessage }>()

const isAgentType = computed(() =>
  ['agent', 'plan', 'tool_call', 'error', 'user_question'].includes(props.message.type)
)

const bubbleClasses = computed(() => [
  `chat-bubble--${props.message.type}`,
  { 'chat-bubble--streaming': props.message.isStreaming },
])

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.chat-message {
  display: flex;
  flex-direction: column;
  margin: 8px 0;
  animation: fade-in-up 200ms ease-out;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-message--user { align-items: flex-end; }
.chat-message--agent,
.chat-message--plan,
.chat-message--error { align-items: flex-start; }

.chat-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 24px;
  transition: box-shadow 200ms ease;
}

.chat-bubble:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.chat-bubble--user {
  background: #f5f5f5;
  color: #111827;
}

.chat-bubble--agent,
.chat-bubble--plan {
  background: #f5f5f5;
}

.chat-timestamp {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
  padding: 0 4px;
}

.user-text {
  margin: 0;
  line-height: 1.5;
  color: #111827;
}
</style>
