<template>
  <div ref="container" class="chat-message-list">
    <div class="message-content">
      <ChatMessageBubble v-for="msg in visibleMessages" :key="msg.id" :message="msg" />

      <!-- 3-dot thinking indicator -->
      <div v-if="isLoading && visibleMessages.length === 0" class="thinking-dots">
        <span class="thinking-dot" /><span class="thinking-dot" /><span class="thinking-dot" />
      </div>
    </div>

    <!-- Scroll anchor -->
    <div ref="bottomAnchor" class="scroll-anchor" />

    <!-- Scroll-to-bottom floating button -->
    <button
      v-if="showScrollButton"
      class="scroll-to-bottom"
      @click="scrollToBottom"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 11L3 6h10z"/>
      </svg>
      <span>{{ $t('agent.scrollToBottom') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted, computed } from 'vue'
import ChatMessageBubble from './ChatMessageBubble.vue'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{ messages: ChatMessage[]; isLoading: boolean; hideToolCalls?: boolean }>()

const visibleMessages = computed(() =>
  (props.hideToolCalls ?? false)
    ? props.messages.filter(m => m.type !== 'tool_call')
    : props.messages
)

const container = ref<HTMLElement>()
const bottomAnchor = ref<HTMLElement>()
const isUserAtBottom = ref(true)
const showScrollButton = ref(false)

let observer: IntersectionObserver | null = null

onMounted(() => {
  if (bottomAnchor.value) {
    observer = new IntersectionObserver(
      (entries) => {
        isUserAtBottom.value = entries[0].isIntersecting
        showScrollButton.value = !entries[0].isIntersecting
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

watch(() => [props.messages.length, isUserAtBottom.value], () => {
  if (isUserAtBottom.value) {
    scrollToBottom()
  }
}, { immediate: true })
</script>

<style scoped>
.chat-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 32px 16px 0;
}
.chat-message-list::-webkit-scrollbar { width: 6px; }
.chat-message-list::-webkit-scrollbar-thumb { border-radius: 999px; background: #d1d5db; }
.chat-message-list::-webkit-scrollbar-track { background: transparent; }

.message-content {
  max-width: 768px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 64px;
}

.thinking-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: #f5f5f5;
  border-radius: 16px;
  width: fit-content;
}
.thinking-dot {
  width: 6px; height: 6px;
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

.scroll-to-bottom {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all 150ms ease;
  animation: fade-in 150ms ease-out;
  z-index: 10;
}
.scroll-to-bottom:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
