<template>
  <div class="agent-message-content">
    <p v-if="message.content" class="agent-text">{{ message.content }}</p>
    <div v-if="message.toolCalls?.length" class="tool-calls">
      <ToolCallCard v-for="tc in message.toolCalls" :key="tc.id" :tool-call="tc" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ToolCallCard from './ToolCallCard.vue'
import type { ChatMessage } from '../../types/chat'

defineProps<{ message: ChatMessage }>()
</script>

<style scoped>
.agent-message-content { line-height: 1.6; }
.agent-text { margin: 0 0 8px; }
.tool-calls { display: flex; flex-direction: column; gap: 4px; }
</style>
