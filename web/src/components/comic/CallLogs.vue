<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-29 -->
<template>
  <div class="call-logs">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <el-select v-model="filter.novel_id" :placeholder="$t('comic.filterNovel')" clearable filterable @change="applyFilter" style="min-width: 150px;">
        <el-option v-for="n in store.novels" :key="n.id" :label="n.name" :value="n.id" />
      </el-select>
      <el-select v-model="filter.stage" :placeholder="$t('comic.filterStage')" clearable @change="applyFilter" style="min-width: 130px;">
        <el-option label="格式清洗" value="format_clean" />
        <el-option label="连字清洗" value="serial_clean" />
        <el-option label="标点清洗" value="punct_clean" />
        <el-option label="分镜清洗" value="shot_clean" />
        <el-option label="提取" value="extract" />
        <el-option label="剧本化" value="script" />
        <el-option label="分镜化" value="storyboard" />
      </el-select>
      <el-select v-model="filter.status" :placeholder="$t('comic.filterStatus')" clearable @change="applyFilter" style="min-width: 130px;">
        <el-option label="成功" :value="200" />
        <el-option label="失败" :value="500" />
      </el-select>
      <el-button size="small" @click="applyFilter">🔍 {{ $t('comic.search') }}</el-button>
      <el-button size="small" type="danger" @click="handleDeleteAll" style="margin-left: auto;">
        🗑️ {{ $t('comic.deleteAll') }}
      </el-button>
    </div>

    <!-- Stats Summary -->
    <div class="stats-summary">
      {{ $t('comic.totalLogs', { count: store.callLogsTotal }) }}
      <span v-if="computedStats.totalDuration"> · {{ $t('comic.totalDuration') }} {{ computedStats.totalDuration }}</span>
      · {{ $t('comic.success') }} {{ computedStats.successCount }} / {{ $t('comic.failure') }} {{ computedStats.failureCount }}
    </div>

    <!-- Records Table -->
    <table class="record-table">
      <thead>
        <tr>
          <th>{{ $t('comic.time') }}</th>
          <th>{{ $t('comic.novel') }}</th>
          <th>{{ $t('comic.stage') }}</th>
          <th>{{ $t('comic.template') }}</th>
          <th>{{ $t('comic.model') }}</th>
          <th>{{ $t('comic.duration') }}</th>
          <th>{{ $t('comic.chars') }}</th>
          <th>{{ $t('comic.status') }}</th>
          <th>{{ $t('comic.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in store.callLogs" :key="log.id">
          <td class="time-cell">{{ formatTime(log.created_at) }}</td>
          <td>{{ getNovelName(log.novel_id) }}</td>
          <td>
            <el-tag size="small" :type="getStageTagType(log.stage)">{{ getStageName(log.stage) }}</el-tag>
          </td>
          <td class="template-cell">{{ getTemplateName(log.template_id) }}</td>
          <td class="model-cell">{{ log.model_key || '-' }}</td>
          <td class="duration-cell">{{ log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '-' }}</td>
          <td class="chars-cell">{{ log.output ? log.output.length.toLocaleString() : '-' }}</td>
          <td>
            <span class="status-badge" :class="log.status === 200 ? 'success' : 'error'">
              {{ log.status === 200 ? $t('comic.successShort') : $t('comic.failureShort') }}
            </span>
          </td>
          <td class="actions-cell">
            <el-button size="small" text type="primary" @click="showDetail(log)">
              {{ $t('comic.detail') }}
            </el-button>
            <el-button size="small" text type="primary" @click="rerunLog(log)">
              🔄 {{ $t('comic.rerun') }}
            </el-button>
          </td>
        </tr>
        <tr v-if="store.callLogs.length === 0">
          <td colspan="9" class="empty-cell">
            <el-empty :description="$t('comic.noLogs')" :image-size="80" />
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="20"
        :total="store.callLogsTotal"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>

    <!-- Detail Dialog -->
    <el-dialog v-model="showDetailDialog" :title="$t('comic.logDetail')" width="800px">
      <div v-if="selectedLog" class="log-detail">
        <!-- Basic Info -->
        <div class="detail-basic-info">
          <div class="info-item">
            <span class="info-label">{{ $t('comic.runId') }}</span>
            <code>{{ selectedLog.run_id || '-' }}</code>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('comic.novel') }}</span>
            <span>{{ getNovelName(selectedLog.novel_id) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('comic.stage') }}</span>
            <el-tag size="small" :type="getStageTagType(selectedLog.stage)">{{ getStageName(selectedLog.stage) }}</el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('comic.template') }}</span>
            <span>{{ getTemplateName(selectedLog.template_id) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('comic.model') }}</span>
            <span>{{ selectedLog.model_key || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('comic.duration') }}</span>
            <span>{{ selectedLog.duration_ms ? `${(selectedLog.duration_ms / 1000).toFixed(1)}s` : '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('comic.time') }}</span>
            <span>{{ formatTime(selectedLog.created_at) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('comic.status') }}</span>
            <span class="status-badge" :class="selectedLog.status === 200 ? 'success' : 'error'">
              {{ selectedLog.status === 200 ? $t('comic.successShort') : $t('comic.failureShort') }}
            </span>
          </div>
        </div>

        <!-- Input Variables - dark code block -->
        <div class="detail-section">
          <div class="section-title">📥 {{ $t('comic.inputVariables') }}</div>
          <div class="dark-code-block">
            <pre>{{ formatInputVariables(selectedLog.input_variables) }}</pre>
          </div>
        </div>

        <!-- Output - dark code block -->
        <div v-if="selectedLog.output" class="detail-section">
          <div class="section-title">📤 {{ $t('comic.output') }}
            <span class="output-chars">{{ selectedLog.output.length.toLocaleString() }} {{ $t('comic.chars') }}</span>
          </div>
          <div class="dark-code-block">
            <pre>{{ selectedLog.output }}</pre>
          </div>
        </div>

        <!-- Error -->
        <div v-if="selectedLog.error" class="detail-section">
          <div class="section-title error-title">❌ {{ $t('comic.error') }}</div>
          <div class="error-block">
            <pre>{{ selectedLog.error }}</pre>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="copyLogDetail">{{ $t('comic.copy') }}</el-button>
        <el-button type="primary" @click="showDetailDialog = false">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useComicStore } from '../../stores/comic'
import type { ComicCallLog, ComicStage } from '../../types/comic'

const { t } = useI18n()
const store = useComicStore()

const currentPage = ref(1)
const showDetailDialog = ref(false)
const selectedLog = ref<ComicCallLog | null>(null)

const filter = reactive({
  novel_id: '',
  stage: '' as ComicStage | '',
  status: undefined as number | undefined,
})

const computedStats = computed(() => {
  const logs = store.callLogs
  const successCount = logs.filter(l => l.status === 200).length
  const failureCount = logs.filter(l => l.status !== 200).length
  const totalDurationMs = logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0)
  const totalDuration = totalDurationMs > 0
    ? totalDurationMs >= 60000
      ? `${Math.floor(totalDurationMs / 60000)}m ${Math.floor((totalDurationMs % 60000) / 1000)}s`
      : `${(totalDurationMs / 1000).toFixed(1)}s`
    : ''

  return { successCount, failureCount, totalDuration }
})

