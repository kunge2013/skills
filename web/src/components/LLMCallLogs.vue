<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-10 -->
<template>
  <div class="llm-call-logs">
    <div class="filter-bar">
      <el-date-picker
        v-model="dateRange"
        type="datetimerange"
        :start-placeholder="t('llmCallLogs.filterStart')"
        :end-placeholder="t('llmCallLogs.filterEnd')"
        style="width: 320px"
      />
      <el-select v-model="filters.modelKey" :placeholder="t('llmCallLogs.filterModel')" clearable style="width: 200px">
        <el-option v-for="m in promptStore.allModels" :key="m.id" :label="m.name" :value="m.id" />
      </el-select>
      <el-select v-model="filters.source" :placeholder="t('llmCallLogs.filterSource')" clearable style="width: 140px">
        <el-option v-for="s in SOURCES" :key="s" :label="t(`llmCallLogs.source.${s}`)" :value="s" />
      </el-select>
      <el-select v-model="filters.status" :placeholder="t('llmCallLogs.filterStatus')" clearable style="width: 120px">
        <el-option :label="t('llmCallLogs.statusSuccess')" :value="200" />
        <el-option :label="t('llmCallLogs.statusFailed')" :value="500" />
      </el-select>
      <el-button type="primary" @click="handleSearch" :loading="store.loading">{{ t('llmCallLogs.search') }}</el-button>
      <el-button @click="handleReset">{{ t('llmCallLogs.reset') }}</el-button>
      <el-button type="danger" plain @click="handleClear" :disabled="!store.total">{{ t('llmCallLogs.clearLogs') }}</el-button>
    </div>

    <el-table :data="store.items" v-loading="store.loading" @row-click="openDetail" class="log-table">
      <el-table-column prop="timestamp" :label="t('llmCallLogs.columns.time')" width="180">
        <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
      </el-table-column>
      <el-table-column prop="modelKey" :label="t('llmCallLogs.columns.model')" min-width="160" />
      <el-table-column prop="source" :label="t('llmCallLogs.columns.source')" width="120">
        <template #default="{ row }">{{ t(`llmCallLogs.source.${row.source}`) }}</template>
      </el-table-column>
      <el-table-column prop="status" :label="t('llmCallLogs.columns.status')" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 200 ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="durationMs" :label="t('llmCallLogs.columns.duration')" width="110">
        <template #default="{ row }">{{ row.durationMs }} ms</template>
      </el-table-column>
      <el-table-column :label="t('llmCallLogs.columns.thumbnail')" width="60">
        <template #default="{ row }">
          <img v-if="getFirstImageUrl(row)" :src="getFirstImageUrl(row)" class="thumbnail" @click.stop />
        </template>
      </el-table-column>
      <el-table-column :label="t('llmCallLogs.columns.summary')" min-width="220">
        <template #default="{ row }">{{ summarize(row) }}</template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        layout="total, prev, pager, next"
        :total="store.total"
        :page-size="store.pageSize"
        :current-page="store.page"
        @current-change="handlePageChange"
      />
    </div>

    <el-drawer v-model="drawerOpen" :title="t('llmCallLogs.detailTitle')" size="55%">
      <div v-if="detail" class="detail">
        <section v-if="Object.keys(detail.modelParams).length">
          <h4>{{ t('llmCallLogs.detail.params') }}</h4>
          <div class="editor-wrap">
            <Codemirror :model-value="jsonText(detail.modelParams)" :extensions="readonlyExtensions" />
          </div>
        </section>
        <section>
          <h4>{{ t('llmCallLogs.detail.request') }}</h4>
          <div class="editor-wrap">
            <Codemirror :model-value="jsonText(detail.request)" :extensions="readonlyExtensions" />
          </div>
        </section>
        <!-- 图片预览区域 -->
        <section v-if="isImageSource && imageUrls.length > 0">
          <h4>{{ t('llmCallLogs.detail.generatedImages', '生成图片') }}</h4>
          <div class="image-preview-grid">
            <el-image
              v-for="(url, index) in imageUrls"
              :key="index"
              :src="url"
              :preview-src-list="imageUrls"
              :initial-index="index"
              fit="contain"
              class="preview-image"
            />
          </div>
        </section>
        <section v-if="detail.response">
          <h4>{{ t('llmCallLogs.detail.response') }}</h4>
          <div class="editor-wrap">
            <Codemirror :model-value="jsonText(detail.response)" :extensions="readonlyExtensions" />
          </div>
        </section>
        <section v-if="detail.error">
          <h4>{{ t('llmCallLogs.detail.error') }}</h4>
          <el-alert type="error" :title="detail.error" show-icon />
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Codemirror } from 'vue-codemirror'
import { useLLMCallLogsStore, type LLMCallLogRecord, type LLMCallLogFilter } from '../stores/llmCallLogs'
import { usePromptStore } from '../stores/prompt'
import { readonlyJsonExtensions } from '../utils/jsonCodeMirror'

