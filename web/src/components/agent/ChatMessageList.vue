<template>
  <div ref="container" class="chat-message-list">
    <ChatMessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />
    <div v-if="isLoading" class="chat-thinking">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ $t('agent.thinking') }}</span>
    </div>
    <div ref="bottomEl" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import ChatMessageBubble from './ChatMessageBubble.vue'
import type { ChatMessage } from '../../types/chat'

defineProps<{ messages: ChatMessage[]; isLoading: boolean }>()

const container = ref<HTMLElement>()
const bottomEl = ref<HTMLElement>()

const props = defineProps<{ messages: ChatMessage[]; isLoading: boolean }>()

watch(() => props.messages.length, () => {
  nextTick(() => bottomEl.value?.scrollIntoView({ behavior: 'smooth' }))
}, { immediate: true })
</script>

<style scoped>
.chat-message-list { flex: 1; overflow-y: auto; padding: 12px 0; }
.chat-thinking { display: flex; align-items: center; gap: 6px; color: var(--el-text-color-secondary); padding: 8px 0; }
</style>