onMounted(() => {
  loadLogs()
})

async function loadLogs() {
  await store.loadCallLogs(currentPage.value)
}

function applyFilter() {
  store.setCallLogsFilter({
    novel_id: filter.novel_id || undefined,
    stage: filter.stage || undefined,
    status: filter.status,
  })
  currentPage.value = 1
  loadLogs()
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadLogs()
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const sec = String(d.getSeconds()).padStart(2, '0')
  return `${month}-${day} ${hour}:${min}:${sec}`
}

function getNovelName(novelId: string | null): string {
  if (!novelId) return '-'
  const novel = store.novels.find(n => n.id === novelId)
  return novel?.name || novelId.slice(0, 8)
}

function getTemplateName(templateId: string | null): string {
  if (!templateId) return '-'
  const template = store.templates.find(t => t.id === templateId)
  return template?.name || templateId.slice(0, 8)
}

function getStageName(stage: ComicStage | null): string {
  if (!stage) return '-'
  const stageMap: Record<ComicStage, string> = {
    format_clean: '清洗',
    serial_clean: '清洗',
    punct_clean: '清洗',
    shot_clean: '清洗',
    extract: '提取',
    script: '剧本化',
    storyboard: '分镜化',
  }
  return stageMap[stage] || stage
}

function getStageTagType(stage: ComicStage | null): 'success' | 'warning' | 'primary' | 'danger' | 'info' {
  if (!stage) return 'info'
  if (stage.includes('clean')) return 'success'
  if (stage === 'extract') return 'primary'
  if (stage === 'script') return 'warning'
  if (stage === 'storyboard') return 'danger'
  return 'info'
}

