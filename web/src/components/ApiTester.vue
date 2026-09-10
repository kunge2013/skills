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
                <el-button size="small" @click="formatPayload">{{ t('apiTester.format') }}</el-button>
                <el-button size="small" @click="clearPayload">{{ t('apiTester.clear') }}</el-button>
              </div>
            </div>
          </template>
          <div class="json-editor">
            <pre ref="inputHighlightRef" class="editor-highlight" aria-hidden="true" v-html="highlightedInput"></pre>
            <textarea
              ref="inputTextareaRef"
              v-model="payloadText"
              class="editor-input"
              spellcheck="false"
              @input="onInputChanged"
              @scroll="syncScroll"
              @click="onInputActive"
              @keyup="onInputActive"
            ></textarea>
          </div>
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
                  {{ t('apiTester.copy') }}
                </el-button>
              </div>
            </div>
          </template>
          <div class="response-display" @click="onOutputClick">
            <pre ref="outputRef" v-if="store.apiTesterResponse" v-html="highlightedOutput"></pre>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { usePromptStore } from '../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()

const payloadText = ref('')
const inputTextareaRef = ref<HTMLTextAreaElement | null>(null)
const inputHighlightRef = ref<HTMLElement | null>(null)
const outputRef = ref<HTMLElement | null>(null)
const activeInputPair = ref<[number, number] | null>(null)
const outputPair = ref<[number, number] | null>(null)

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
  activeInputPair.value = null
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
  activeInputPair.value = null
}

function clearPayload() {
  payloadText.value = ''
  activeInputPair.value = null
  store.apiTesterResponse = ''
  store.apiTesterError = ''
  store.apiTesterDuration = 0
  store.apiTesterStatus = 0
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const isBracket = (ch: string): boolean => ch === '{' || ch === '}' || ch === '[' || ch === ']'

// Build a bidirectional map of matching bracket indices, ignoring brackets
// inside string literals (handles escaped quotes).
function buildBracketMap(text: string): Map<number, number> {
  const map = new Map<number, number>()
  const stack: number[] = []
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{' || ch === '[') {
      stack.push(i)
    } else if (ch === '}' || ch === ']') {
      const open = stack.pop()
      if (open !== undefined) {
        map.set(open, i)
        map.set(i, open)
      }
    }
  }
  return map
}

// Render a slice of raw JSON with the two matched brackets (`pair`) marked and
// the enclosed region tinted. Char-by-char runs keep the spans sparse.
function renderGap(json: string, start: number, end: number, lo: number, hi: number): string {
  if (start >= end) return ''
  const highlight = lo >= 0 && hi >= 0
  let out = ''
  let buf = ''
  let bufCls = ''
  const flush = () => {
    if (!buf) return
    out += bufCls ? `<span class="${bufCls}">${escapeHtml(buf)}</span>` : escapeHtml(buf)
    buf = ''
    bufCls = ''
  }
  for (let i = start; i < end; i++) {
    let cls = ''
    if (highlight) {
      if (i === lo || i === hi) cls = 'tok-bracket'
      else if (i > lo && i < hi) cls = 'tok-bracket-region'
    }
    if (cls !== bufCls) { flush(); bufCls = cls }
    buf += json[i]
  }
  flush()
  return out
}

// Highlight JSON tokens for the viewer. Content is escaped before wrapping, so
// the injected spans never carry unescaped user/server data. When `pair` is
// given, the brackets and the region between them are highlighted too.
function highlightJson(json: string, pair: [number, number] | null = null): string {
  const regex =
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  const lo = pair ? Math.min(pair[0], pair[1]) : -1
  const hi = pair ? Math.max(pair[0], pair[1]) : -1
  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(json)) !== null) {
    result += renderGap(json, lastIndex, match.index, lo, hi)
    let tokenHtml: string
    if (match[1]) {
      if (match[2]) {
        tokenHtml = `<span class="tok-key">${escapeHtml(match[1])}</span>${escapeHtml(match[2])}`
      } else {
        tokenHtml = `<span class="tok-string">${escapeHtml(match[1])}</span>`
      }
    } else {
      const token = match[0]
      const cls = /^(?:true|false|null)$/.test(token) ? 'tok-keyword' : 'tok-number'
      tokenHtml = `<span class="${cls}">${escapeHtml(token)}</span>`
    }
    const interior = lo >= 0 && hi >= 0 && match.index >= lo && regex.lastIndex <= hi
    result += interior ? `<span class="tok-bracket-region">${tokenHtml}</span>` : tokenHtml
    lastIndex = regex.lastIndex
  }
  result += renderGap(json, lastIndex, json.length, lo, hi)
  return result
}

