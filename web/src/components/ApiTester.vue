<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-10 -->
<template>
  <div class="api-tester">
    <el-card shadow="never" class="tester-header">
      <div class="header-row">
        <span class="label">{{ t('apiTester.selectModel') }}</span>
        <el-select
          v-model="store.selectedModelKey"
          class="model-select"
          :placeholder="t('apiTester.selectModelPlaceholder')"
          @change="onModelChange"
        >
          <el-option
            v-for="m in store.enabledModels"
            :key="m.id"
            :label="`${m.name} (${m.id})`"
            :value="m.id"
          />
        </el-select>
        <el-tag v-if="selectedProtocol" size="small" type="info">
          {{ t('apiTester.protocol') }}: {{ selectedProtocol }}
        </el-tag>
      </div>
    </el-card>

    <el-row :gutter="16" class="tester-body">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>
            <div class="panel-header">
              <span>{{ t('apiTester.requestPayload') }}</span>
              <div class="panel-actions">
                <el-button size="small" @click="loadExample">{{ t('apiTester.loadExample') }}</el-button>
                <el-button size="small" @click="formatPayload">{{ t('apiTester.format') }}</el-button>
                <el-button size="small" @click="clearPayload">{{ t('apiTester.clear') }}</el-button>
              </div>
            </div>
          </template>
          <el-input
            v-model="payloadText"
            type="textarea"
            :rows="16"
            resize="vertical"
            class="json-editor"
            spellcheck="false"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>
            <div class="panel-header">
              <span>{{ t('apiTester.response') }}</span>
              <div class="panel-actions">
                <el-tag v-if="store.apiTesterStatus" size="small" :type="store.apiTesterStatus >= 400 ? 'danger' : 'success'">
                  HTTP {{ store.apiTesterStatus }}
                </el-tag>
                <el-tag v-if="store.apiTesterDuration" size="small" type="info">
                  {{ t('apiTester.duration') }}: {{ (store.apiTesterDuration / 1000).toFixed(2) }}s
                </el-tag>
                <el-button size="small" :disabled="!store.apiTesterResponse" @click="copyResponse">
                  {{ t('apiTester.copy') }}
                </el-button>
              </div>
            </div>
          </template>
          <div class="response-display">
            <pre v-if="store.apiTesterResponse">{{ store.apiTesterResponse }}</pre>
            <span v-else class="placeholder">{{ t('apiTester.responsePlaceholder') }}</span>
          </div>
          <el-alert v-if="store.apiTesterError" type="error" :title="store.apiTesterError" show-icon closable class="mt-2" />
        </el-card>
      </el-col>
    </el-row>

    <div class="send-bar">
      <el-button
        type="primary"
        :loading="store.apiTesterLoading"
        :disabled="!store.selectedModelKey"
        @click="onSend"
      >
        {{ store.apiTesterLoading ? t('apiTester.sending') : t('apiTester.send') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { usePromptStore } from '../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()

const payloadText = ref('')

const OPENAI_EXAMPLE = JSON.stringify(
  {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ],
    temperature: 0.7,
    max_tokens: 100,
  },
  null,
  2
)

const ANTHROPIC_EXAMPLE = JSON.stringify(
  {
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello!' }],
    max_tokens: 8192,
    temperature: 0.7,
  },
  null,
  2
)

const selectedProtocol = computed(() => {
  const m = store.allModels.find((x) => x.id === store.selectedModelKey)
  if (!m) return ''
  return m.protocol || (m.providerId === 'anthropic' ? 'anthropic' : 'openai')
})

function loadExample() {
  payloadText.value = selectedProtocol.value === 'anthropic' ? ANTHROPIC_EXAMPLE : OPENAI_EXAMPLE
}

function onModelChange() {
  const isEmpty = !payloadText.value.trim()
  const isCurrentExample = payloadText.value === OPENAI_EXAMPLE || payloadText.value === ANTHROPIC_EXAMPLE
  if (isEmpty || isCurrentExample) loadExample()
}

function formatPayload() {
  try {
    payloadText.value = JSON.stringify(JSON.parse(payloadText.value), null, 2)
  } catch {
    ElMessage.error(t('apiTester.invalidJson'))
  }
}

function clearPayload() {
  payloadText.value = ''
  store.apiTesterResponse = ''
  store.apiTesterError = ''
  store.apiTesterDuration = 0
  store.apiTesterStatus = 0
}

async function onSend() {
  let parsed: any
  try {
    parsed = JSON.parse(payloadText.value)
  } catch {
    ElMessage.error(t('apiTester.invalidJson'))
    return
  }
  await store.sendRawRequest(parsed)
}

async function copyResponse() {
  try {
    await navigator.clipboard.writeText(store.apiTesterResponse)
    ElMessage.success(t('apiTester.copied'))
  } catch {
    ElMessage.error(t('apiTester.copyFailed'))
  }
}

onMounted(() => {
  if (!payloadText.value && store.enabledModels.length > 0) loadExample()
})
// [AGC:END]
</script>

<style scoped>
.api-tester { padding: 0; }
.tester-header { margin-bottom: 12px; }
.header-row { display: flex; align-items: center; gap: 12px; }
.label { font-weight: 600; }
.model-select { width: 320px; }
.tester-body { margin-bottom: 12px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; }
.panel-actions { display: flex; align-items: center; gap: 4px; }
.json-editor :deep(textarea) { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; }
.response-display { background: var(--el-fill-color-light); border-radius: 4px; padding: 16px; min-height: 320px; overflow: auto; }
.response-display pre { white-space: pre-wrap; word-break: break-word; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; margin: 0; }
.placeholder { color: var(--el-text-color-placeholder); }
.send-bar { margin-top: 4px; }
.mt-2 { margin-top: 8px; }
</style>
