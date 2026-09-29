<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-29 -->
<template>
  <div class="pipeline-executor">
    <div class="pipeline-container">
      <!-- Novel Selection -->
      <div class="pipeline-novel-select">
        <label>{{ $t('comic.selectNovel') }}：</label>
        <el-select v-model="selectedNovelId" :placeholder="$t('comic.selectNovel')" filterable style="min-width: 200px;">
          <el-option v-for="n in store.novels" :key="n.id" :label="n.name" :value="n.id" />
        </el-select>
        <span class="run-id-hint" v-if="runId">
          Run ID: <code>{{ runId }}</code>
        </span>
      </div>

      <!-- Step Flow Visualization -->
      <div class="step-flow">
        <div v-for="(stage, index) in stages" :key="stage.key" class="step-node-wrapper">
          <div class="step-node">
            <div class="step-circle" :class="getStepCircleClass(stage.key)">
              <span v-if="isStageDone(stage.key)">✓</span>
              <span v-else-if="isStageCurrent(stage.key)">{{ index + 1 }}</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div class="step-label">{{ stage.label }}</div>
          </div>
          <div v-if="index < stages.length - 1" class="step-connector" :class="getConnectorClass(stage.key)"></div>
        </div>
      </div>

      <!-- Current Stage Sub-steps -->
      <div v-if="currentStage" class="current-stage-section">
        <div class="stage-subtitle">{{ currentStage.emoji }} {{ currentStage.label }} - {{ $t('comic.subSteps') }}</div>
        <div class="sub-steps-grid">
          <div
            v-for="t in getCurrentStageTemplates()"
            :key="t.id"
            class="sub-step-card"
            :class="{ done: isCompleted(t.id), active: currentStepId === t.id }"
            @click="selectStep(t.id)"
          >
            <div class="sub-step-header">
              <h5>P{{ t.step_order }}: {{ t.name }}</h5>
              <span class="sub-step-status" :class="getSubStepStatusClass(t.id)">
                {{ getSubStepStatusText(t.id) }}
              </span>
            </div>
            <div class="sub-step-meta">{{ t.description }}</div>
          </div>
        </div>
      </div>

      <!-- Execute Panel -->
      <div v-if="currentTemplate" class="execute-panel">
        <h4>📝 P{{ currentTemplate.step_order }}: {{ currentTemplate.name }}
          <span class="subtitle">{{ currentTemplate.description }}</span>
        </h4>

        <div class="var-input-group" v-for="v in currentTemplate.input_variables" :key="v">
          <label>📥 {{ v }} <span class="auto-hint">{{ $t('comic.autoFillHint') }}</span></label>
          <el-input
            v-model="inputValues[v]"
            type="textarea"
            :rows="5"
            :placeholder="getPlaceholder(v)"
          />
        </div>

        <div class="execute-actions">
          <label>{{ $t('comic.model') }}：</label>
          <el-select v-model="selectedModel" style="min-width: 180px;">
            <el-option label="deepseek-chat" value="deepseek-chat" />
            <el-option label="gpt-4o" value="gpt-4o" />
            <el-option label="claude-sonnet-4-20250514" value="claude-sonnet-4-20250514" />
          </el-select>
          <el-button type="primary" :loading="store.executing" @click="executeCurrentStep">
            {{ store.executing ? '⏸' : '▶️' }} {{ $t('comic.executeStep') }}
          </el-button>
          <el-button v-if="!store.executing" @click="regenerate">🔄 {{ $t('comic.regenerate') }}</el-button>
          <span class="streaming-hint" v-if="store.executing">
            {{ $t('comic.generated') }} {{ (store.executeOutput || '').length.toLocaleString() }} {{ $t('comic.chars') }}...
            <span class="streaming-cursor"></span>
          </span>
        </div>

        <!-- Output Panel -->
        <div v-if="store.executeOutput || store.executeError" class="output-panel">
          <div v-if="store.executeError" class="error-text">{{ store.executeError }}</div>
          <template v-else>{{ store.executeOutput }}<span v-if="store.executing" class="streaming-cursor"></span></template>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="pipeline-actions">
        <el-button type="primary" :disabled="!selectedNovelId || store.executing" @click="startPipeline">
          {{ $t('comic.startPipeline') }}
        </el-button>
        <el-button :disabled="store.executing" @click="resetPipeline">
          {{ $t('comic.reset') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useComicStore } from '../../stores/comic'
import type { ComicTemplate, ComicCategory } from '../../types/comic'

const { t } = useI18n()
const store = useComicStore()

const selectedNovelId = ref('')
const currentStepId = ref('')
const selectedModel = ref('deepseek-chat')
const inputValues = ref<Record<string, string>>({})
const completedSteps = ref<Set<string>>(new Set())
const runId = ref('')

const stages = computed(() => [
  { key: 'cleaning' as ComicCategory, label: t('comic.cleaning'), emoji: '🧹' },
  { key: 'extraction' as ComicCategory, label: t('comic.extraction'), emoji: '🕵️' },
  { key: 'script' as ComicCategory, label: t('comic.script'), emoji: '🎬' },
  { key: 'storyboard' as ComicCategory, label: t('comic.storyboard'), emoji: '🖼️' },
])

const currentStage = computed(() => {
  if (!currentStepId.value) return null
  const template = store.templates.find(t => t.id === currentStepId.value)
  if (!template) return null
  return stages.value.find(s => s.key === template.category) || null
})

const currentTemplate = computed(() => {
  if (!currentStepId.value) return null
  return store.templates.find(t => t.id === currentStepId.value) || null
})

function isCompleted(templateId: string): boolean {
  return completedSteps.value.has(templateId)
}

function getStageTemplates(category: ComicCategory): ComicTemplate[] {
  return store.templatesByCategory(category).sort((a, b) => (a.step_order || 0) - (b.step_order || 0))
}

function isStageDone(category: ComicCategory): boolean {
  const templates = getStageTemplates(category)
  if (templates.length === 0) return false
  return templates.every(t => isCompleted(t.id))
}

function isStageCurrent(category: ComicCategory): boolean {
  if (!currentStepId.value) return false
  const template = store.templates.find(t => t.id === currentStepId.value)
  return template?.category === category
}

function getStepCircleClass(category: ComicCategory): string {
  if (isStageDone(category)) return 'done'
  if (isStageCurrent(category)) return 'current'
  return 'pending'
}

function getConnectorClass(category: ComicCategory): string {
  if (isStageDone(category)) return 'done'
  if (isStageCurrent(category)) return 'active'
  return ''
}

function getSubStepStatusClass(templateId: string): string {
  if (isCompleted(templateId)) return 'done'
  if (currentStepId.value === templateId) return 'running'
  return 'pending'
}

function getSubStepStatusText(templateId: string): string {
  if (isCompleted(templateId)) return '✅ 完成'
  if (currentStepId.value === templateId) return '⏳ 执行中'
  return '待执行'
}

function getCurrentStageTemplates(): ComicTemplate[] {
  if (!currentStage.value) return []
  return getStageTemplates(currentStage.value.key)
}

function selectStep(templateId: string) {
  if (isCompleted(templateId)) return
  currentStepId.value = templateId
  inputValues.value = {}
}

function getPlaceholder(varName: string): string {
  const novel = store.novels.find(n => n.id === selectedNovelId.value)
  if (!novel) return ''

  switch (varName) {
    case 'content':
      return novel.content || novel.original_text || ''
    case 'character_text':
      return novel.character_text || ''
    case 'script_text':
      return novel.script_text || ''
    default:
      return ''
  }
}

watch(selectedNovelId, (newId) => {
  store.setSelectedNovel(newId)
})

async function startPipeline() {
  if (!selectedNovelId.value) {
    ElMessage.warning(t('comic.selectNovelFirst'))
    return
  }

  runId.value = `run_${Date.now()}`
  completedSteps.value.clear()
  currentStepId.value = ''
  inputValues.value = {}
  store.executeOutput = ''
  store.executeError = ''

  const firstCleaning = getStageTemplates('cleaning')
  if (firstCleaning.length > 0) {
    currentStepId.value = firstCleaning[0].id
  }

  ElMessage.success(t('comic.pipelineStarted'))
}

function resetPipeline() {
  currentStepId.value = ''
  completedSteps.value.clear()
  inputValues.value = {}
  store.executeOutput = ''
  store.executeError = ''
  runId.value = ''
}

function regenerate() {
  store.executeOutput = ''
  store.executeError = ''
  inputValues.value = {}
}

async function executeCurrentStep() {
  if (!currentTemplate.value || !selectedNovelId.value) return

  store.executing = true
  store.executeOutput = ''
  store.executeError = ''

  try {
    const novel = store.novels.find(n => n.id === selectedNovelId.value)
    if (!novel) throw new Error('Novel not found')

    const variables: Record<string, string> = {}
    for (const v of currentTemplate.value.input_variables) {
      variables[v] = inputValues.value[v] || getPlaceholder(v)
    }

    const response = await fetch('/api/v1/comic/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_id: runId.value,
        novel_id: selectedNovelId.value,
        template_id: currentTemplate.value.id,
        model: selectedModel.value,
        input_variables: variables,
      }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No reader')

    const decoder = new TextDecoder()
    let fullOutput = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'delta') {
              fullOutput += parsed.content
              store.executeOutput = fullOutput
            } else if (parsed.type === 'complete') {
              if (parsed.output) {
                fullOutput = parsed.output
                store.executeOutput = fullOutput
              }
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error)
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
              throw e
            }
          }
        }
      }
    }

    completedSteps.value.add(currentTemplate.value.id)

    const nextTemplate = findNextTemplate(currentTemplate.value)
    if (nextTemplate) {
      currentStepId.value = nextTemplate.id
      inputValues.value = {}
    } else {
      currentStepId.value = ''
      ElMessage.success(t('comic.pipelineCompleted'))
    }

    await store.loadCallLogs()
  } catch (e: any) {
    store.executeError = e.message
    ElMessage.error(e.message)
  } finally {
    store.executing = false
  }
}

