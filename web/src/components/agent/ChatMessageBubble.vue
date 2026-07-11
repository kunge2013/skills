<template>
  <div class="chat-message" :class="`chat-message--${message.type}`">
    <div class="chat-bubble" :class="bubbleClasses">
      <AgentMessageContent v-if="isAgentType" :message="message" />
      <p v-else class="user-text">{{ message.content }}</p>
      <div class="message-actions">
        <button class="action-btn" @click="copyMessage" :title="$t('agent.copy')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button v-if="isAgentType" class="action-btn" @click="handleRegenerate" :title="$t('agent.regenerate')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <button v-else class="action-btn" @click="startEdit" :title="$t('agent.edit')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="chat-timestamp">{{ formatTime(message.timestamp) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import AgentMessageContent from './AgentMessageContent.vue'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{ message: ChatMessage }>()
const emit = defineEmits<{ regenerate: [] }>()

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

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function startEdit() {
  // Edit functionality placeholder - will be implemented in a future task
}

function handleRegenerate() {
  emit('regenerate')
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

.message-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 150ms ease;
  margin-top: 4px;
}
.chat-message:hover .message-actions { opacity: 1; }
.action-btn {
  width: 24px; height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 4px;
}
.action-btn:hover { background: #f3f4f6; color: #4b5563; }
</style>
