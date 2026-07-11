<template>
  <div class="chat-message" :class="`chat-message--${message.type}`">
    <div class="chat-bubble" :class="`chat-bubble--${message.type}`">
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

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.chat-message { display: flex; flex-direction: column; margin: 8px 0; }
.chat-message--user { align-items: flex-end; }
.chat-message--agent, .chat-message--plan, .chat-message--error { align-items: flex-start; }
.chat-bubble { max-width: 75%; padding: 10px 14px; border-radius: 12px; }
.chat-bubble--user { background: var(--el-color-primary); color: white; border-bottom-right-radius: 4px; }
.chat-bubble--agent, .chat-bubble--plan { background: var(--el-fill-color-light); border: 1px solid var(--el-border-color-lighter); border-bottom-left-radius: 4px; }
.chat-bubble--error { background: var(--el-color-danger-light-9); border: 1px solid var(--el-color-danger-light-7); color: var(--el-color-danger); border-bottom-left-radius: 4px; }
.chat-timestamp { font-size: 11px; color: var(--el-text-color-placeholder); margin-top: 2px; }
.user-text { margin: 0; line-height: 1.5; color: white; }
</style>
