<template>
  <div class="agent-message-content">
    <!-- Collapsible reasoning -->
    <div v-if="message.reasoning" class="reasoning-section">
      <el-collapse v-model="activeReasoning" class="reasoning-collapse">
        <el-collapse-item name="reasoning">
          <template #title>
            <div class="reasoning-header">
              <svg class="reasoning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
                <path d="M9 21h6M10 18v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1"/>
              </svg>
              <span>{{ $t('agent.thinking') }}</span>
            </div>
          </template>
          <pre class="reasoning-content">{{ message.reasoning }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- Markdown content -->
    <div v-if="message.content" class="agent-text" v-html="renderedContent" />

    <!-- Streaming cursor -->
    <span v-if="message.isStreaming" class="streaming-cursor">|</span>

    <!-- Tool calls -->
    <div v-if="message.toolCalls?.length" class="tool-calls">
      <ToolCallCard v-for="tc in message.toolCalls" :key="tc.id" :tool-call="tc" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MarkdownIt from 'markdown-it'
import ToolCallCard from './ToolCallCard.vue'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{ message: ChatMessage }>()

const activeReasoning = ref<string[]>(['reasoning'])

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

const renderedContent = computed(() => {
  try {
    return md.render(props.message.content || '')
  } catch {
    return props.message.content || ''
  }
})
</script>

<style scoped>
.agent-message-content { line-height: 1.6; }

.reasoning-section { margin-bottom: 8px; }
.reasoning-collapse { border: none; }
.reasoning-collapse :deep(.el-collapse-item__header) {
  height: auto;
  padding: 6px 0;
  font-size: 13px;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 6px;
  border: none;
}
.reasoning-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: #f9fafb;
  border-radius: 0 0 6px 6px;
  margin-top: 2px;
}
.reasoning-collapse :deep(.el-collapse-item__content) {
  padding: 8px 4px 12px;
}
.reasoning-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.reasoning-icon {
  width: 14px;
  height: 14px;
  color: #6b7280;
}
.reasoning-content {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
  white-space: pre-wrap;
  word-break: break-word;
}

.agent-text {
  margin: 0 0 8px;
}
.agent-text :deep(h1), .agent-text :deep(h2), .agent-text :deep(h3) {
  margin: 12px 0 6px;
  font-size: inherit;
}
.agent-text :deep(p) {
  margin: 0 0 8px;
}
.agent-text :deep(p:last-child) {
  margin-bottom: 0;
}
.agent-text :deep(code) {
  background: #f3f4f6;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}
.agent-text :deep(pre) {
  background: #f3f4f6;
  padding: 8px 12px;
  border-radius: 6px;
  overflow: auto;
  font-size: 13px;
}
.agent-text :deep(pre code) {
  background: none;
  padding: 0;
}
.agent-text :deep(ul), .agent-text :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}

.streaming-cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  color: #9ca3af;
  font-weight: bold;
}

@keyframes blink {
  50% { opacity: 0; }
}

.tool-calls { display: flex; flex-direction: column; gap: 4px; }
</style>
