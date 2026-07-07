<template>
  <div class="history-view">
    <div class="history-header">
      <h2>{{ t('prompt.historyTitle') }}</h2>
      <el-button @click="store.loadHistory()">{{ t('prompt.refresh') }}</el-button>
    </div>

    <el-card v-for="record in store.history" :key="record.id" shadow="never" class="history-item">
      <div class="history-meta">
        <el-tag size="small">{{ formatDate(record.createdAt) }}</el-tag>
        <el-tag size="small" type="info">{{ record.optimizationMode }}</el-tag>
        <span class="history-model">{{ record.modelKey }}</span>
        <el-tag size="small" type="warning">{{ t('prompt.version') }} {{ record.iterationCount + 1 }}</el-tag>
      </div>
      <div class="history-preview">{{ record.originalContent.slice(0, 80) }}...</div>
    </el-card>

    <el-empty v-if="store.history.length === 0" :description="t('prompt.emptyHistory')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePromptStore } from '../../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}
</script>

<style scoped>
.history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.history-item { margin-bottom: 8px; }
.history-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.history-model { font-size: 12px; color: var(--el-text-color-secondary); }
.history-preview { color: var(--el-text-color-regular); font-size: 13px; }
</style>