function formatInputVariables(input: Record<string, unknown> | null | undefined): string {
  if (!input) return '{}'
  try {
    return JSON.stringify(input, null, 2)
  } catch {
    return String(input)
  }
}

function showDetail(log: ComicCallLog) {
  selectedLog.value = log
  showDetailDialog.value = true
}

async function copyLogDetail() {
  if (!selectedLog.value) return
  try {
    const text = JSON.stringify({
      id: selectedLog.value.id,
      run_id: selectedLog.value.run_id,
      novel_id: selectedLog.value.novel_id,
      stage: selectedLog.value.stage,
      template_id: selectedLog.value.template_id,
      model_key: selectedLog.value.model_key,
      duration_ms: selectedLog.value.duration_ms,
      input_variables: selectedLog.value.input_variables,
      output: selectedLog.value.output,
      error: selectedLog.value.error,
    }, null, 2)
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('comic.copied'))
  } catch (e) {
    ElMessage.error(t('comic.copyFailed'))
  }
}

function rerunLog(log: ComicCallLog) {
  store.setSelectedNovel(log.novel_id || '')
  store.setActiveTab('pipeline')
}

async function handleDeleteAll() {
  try {
    await ElMessageBox.confirm(
      t('comic.deleteAllConfirm'),
      t('common.confirm'),
      { type: 'warning' }
    )
    await store.deleteCallLogs()
    ElMessage.success(t('comic.deleteSuccess'))
    await loadLogs()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.message)
    }
  }
}
// [AGC:END]
</script>

<style scoped>
.call-logs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

/* Stats Summary */
.stats-summary {
  font-size: 13px;
  color: #666;
  margin-bottom: 10px;
}

/* Record Table */
.record-table {
  width: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-collapse: collapse;
}

.record-table th {
  background: #fafafa;
  padding: 10px 14px;
  text-align: left;
  font-size: 13px;
  color: #666;
  font-weight: 500;
  border-bottom: 1px solid #e8e8e8;
}

.record-table td {
  padding: 10px 14px;
  font-size: 13px;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
}

.record-table tr:last-child td {
  border-bottom: none;
}

.record-table tr:hover td {
  background: #f5f5f5;
}

.time-cell {
  color: #999;
  font-size: 12px;
}

.template-cell {
  font-size: 12px;
}

.model-cell {
  font-size: 12px;
  color: #666;
}

.duration-cell {
  font-size: 12px;
}

.chars-cell {
  font-size: 12px;
}

.actions-cell {
  white-space: nowrap;
}

.empty-cell {
  text-align: center;
  padding: 40px 14px !important;
}

/* Status Badge */
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.status-badge.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.error {
  background: #fce4ec;
  color: #c62828;
}

/* Pagination */
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

/* Detail Dialog */
.log-detail {
  max-height: 70vh;
  overflow: auto;
}

.detail-basic-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  color: #999;
  font-size: 12px;
}

.info-item code {
  font-size: 12px;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}

.detail-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.error-title {
  color: #ff4d4f;
}

.output-chars {
  font-size: 12px;
  color: #999;
  font-weight: normal;
  margin-left: 8px;
}

/* Dark code blocks */
.dark-code-block {
  background: #1e1e1e;
  border-radius: 6px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.dark-code-block pre {
  color: #d4d4d4;
  font-size: 12px;
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', monospace;
}

/* Error block */
.error-block {
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 6px;
  padding: 12px;
}

.error-block pre {
  color: #cf1322;
  font-size: 12px;
  margin: 0;
  white-space: pre-wrap;
}
</style>
