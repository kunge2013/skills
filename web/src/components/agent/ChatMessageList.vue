<template>
  <div ref="container" class="chat-message-list">
    <ChatMessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />

    <!-- Thinking indicator when loading and no messages yet -->
    <div v-if="isLoading && messages.length === 0" class="chat-thinking">
      <div class="thinking-dots">
        <span class="thinking-dot" />
        <span class="thinking-dot" />
        <span class="thinking-dot" />
      </div>
    </div>

    <!-- Anchor for IntersectionObserver to detect bottom -->
    <div ref="bottomAnchor" class="scroll-anchor" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import ChatMessageBubble from './ChatMessageBubble.vue'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{ messages: ChatMessage[]; isLoading: boolean }>()

const container = ref<HTMLElement>()
const bottomAnchor = ref<HTMLElement>()
const isUserAtBottom = ref(true)

let observer: IntersectionObserver | null = null

onMounted(() => {
  if (bottomAnchor.value) {
    observer = new IntersectionObserver(
      (entries) => {
        isUserAtBottom.value = entries[0].isIntersecting
      },
      { threshold: 0.9 }
    )
    observer.observe(bottomAnchor.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

function scrollToBottom() {
  nextTick(() => {
    bottomAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

// Scroll on new messages or content changes when user is at bottom
watch(() => [props.messages.length, isUserAtBottom.value], () => {
  if (isUserAtBottom.value) {
    scrollToBottom()
  }
}, { immediate: true })
</script>

<style scoped>
.chat-message-list { flex: 1; overflow-y: auto; padding: 12px 0; }
.chat-message-list::-webkit-scrollbar { width: 6px; }
.chat-message-list::-webkit-scrollbar-thumb { border-radius: 999px; background: #d1d5db; }
.chat-message-list::-webkit-scrollbar-track { background: transparent; }
.chat-thinking { display: flex; align-items: center; gap: 6px; color: #6b7280; padding: 8px 0; }
.thinking-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: #f5f5f5;
  border-radius: 16px;
}
.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6b7280;
  animation: thinking-pulse 1.5s ease-in-out infinite;
}
.thinking-dot:nth-child(2) { animation-delay: 0.5s; }
.thinking-dot:nth-child(3) { animation-delay: 1s; }
@keyframes thinking-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.scroll-anchor { height: 1px; }
</style>
