<template>
  <div ref="container" class="chat-message-list">
    <ChatMessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />

    <!-- Thinking indicator when loading and no messages yet -->
    <div v-if="isLoading && messages.length === 0" class="chat-thinking">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ $t('agent.thinking') }}</span>
    </div>

    <!-- Anchor for IntersectionObserver to detect bottom -->
    <div ref="bottomAnchor" class="scroll-anchor" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
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
.chat-thinking { display: flex; align-items: center; gap: 6px; color: var(--el-text-color-secondary); padding: 8px 0; }
.scroll-anchor { height: 1px; }
</style>
