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
          <pre class="json-block" v-html="highlightJson(JSON.stringify(detail.modelParams, null, 2))"></pre>
        </section>
        <section>
          <h4>{{ t('llmCallLogs.detail.request') }}</h4>
          <pre class="json-block" v-html="highlightJson(JSON.stringify(detail.request, null, 2))"></pre>
        </section>
        <section v-if="detail.response">
          <h4>{{ t('llmCallLogs.detail.response') }}</h4>
          <pre class="json-block" v-html="highlightJson(JSON.stringify(detail.response, null, 2))"></pre>
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useLLMCallLogsStore, type LLMCallLogRecord, type LLMCallLogFilter } from '../stores/llmCallLogs'
import { usePromptStore } from '../stores/prompt'
import { highlightJson } from '../utils/jsonHighlight'

const { t } = useI18n()
const store = useLLMCallLogsStore()
const promptStore = usePromptStore()

const SOURCES = ['apiTester', 'prompt', 'stream', 'test-connection'] as const

const filters = ref<Partial<LLMCallLogFilter>>({})
const dateRange = ref<[Date, Date] | null>(null)
const drawerOpen = ref(false)
const detail = ref<LLMCallLogRecord | null>(null)

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

function applyFilters() {
  store.setFilters({
    from: dateRange.value?.[0]?.getTime(),
    to: dateRange.value?.[1]?.getTime(),
    modelKey: filters.value.modelKey,
    source: filters.value.source,
    status: filters.value.status,
  })
}

async function handleSearch() {
  applyFilters()
  await store.fetchList()
}

function handleReset() {
  dateRange.value = null
  filters.value = {}
  store.setFilters({ from: undefined, to: undefined, modelKey: undefined, source: undefined, status: undefined })
  store.fetchList()
}

async function handlePageChange(p: number) {
  store.setPage(p)
  await store.fetchList()
}

function openDetail(row: LLMCallLogRecord) {
  detail.value = row
  drawerOpen.value = true
}

async function handleClear() {
  const from = dateRange.value?.[0]?.getTime() ?? 0
  const to = dateRange.value?.[1]?.getTime() ?? Date.now()
  const r = await store.clearRange(from, to)
  if (r.deleted > 0) ElMessage.success(`${t('llmCallLogs.cleared')} ${r.deleted}`)
  else ElMessage.info(t('llmCallLogs.nothingCleared'))
  await store.fetchList()
}

onMounted(async () => {
  await store.fetchList()
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
.json-block { background: #1e1e1e; color: #d4d4d4; border-radius: 6px; padding: 12px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; line-height: 1.6; max-height: 40vh; overflow: auto; }
.json-block :deep(.tok-key) { color: #9cdcfe; }
.json-block :deep(.tok-string) { color: #ce9178; }
.json-block :deep(.tok-number) { color: #b5cea8; }
.json-block :deep(.tok-keyword) { color: #569cd6; }
.json-block :deep(.tok-bracket) { background: #264f78; color: #fff; border-radius: 2px; box-shadow: 0 0 0 1px #569cd6; }
.json-block :deep(.tok-bracket-region) { background: rgba(86, 156, 214, 0.12); }
</style>
