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
      <el-col :xs="24" :md="12" class="panel-col">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="panel-header">
              <span>{{ t('apiTester.requestPayload') }}</span>
              <div class="panel-actions">
                <el-button size="small" @click="loadExample">{{ t('apiTester.loadExample') }}</el-button>
                <el-button size="small" type="primary" plain class="format-btn" @click="formatPayload">
                  <el-icon><MagicStick /></el-icon>
                  <span>{{ t('apiTester.format') }}</span>
                </el-button>
                <el-button size="small" @click="clearPayload">{{ t('apiTester.clear') }}</el-button>
              </div>
            </div>
          </template>
          <el-dropdown trigger="contextmenu" class="editor-dropdown" @command="onInputMenu">
            <div class="editor-wrap" @contextmenu.prevent>
              <Codemirror v-model="payloadText" :extensions="editableExtensions" />
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="format">
                  <el-icon><MagicStick /></el-icon>{{ t('apiTester.format') }}
                </el-dropdown-item>
                <el-dropdown-item command="copy">
                  <el-icon><CopyDocument /></el-icon>{{ t('apiTester.copy') }}
                </el-dropdown-item>
                <el-dropdown-item command="clear" divided>
                  <el-icon><Delete /></el-icon>{{ t('apiTester.clear') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12" class="panel-col">
        <el-card shadow="never" class="panel-card">
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
                  <el-icon><CopyDocument /></el-icon>
                  <span>{{ t('apiTester.copy') }}</span>
                </el-button>
              </div>
            </div>
          </template>
          <el-dropdown trigger="contextmenu" class="response-dropdown" @command="onOutputMenu">
            <div class="editor-wrap" @contextmenu.prevent>
              <Codemirror
                v-if="store.apiTesterResponse"
                :model-value="store.apiTesterResponse"
                :extensions="readonlyExtensions"
              />
              <span v-else class="placeholder">{{ t('apiTester.responsePlaceholder') }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="copy" :disabled="!store.apiTesterResponse">
                  <el-icon><CopyDocument /></el-icon>{{ t('apiTester.copy') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
import { Codemirror } from 'vue-codemirror'
import { keymap } from '@codemirror/view'
import { MagicStick, CopyDocument, Delete } from '@element-plus/icons-vue'
import { usePromptStore } from '../stores/prompt'
import { editableJsonExtensions, readonlyJsonExtensions, formatJson } from '../utils/jsonCodeMirror'

const { t } = useI18n()
const store = usePromptStore()

const payloadText = ref('')

// Component-local keybindings on top of the shared editable extensions.
const editableExtensions = [
  ...editableJsonExtensions,
  keymap.of([
    { key: 'Mod-Shift-f', run: () => (formatPayload(), true) },
    { key: 'Mod-Enter', run: () => (onSend(), true) },
  ]),
]
const readonlyExtensions = readonlyJsonExtensions

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
    payloadText.value = formatJson(payloadText.value)
  } catch {
    ElMessage.error(t('apiTester.invalidJson'))
  }
}

function onInputMenu(command: string) {
  if (command === 'format') formatPayload()
  else if (command === 'copy') copyPayload()
  else if (command === 'clear') clearPayload()
}

function onOutputMenu(command: string) {
  if (command === 'copy') copyResponse()
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
    const formatted = formatJson(payloadText.value)
    if (formatted !== payloadText.value) payloadText.value = formatted
  } catch {
    ElMessage.error(t('apiTester.invalidJson'))
    return
  }
  await store.sendRawRequest(parsed)
}

async function copyPayload() {
  try {
    await navigator.clipboard.writeText(payloadText.value)
    ElMessage.success(t('apiTester.copied'))
  } catch {
    ElMessage.error(t('apiTester.copyFailed'))
  }
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
.api-tester { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.tester-header { margin-bottom: 12px; flex-shrink: 0; }
.header-row { display: flex; align-items: center; gap: 12px; }
.label { font-weight: 600; }
.model-select { width: 320px; }
.tester-body { flex: 1; min-height: 0; margin-bottom: 12px; overflow: hidden; }
.panel-header { display: flex; justify-content: space-between; align-items: center; }
.panel-actions { display: flex; align-items: center; gap: 4px; }

/* Constrain panels to the visible height so long JSON scrolls internally
   and the send bar below is never pushed out of view. */
.panel-col { height: 100%; }
.panel-card { height: 100%; display: flex; flex-direction: column; animation: panel-rise 0.3s ease both; }
.panel-col:nth-child(2) .panel-card { animation-delay: 0.06s; }
@keyframes panel-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.panel-card :deep(.el-card__body) { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

/* Button hover/press feedback. */
.panel-actions :deep(.el-button),
.send-bar :deep(.el-button) { transition: transform 0.12s ease, box-shadow 0.12s ease; }
.panel-actions :deep(.el-button:active),
.send-bar :deep(.el-button:active) { transform: scale(0.97); }
.format-btn { font-weight: 600; }

/* The el-dropdown wrappers inherit the panel body's stretch so the editors
   still fill the available height. vue-codemirror's root is display: contents,
   so the visible .cm-editor is the flex item here. */
.editor-dropdown,
.response-dropdown { flex: 1; min-height: 0; display: flex; }

.editor-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fdfdfe;
  border: 1px solid #e2e5ea;
  border-radius: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.editor-wrap:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.18);
}
.editor-wrap :deep(.cm-editor) { flex: 1; min-height: 0; }

.placeholder { color: var(--el-text-color-placeholder); padding: 4px; }
.send-bar { flex-shrink: 0; margin-top: 4px; }
.mt-2 { margin-top: 8px; }

@media (max-width: 767px) {
  .api-tester { overflow-y: auto; }
  .tester-body { flex: none; overflow: visible; }
  .panel-col { height: 420px; margin-bottom: 12px; }
}
</style>
