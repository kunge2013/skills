<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-29 -->
<template>
  <div class="call-logs">
    <div class="toolbar">
      <div class="filters">
        <el-select v-model="filter.novel_id" :placeholder="$t('comic.filterNovel')" clearable filterable @change="applyFilter">
          <el-option v-for="n in store.novels" :key="n.id" :label="n.name" :value="n.id" />
        </el-select>
        <el-select v-model="filter.stage" :placeholder="$t('comic.filterStage')" clearable @change="applyFilter">
          <el-option label="格式清洗" value="format_clean" />
          <el-option label="连字清洗" value="serial_clean" />
          <el-option label="标点清洗" value="punct_clean" />
          <el-option label="分镜清洗" value="shot_clean" />
          <el-option label="提取" value="extract" />
          <el-option label="剧本化" value="script" />
          <el-option label="分镜化" value="storyboard" />
        </el-select>
        <el-select v-model="filter.status" :placeholder="$t('comic.filterStatus')" clearable @change="applyFilter">
          <el-option label="成功" :value="200" />
          <el-option label="失败" :value="500" />
        </el-select>
        <el-button @click="clearFilters">{{ $t('comic.clearFilters') }}</el-button>
      </div>
      <div class="actions">
        <el-button type="danger" @click="handleDeleteAll">
          {{ $t('comic.deleteAll') }}
        </el-button>
      </div>
    </div>

    <div class="stats">
      {{ $t('comic.totalLogs', { count: store.callLogsTotal }) }}
    </div>

    <el-table :data="store.callLogs" stripe style="width: 100%">
      <el-table-column :label="$t('comic.time')" width="180">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('comic.novel')" min-width="150">
        <template #default="{ row }">
          {{ getNovelName(row.novel_id) }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('comic.stage')" width="120">
        <template #default="{ row }">
          <el-tag size="small">{{ getStageName(row.stage) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('comic.template')" min-width="150">
        <template #default="{ row }">
          {{ getTemplateName(row.template_id) }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('comic.model')" width="150">
        <template #default="{ row }">
          {{ row.model_key || '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('comic.duration')" width="100">
        <template #default="{ row }">
          {{ row.duration_ms ? `${(row.duration_ms / 1000).toFixed(1)}s` : '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('comic.chars')" width="100">
        <template #default="{ row }">
          {{ row.output ? row.output.length.toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('comic.status')" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 200 ? 'success' : 'danger'" size="small">
            {{ row.status === 200 ? '✓' : '✗' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('comic.actions')" width="120" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="showDetail(row)">
            {{ $t('comic.detail') }}
          </el-button>
          <el-button size="small" text type="danger" @click="handleDeleteLog(row)">
            {{ $t('comic.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

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
        <div class="detail-section">
          <h4>{{ $t('comic.basicInfo') }}</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>{{ $t('comic.runId') }}</label>
              <span>{{ selectedLog.run_id || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>{{ $t('comic.novel') }}</label>
              <span>{{ getNovelName(selectedLog.novel_id) }}</span>
            </div>
            <div class="detail-item">
              <label>{{ $t('comic.stage') }}</label>
              <span>{{ getStageName(selectedLog.stage) }}</span>
            </div>
            <div class="detail-item">
              <label>{{ $t('comic.template') }}</label>
              <span>{{ getTemplateName(selectedLog.template_id) }}</span>
            </div>
            <div class="detail-item">
              <label>{{ $t('comic.model') }}</label>
              <span>{{ selectedLog.model_key || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>{{ $t('comic.duration') }}</label>
              <span>{{ selectedLog.duration_ms ? `${(selectedLog.duration_ms / 1000).toFixed(1)}s` : '-' }}</span>
            </div>
            <div class="detail-item">
              <label>{{ $t('comic.status') }}</label>
              <span>{{ selectedLog.status === 200 ? '成功' : '失败' }}</span>
            </div>
            <div class="detail-item">
              <label>{{ $t('comic.time') }}</label>
              <span>{{ formatTime(selectedLog.created_at) }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>{{ $t('comic.inputVariables') }}</h4>
          <div v-for="(value, key) in selectedLog.input_variables" :key="key" class="var-detail">
            <label>{{ key }}</label>
            <div class="var-content">{{ value }}</div>
          </div>
        </div>

        <div v-if="selectedLog.output" class="detail-section">
          <h4>{{ $t('comic.output') }}</h4>
          <div class="output-content">{{ selectedLog.output }}</div>
        </div>

        <div v-if="selectedLog.error" class="detail-section">
          <h4>{{ $t('comic.error') }}</h4>
          <div class="error-content">{{ selectedLog.error }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, reactive, onMounted } from 'vue'
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
}

function clearFilters() {
  filter.novel_id = ''
  filter.stage = ''
  filter.status = undefined
  store.setCallLogsFilter({})
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadLogs()
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
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
    format_clean: '格式清洗',
    serial_clean: '连字清洗',
    punct_clean: '标点清洗',
    shot_clean: '分镜清洗',
    extract: '提取',
    script: '剧本化',
    storyboard: '分镜化',
  }
  return stageMap[stage] || stage
}

function showDetail(log: ComicCallLog) {
  selectedLog.value = log
  showDetailDialog.value = true
}

async function handleDeleteLog(log: ComicCallLog) {
  try {
    await ElMessageBox.confirm(
      t('comic.deleteLogConfirm'),
      t('common.confirm'),
      { type: 'warning' }
    )
    await store.deleteCallLogs({ novel_id: log.novel_id || undefined })
    ElMessage.success(t('comic.deleteSuccess'))
    await loadLogs()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.message)
    }
  }
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

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 4px;
}

.filters {
  display: flex;
  gap: 8px;
  flex: 1;
}

.stats {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.log-detail {
  max-height: 600px;
  overflow: auto;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item label {
  font-size: 12px;
  color: #999;
}

.detail-item span {
  font-size: 13px;
  color: #333;
}

.var-detail {
  margin-bottom: 12px;
}

.var-detail label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  font-weight: 500;
}

.var-content {
  background: #fafafa;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
}

.output-content {
  background: #f0f9ff;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
}

.error-content {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
}
</style>