const { t } = useI18n()
const store = useLLMCallLogsStore()
const promptStore = usePromptStore()

const readonlyExtensions = readonlyJsonExtensions

function jsonText(obj: Record<string, unknown> | null | undefined): string {
  return JSON.stringify(obj ?? {}, null, 2)
}

const SOURCES = ['apiTester', 'prompt', 'stream', 'test-connection', 'image'] as const

const filters = ref<Partial<LLMCallLogFilter>>({})
const dateRange = ref<[Date, Date] | null>(null)
const drawerOpen = ref(false)
const detail = ref<LLMCallLogRecord | null>(null)

const isImageSource = computed(() => {
  return detail.value?.source === 'image'
})

const imageUrls = computed(() => {
  if (!detail.value?.response) return []
  const response = detail.value.response as any
  // Support both 'images' and 'results' fields
  const images = response?.images || response?.results || []
  if (Array.isArray(images)) {
    return images
      .map((item: unknown) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'url' in item) return (item as { url: string }).url
        return null
      })
      .filter((url: unknown) => typeof url === 'string' && url.startsWith('/images/'))
  }
  return []
})

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function summarize(row: LLMCallLogRecord): string {
  const req = row.request as any
  const messages: any[] | undefined = req?.messages
  if (Array.isArray(messages) && messages.length > 0) {
    const last = messages[messages.length - 1]
    const text = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '')
    return text.length > 80 ? text.slice(0, 80) + '…' : text
  }
  const s = JSON.stringify(req ?? '')
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

// [AGC:START] tool=Cc author=fangkun
function getFirstImageUrl(row: LLMCallLogRecord): string | undefined {
  if (row.source !== 'image') return undefined
  const response = row.response as any
  const items = response?.images || response?.results || []
  if (!Array.isArray(items) || items.length === 0) return undefined
  const first = items[0]
  if (typeof first === 'string') return first.startsWith('/images/') ? first : undefined
  if (first?.url && typeof first.url === 'string') return first.url.startsWith('/images/') ? first.url : undefined
  return undefined
}
// [AGC:END]

function applyFilters() {
  store.setFilters({
    from: dateRange.value?.[0]?.getTime(),
    to: dateRange.value?.[1]?.getTime(),
    modelKey: filters.value.modelKey,
    source: filters.value.source,
    status: filters.value.status,
  })
}

function reportError(e: unknown) {
  ElMessage.error(e instanceof Error ? e.message : String(e))
}

async function handleSearch() {
  applyFilters()
  try { await store.fetchList() } catch (e) { reportError(e) }
}

async function handleReset() {
  dateRange.value = null
  filters.value = {}
  store.setFilters({ from: undefined, to: undefined, modelKey: undefined, source: undefined, status: undefined })
  try { await store.fetchList() } catch (e) { reportError(e) }
}

async function handlePageChange(p: number) {
  store.setPage(p)
  try { await store.fetchList() } catch (e) { reportError(e) }
}

function openDetail(row: LLMCallLogRecord) {
  detail.value = row
  drawerOpen.value = true
}

async function handleClear() {
  const from = dateRange.value?.[0]?.getTime() ?? 0
  const to = dateRange.value?.[1]?.getTime() ?? Date.now()
  try {
    const r = await store.clearRange(from, to)
    if (r.deleted > 0) ElMessage.success(`${t('llmCallLogs.cleared')} ${r.deleted}`)
    else ElMessage.info(t('llmCallLogs.nothingCleared'))
    await store.fetchList()
  } catch (e) { reportError(e) }
}

onMounted(async () => {
  try { await store.fetchList() } catch (e) { reportError(e) }
})
// [AGC:END]
</script>

<style scoped>
.llm-call-logs { height: 100%; display: flex; flex-direction: column; padding: 16px; box-sizing: border-box; }
.filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; }
.log-table { flex: 1; }
.pager { margin-top: 12px; display: flex; justify-content: flex-end; }
.detail section { margin-bottom: 16px; }
.detail h4 { margin: 0 0 8px; }
.editor-wrap {
  background-color: #fdfdfe;
  border: 1px solid #e2e5ea;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.editor-wrap:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.18);
}
.editor-wrap :deep(.cm-editor) {
  min-height: 120px;
  max-height: 40vh;
}
.image-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.preview-image {
  width: 200px;
  height: 200px;
  border: 1px solid #e2e5ea;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.preview-image:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.thumbnail {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}
</style>
