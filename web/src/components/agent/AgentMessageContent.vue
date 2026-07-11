<template>
  <div class="agent-message-content">
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
    <p v-if="message.content" class="agent-text">{{ message.content }}</p>
    <div v-if="message.toolCalls?.length" class="tool-calls">
      <ToolCallCard v-for="tc in message.toolCalls" :key="tc.id" :tool-call="tc" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolCallCard from './ToolCallCard.vue'
import type { ChatMessage } from '../../types/chat'

useI18n()
defineProps<{ message: ChatMessage }>()

const activeReasoning = ref<string[]>(['reasoning'])
</script>

<style scoped>
.reasoning-section { margin-bottom: 8px; }
.reasoning-collapse { border: none; }
.reasoning-collapse :deep(.el-collapse-item__header) {
  height: auto;
  padding: 6px 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  border: none;
}
.reasoning-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: var(--el-fill-color-lighter);
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
  color: var(--el-text-color-secondary);
}
.reasoning-content {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.agent-message-content { line-height: 1.6; }
.agent-text { margin: 0 0 8px; }
.tool-calls { display: flex; flex-direction: column; gap: 4px; }
</style>