function findNextTemplate(current: ComicTemplate): ComicTemplate | null {
  const allTemplates = store.templates
    .filter(t => t.category === current.category)
    .sort((a, b) => (a.step_order || 0) - (b.step_order || 0))

  const currentIndex = allTemplates.findIndex(t => t.id === current.id)
  if (currentIndex < allTemplates.length - 1) {
    return allTemplates[currentIndex + 1]
  }

  const categories: ComicCategory[] = ['cleaning', 'extraction', 'script', 'storyboard']
  const currentCategoryIndex = categories.indexOf(current.category)

  for (let i = currentCategoryIndex + 1; i < categories.length; i++) {
    const nextCategoryTemplates = store.templatesByCategory(categories[i])
      .sort((a, b) => (a.step_order || 0) - (b.step_order || 0))
    if (nextCategoryTemplates.length > 0) {
      return nextCategoryTemplates[0]
    }
  }

  return null
}
// [AGC:END]
</script>

<style scoped>
.pipeline-executor {
  height: 100%;
  overflow: auto;
}

.pipeline-container {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
}

.pipeline-novel-select {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.pipeline-novel-select label {
  font-size: 14px;
  color: #666;
}

.run-id-hint {
  font-size: 12px;
  color: #999;
}

.run-id-hint code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

/* Step Flow */
.step-flow {
  display: flex;
  align-items: flex-start;
  margin-bottom: 32px;
  padding: 0 20px;
}

.step-node-wrapper {
  display: flex;
  align-items: flex-start;
}

.step-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}

