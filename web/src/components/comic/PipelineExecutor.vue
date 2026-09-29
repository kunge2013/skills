<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-29 -->
<template>
  <div class="pipeline-executor">
    <div class="toolbar">
      <div class="novel-select">
        <el-select v-model="selectedNovelId" :placeholder="$t('comic.selectNovel')" filterable>
          <el-option v-for="n in store.novels" :key="n.id" :label="n.name" :value="n.id" />
        </el-select>
      </div>
      <div class="actions">
        <el-button type="primary" :disabled="!selectedNovelId || store.executing" @click="startPipeline">
          {{ $t('comic.startPipeline') }}
        </el-button>
        <el-button :disabled="store.executing" @click="resetPipeline">
          {{ $t('comic.reset') }}
        </el-button>
      </div>
    </div>

    <div class="pipeline-stages">
      <!-- Stage 1: Cleaning -->
      <div class="stage">
        <div class="stage-header">
          <h3>🧹 {{ $t('comic.cleaning') }}</h3>
          <el-tag :type="getStageStatus('cleaning')" size="small">{{ getStageLabel('cleaning') }}</el-tag>
        </div>
        <div class="sub-steps">
          <div v-for="t in cleaningTemplates" :key="t.id" class="sub-step" :class="{ completed: isCompleted(t.id), active: currentStepId === t.id }">
            <div class="step-icon">
              <el-icon v-if="isCompleted(t.id)" color="#67c23a"><Check /></el-icon>
              <el-icon v-else-if="currentStepId === t.id" color="#409eff"><Loading /></el-icon>
              <span v-else class="step-num">P{{ t.step_order }}</span>
            </div>
            <div class="step-info">
              <div class="step-name">{{ t.name }}</div>
              <div class="step-desc">{{ t.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stage 2: Extraction -->
      <div class="stage">
        <div class="stage-header">
          <h3>🕵️ {{ $t('comic.extraction') }}</h3>
          <el-tag :type="getStageStatus('extraction')" size="small">{{ getStageLabel('extraction') }}</el-tag>
        </div>
        <div class="sub-steps">
          <div v-for="t in extractionTemplates" :key="t.id" class="sub-step" :class="{ completed: isCompleted(t.id), active: currentStepId === t.id }">
            <div class="step-icon">
              <el-icon v-if="isCompleted(t.id)" color="#67c23a"><Check /></el-icon>
              <el-icon v-else-if="currentStepId === t.id" color="#409eff"><Loading /></el-icon>
              <span v-else class="step-num">P{{ t.step_order }}</span>
            </div>
            <div class="step-info">
              <div class="step-name">{{ t.name }}</div>
              <div class="step-desc">{{ t.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stage 3: Script -->
      <div class="stage">
        <div class="stage-header">
          <h3>🎬 {{ $t('comic.script') }}</h3>
          <el-tag :type="getStageStatus('script')" size="small">{{ getStageLabel('script') }}</el-tag>
        </div>
        <div class="sub-steps">
          <div v-for="t in scriptTemplates" :key="t.id" class="sub-step" :class="{ completed: isCompleted(t.id), active: currentStepId === t.id }">
            <div class="step-icon">
              <el-icon v-if="isCompleted(t.id)" color="#67c23a"><Check /></el-icon>
              <el-icon v-else-if="currentStepId === t.id" color="#409eff"><Loading /></el-icon>
              <span v-else class="step-num">P{{ t.step_order }}</span>
            </div>
            <div class="step-info">
              <div class="step-name">{{ t.name }}</div>
              <div class="step-desc">{{ t.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stage 4: Storyboard -->
      <div class="stage">
        <div class="stage-header">
          <h3>🖼️ {{ $t('comic.storyboard') }}</h3>
          <el-tag :type="getStageStatus('storyboard')" size="small">{{ getStageLabel('storyboard') }}</el-tag>
        </div>
        <div class="sub-steps">
          <div v-for="t in storyboardTemplates" :key="t.id" class="sub-step" :class="{ completed: isCompleted(t.id), active: currentStepId === t.id }">
            <div class="step-icon">
              <el-icon v-if="isCompleted(t.id)" color="#67c23a"><Check /></el-icon>
              <el-icon v-else-if="currentStepId === t.id" color="#409eff"><Loading /></el-icon>
              <span v-else class="step-num">P{{ t.step_order }}</span>
            </div>
            <div class="step-info">
              <div class="step-name">{{ t.name }}</div>
              <div class="step-desc">{{ t.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Execute Panel -->
    <div v-if="currentTemplate" class="execute-panel">
      <div class="panel-header">
        <h3>{{ currentTemplate.name }}</h3>
        <el-tag type="info" size="small">P{{ currentTemplate.step_order }}</el-tag>
      </div>
      <div class="panel-body">
        <div class="input-section">
          <h4>{{ $t('comic.inputVariables') }}</h4>
          <div v-for="v in currentTemplate.input_variables" :key="v" class="var-input">
            <label>{{ v }}</label>
            <el-input v-model="inputValues[v]" type="textarea" :rows="4" :placeholder="getPlaceholder(v)" />
          </div>
        </div>
        <div class="model-section">
          <h4>{{ $t('comic.model') }}</h4>
          <el-select v-model="selectedModel" style="width: 100%">
            <el-option label="Claude 3.5 Sonnet" value="claude-3-5-sonnet" />
            <el-option label="Claude 3 Opus" value="claude-3-opus" />
            <el-option label="GPT-4o" value="gpt-4o" />
          </el-select>
        </div>
        <div class="system-prompt">
          <h4>{{ $t('comic.systemPrompt') }}</h4>
          <div class="prompt-preview">{{ currentTemplate.system_prompt }}</div>
        </div>
      </div>
      <div class="panel-footer">
        <el-button type="primary" :loading="store.executing" @click="executeCurrentStep">
          {{ $t('comic.executeStep') }}
        </el-button>
      </div>
    </div>

    <!-- Output Section -->
    <div v-if="store.executeOutput || store.executeError" class="output-section">
      <div class="output-header">
        <h3>{{ $t('comic.output') }}</h3>
        <el-button v-if="store.executeOutput" size="small" @click="copyOutput">
          {{ $t('comic.copy') }}
        </el-button>
      </div>
      <div v-if="store.executeError" class="error-output">
        {{ store.executeError }}
      </div>
      <div v-else class="text-output">
        {{ store.executeOutput }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Check, Loading } from '@element-plus/icons-vue'
import { useComicStore } from '../../stores/comic'
import type { ComicTemplate, ComicCategory } from '../../types/comic'

const { t } = useI18n()
const store = useComicStore()

const selectedNovelId = ref('')
const currentStepId = ref('')
const selectedModel = ref('claude-3-5-sonnet')
const inputValues = ref<Record<string, string>>({})
const completedSteps = ref<Set<string>>(new Set())
const runId = ref('')

const currentTemplate = computed(() => {
  if (!currentStepId.value) return null
  return store.templates.find(t => t.id === currentStepId.value) || null
})

const cleaningTemplates = computed(() => store.templatesByCategory('cleaning').sort((a, b) => (a.step_order || 0) - (b.step_order || 0)))
const extractionTemplates = computed(() => store.templatesByCategory('extraction').sort((a, b) => (a.step_order || 0) - (b.step_order || 0)))
const scriptTemplates = computed(() => store.templatesByCategory('script').sort((a, b) => (a.step_order || 0) - (b.step_order || 0)))
const storyboardTemplates = computed(() => store.templatesByCategory('storyboard').sort((a, b) => (a.step_order || 0) - (b.step_order || 0)))

function isCompleted(templateId: string): boolean {
  return completedSteps.value.has(templateId)
}

function getStageStatus(category: ComicCategory): 'success' | 'warning' | 'info' {
  const templates = store.templatesByCategory(category)
  if (templates.length === 0) return 'info'
  const allCompleted = templates.every(t => isCompleted(t.id))
  if (allCompleted) return 'success'
  const anyActive = templates.some(t => currentStepId.value === t.id)
  if (anyActive) return 'warning'
  return 'info'
}

function getStageLabel(category: ComicCategory): string {
  const templates = store.templatesByCategory(category)
  const completed = templates.filter(t => isCompleted(t.id)).length
  return `${completed}/${templates.length}`
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

  const firstCleaning = cleaningTemplates.value[0]
  if (firstCleaning) {
    currentStepId.value = firstCleaning.id
  }

  ElMessage.success(t('comic.pipelineStarted'))
}

function resetPipeline() {
  currentStepId.value = ''
  completedSteps.value.clear()
  inputValues.value = {}
  store.executeOutput = ''
  store.executeError = ''
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

async function copyOutput() {
  if (!store.executeOutput) return
  try {
    await navigator.clipboard.writeText(store.executeOutput)
    ElMessage.success(t('comic.copied'))
  } catch (e) {
    ElMessage.error(t('comic.copyFailed'))
  }
}
// [AGC:END]
</script>

<style scoped>
.pipeline-executor {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #fff;
  border-radius: 4px;
}

.novel-select {
  flex: 1;
  max-width: 400px;
}

.actions {
  display: flex;
  gap: 8px;
}

.pipeline-stages {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stage {
  background: #fff;
  border-radius: 4px;
  padding: 16px;
}

.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stage-header h3 {
  margin: 0;
  font-size: 16px;
}

.sub-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sub-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  transition: all 0.2s;
}

.sub-step.completed {
  background: #f0f9ff;
  border-color: #67c23a;
}

.sub-step.active {
  background: #e6f7ff;
  border-color: #409eff;
}

.step-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-num {
  font-size: 12px;
  color: #999;
  font-weight: 600;
}

.step-info {
  flex: 1;
  min-width: 0;
}

.step-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 2px;
}

.step-desc {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execute-panel {
  background: #fff;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-section h4,
.model-section h4,
.system-prompt h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.var-input {
  margin-bottom: 12px;
}

.var-input label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.prompt-preview {
  background: #fafafa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  max-height: 120px;
  overflow: auto;
  line-height: 1.5;
  white-space: pre-wrap;
}

.panel-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.output-section {
  background: #fff;
  border-radius: 4px;
  padding: 16px;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.output-header h3 {
  margin: 0;
  font-size: 16px;
}

.error-output {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
}

.text-output {
  background: #fafafa;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  max-height: 400px;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
