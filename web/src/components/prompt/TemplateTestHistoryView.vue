// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08
<template>
  <div class="template-test-history">
    <div class="header">
      <h2>{{ t('prompt.templateTestHistory') }}</h2>
      <el-select v-model="selectedTemplateId" :placeholder="t('prompt.selectTemplate')" clearable>
        <el-option :label="t('prompt.allTemplates')" value="" />
        <el-option
          v-for="t in templates"
          :key="t.id"
          :label="t.name"
          :value="t.id"
        />
      </el-select>
    </div>

    <div class="history-list">
      <el-card
        v-for="record in filteredRecords"
        :key="record.id"
        shadow="never"
        class="history-card"
      >
        <div class="card-header">
          <span class="template-name">{{ record.templateName }}</span>
          <span class="timestamp">{{ formatTime(record.timestamp) }}</span>
        </div>

        <div class="card-content">
          <div class="variables">
            <strong>{{ t('prompt.variables') || '变量值' }}:</strong>
            <pre>{{ JSON.stringify(record.variables, null, 2) }}</pre>
          </div>

          <div class="output">
            <strong>{{ t('prompt.output') || '输出' }}:</strong>
            <pre>{{ truncate(record.output, 200) }}</pre>
          </div>

          <div v-if="record.duration" class="duration">
            {{ t('prompt.testDuration') }}: {{ record.duration }}ms
          </div>
        </div>

        <div class="card-actions">
          <el-button size="small" @click="viewDetail(record)">
            {{ t('prompt.viewDetail') }}
          </el-button>
          <el-button type="danger" size="small" @click="onDelete(record.id)">
            {{ t('prompt.delete') }}
          </el-button>
        </div>
      </el-card>
    </div>

    <el-empty v-if="filteredRecords.length === 0" :description="t('prompt.noHistory')" />

    <!-- 详情对话框 -->
    <el-dialog v-model="showDetailDialog" :title="t('prompt.testDetail')" width="70%">
      <div v-if="selectedRecord" class="detail-content">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('prompt.template')">
            {{ selectedRecord.templateName }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('prompt.model')">
            {{ selectedRecord.modelInfo.name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('prompt.timestamp')">
            {{ formatTime(selectedRecord.timestamp) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="selectedRecord.duration" :label="t('prompt.testDuration')">
            {{ selectedRecord.duration }}ms
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <h4>{{ t('prompt.variables') }}</h4>
          <pre>{{ JSON.stringify(selectedRecord.variables, null, 2) }}</pre>
        </div>

        <div class="detail-section">
          <h4>{{ t('prompt.output') }}</h4>
          <pre>{{ selectedRecord.output }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'
import { usePromptStore } from '../../stores/prompt'
import type { TemplateTestRecord } from '../../types/prompt'

const { t } = useI18n()
const store = usePromptStore()

const selectedTemplateId = ref('')
const showDetailDialog = ref(false)
const selectedRecord = ref<TemplateTestRecord | null>(null)

const templates = computed(() => store.templates)
const filteredRecords = computed(() => store.templateTestHistory)

onMounted(async () => {
  await store.loadTemplateTestHistory()
})

watch(selectedTemplateId, async (val) => {
  await store.loadTemplateTestHistory(val || undefined)
})

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function truncate(text: string, maxLen: number = 200): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

function viewDetail(record: TemplateTestRecord) {
  selectedRecord.value = record
  showDetailDialog.value = true
}

async function onDelete(recordId: string) {
  try {
    await ElMessageBox.confirm(
      t('prompt.confirmDeleteRecord'),
      t('prompt.delete'),
      { type: 'warning' }
    )
    // 由于后端 deleteRecord 未实现,这里暂时仅从本地状态移除
    const index = store.templateTestHistory.findIndex(r => r.id === recordId)
    if (index > -1) {
      store.templateTestHistory.splice(index, 1)
    }
  } catch {
    // User cancelled
  }
}
// [AGC:END]
</script>

<style scoped>
.template-test-history {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.template-name {
  font-weight: 600;
  font-size: 16px;
}

.timestamp {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.variables pre,
.output pre {
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 4px 0;
}

.duration {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  margin-top: 16px;
}

.detail-section h4 {
  margin-bottom: 8px;
}

.detail-section pre {
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