.step-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  transition: all 0.3s;
}

.step-circle.done {
  background: #52c41a;
  color: #fff;
}

.step-circle.current {
  background: #409eff;
  color: #fff;
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.2);
}

.step-circle.pending {
  background: #f0f0f0;
  color: #999;
}

.step-label {
  font-size: 12px;
  color: #666;
  text-align: center;
  max-width: 80px;
}

.step-connector {
  flex: 1;
  height: 2px;
  background: #e8e8e8;
  margin-top: 20px;
  min-width: 30px;
}

.step-connector.done {
  background: #52c41a;
}

.step-connector.active {
  background: linear-gradient(90deg, #52c41a, #409eff);
}

/* Current Stage Sub-steps */
.current-stage-section {
  margin-bottom: 24px;
}

.stage-subtitle {
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 600;
}

.sub-steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.sub-step-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 14px;
  border: 1px solid #e8e8e8;
  cursor: pointer;
  transition: all 0.2s;
}

.sub-step-card:hover {
  border-color: #409eff;
  background: #f0f5ff;
}

.sub-step-card.active {
  border-color: #409eff;
  background: #f0f5ff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);
}

.sub-step-card.done {
  border-color: #b7eb8f;
  background: #f6ffed;
}

.sub-step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.sub-step-header h5 {
  font-size: 13px;
  margin: 0;
}

.sub-step-status {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
}

.sub-step-status.done {
  background: #e8f5e9;
  color: #2e7d32;
}

.sub-step-status.pending {
  background: #f5f5f5;
  color: #999;
}

.sub-step-status.running {
  background: #e3f2fd;
  color: #1565c0;
}

.sub-step-meta {
  font-size: 12px;
  color: #999;
}

/* Execute Panel */
.execute-panel {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.execute-panel h4 {
  font-size: 15px;
  margin: 0 0 16px 0;
}

.execute-panel h4 .subtitle {
  font-size: 12px;
  color: #999;
  font-weight: normal;
  margin-left: 8px;
}

.var-input-group {
  margin-bottom: 16px;
}

.var-input-group label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}

.auto-hint {
  color: #999;
  font-size: 11px;
  margin-left: 6px;
}

.execute-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.streaming-hint {
  font-size: 12px;
  color: #999;
}

/* Output Panel - dark theme */
.output-panel {
  margin-top: 16px;
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px;
  color: #d4d4d4;
  font-size: 13px;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  white-space: pre-wrap;
}

.error-text {
  color: #ff6b6b;
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: #409eff;
  animation: blink 1s infinite;
  vertical-align: middle;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.pipeline-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