const inputBracketMap = computed(() => buildBracketMap(payloadText.value))

const highlightedInput = computed(() =>
  highlightJson(payloadText.value, activeInputPair.value)
)

const highlightedOutput = computed(() =>
  highlightJson(store.apiTesterResponse, outputPair.value)
)

function onInputActive() {
  const ta = inputTextareaRef.value
  if (!ta) return
  const text = payloadText.value
  for (const pos of [ta.selectionStart - 1, ta.selectionStart]) {
    if (pos >= 0 && pos < text.length && isBracket(text[pos])) {
      const match = inputBracketMap.value.get(pos)
      activeInputPair.value = match !== undefined ? [pos, match] : null
      return
    }
  }
  activeInputPair.value = null
}

function onInputChanged() {
  onInputActive()
}

function syncScroll() {
  const ta = inputTextareaRef.value
  const pre = inputHighlightRef.value
  if (ta && pre) {
    pre.scrollTop = ta.scrollTop
    pre.scrollLeft = ta.scrollLeft
  }
}

function onOutputClick(e: MouseEvent) {
  const pre = outputRef.value
  if (!pre || !store.apiTesterResponse) return
  const doc = document as any
  let node: Node | null = null
  let offset = 0
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(e.clientX, e.clientY)
    if (range) { node = range.startContainer; offset = range.startOffset }
  } else if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(e.clientX, e.clientY)
    if (pos) { node = pos.offsetNode; offset = pos.offset }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) {
    outputPair.value = null
    return
  }
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT)
  let globalOffset = 0
  let n = walker.nextNode()
  while (n && n !== node) {
    globalOffset += (n as Text).length
    n = walker.nextNode()
  }
  globalOffset += offset
  const text = store.apiTesterResponse
  for (const pos of [globalOffset - 1, globalOffset]) {
    if (pos >= 0 && pos < text.length && isBracket(text[pos])) {
      const match = buildBracketMap(text).get(pos)
      outputPair.value = match !== undefined ? [pos, match] : null
      return
    }
  }
  outputPair.value = null
}

watch(() => store.apiTesterResponse, () => { outputPair.value = null })

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
.panel-card { height: 100%; display: flex; flex-direction: column; }
.panel-card :deep(.el-card__body) { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

/* JSON input editor: a transparent textarea over a highlighted <pre> so the
   syntax highlight and bracket matches stay perfectly aligned with the caret. */
.json-editor {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background-color: #1e1e1e;
  box-shadow: 0 0 0 1px #3c3c3c inset;
  border-radius: 6px;
}
.json-editor .editor-highlight,
.json-editor .editor-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 12px;
  border: none;
  box-sizing: border-box;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  overflow: auto;
  background: transparent;
}
.json-editor .editor-highlight {
  color: #d4d4d4;
  pointer-events: none;
  z-index: 0;
}
.json-editor .editor-input {
  color: transparent;
  -webkit-text-fill-color: transparent;
  caret-color: #ffffff;
  resize: none;
  outline: none;
  z-index: 1;
}

.response-display {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  background-color: #1e1e1e;
  box-shadow: 0 0 0 1px #3c3c3c inset;
  border-radius: 6px;
}
.response-display pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  margin: 0;
}
.placeholder { color: var(--el-text-color-placeholder); }
.send-bar { flex-shrink: 0; margin-top: 4px; }
.mt-2 { margin-top: 8px; }

/* JSON syntax highlight tokens. */
.tok-key { color: #9cdcfe; }
.tok-string { color: #ce9178; }
.tok-number { color: #b5cea8; }
.tok-keyword { color: #569cd6; }
.tok-bracket { background: #264f78; color: #ffffff; border-radius: 2px; box-shadow: 0 0 0 1px #569cd6; }
.tok-bracket-region { background: rgba(86, 156, 214, 0.12); }

/* Scrollbars. */
.response-display::-webkit-scrollbar,
.json-editor .editor-highlight::-webkit-scrollbar,
.json-editor .editor-input::-webkit-scrollbar { width: 10px; height: 10px; }
.response-display::-webkit-scrollbar-thumb,
.json-editor .editor-highlight::-webkit-scrollbar-thumb,
.json-editor .editor-input::-webkit-scrollbar-thumb { background: #3c3c3c; border-radius: 5px; }
.response-display::-webkit-scrollbar-track,
.json-editor .editor-highlight::-webkit-scrollbar-track,
.json-editor .editor-input::-webkit-scrollbar-track { background: transparent; }

@media (max-width: 767px) {
  .api-tester { overflow-y: auto; }
  .tester-body { flex: none; overflow: visible; }
  .panel-col { height: 420px; margin-bottom: 12px; }
}
</style>
