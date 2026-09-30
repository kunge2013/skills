<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-29 -->
<template>
  <div class="pipeline-executor">
    <div class="pipeline-container">
      <!-- Resume Banner -->
      <div v-if="store.latestRun && hasIncompleteRun" class="resume-banner">
        <div class="resume-info">
          <span class="resume-icon">🔵</span>
          <span class="resume-text">
            {{ $t('comic.detectIncompleteRun', { completed: store.latestRun.completed_steps.length, total: totalSteps }) }}
          </span>
          <span class="resume-meta">
            {{ $t('comic.model') }}: {{ store.latestRun.model_key || '-' }} |
            {{ $t('comic.lastUpdate') }}: {{ formatTime(store.latestRun.updated_at) }}
          </span>
        </div>
        <div class="resume-actions">
          <el-button type="primary" size="small" @click="resumePipeline">
            ▶️ {{ $t('comic.resumeExecution') }}
          </el-button>
          <el-button size="small" @click="startPipeline">
            🔄 {{ $t('comic.restartPipeline') }}
          </el-button>
          <el-dropdown v-if="store.pipelineRuns.length > 0" @command="handleRunHistory">
            <el-button size="small">
              {{ $t('comic.viewHistory') }} ▼
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="run in store.pipelineRuns"
                  :key="run.run_id"
                  :command="run"
                >
                  {{ run.run_id.slice(0, 12) }}... | {{ run.completed_steps.length }}/{{ totalSteps }} | {{ formatTime(run.updated_at) }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

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
            <div
              class="step-circle"
              :class="getStepCircleClass(stage.key)"
              @click="selectStage(stage.key)"
              title="点击展开子步骤"
            >
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
            @click="selectStep(t.id, isCompleted(t.id))"
          >
            <div class="sub-step-header">
              <h5>P{{ t.step_order }}: {{ t.name }}</h5>
              <span class="sub-step-status" :class="getSubStepStatusClass(t.id)">
                {{ getSubStepStatusText(t.id) }}
              </span>
            </div>
            <div class="sub-step-meta">{{ t.description }}</div>
            <div v-if="isCompleted(t.id)" class="rerun-hint">{{ $t('comic.clickToRerun') }}</div>
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
          <el-select v-model="selectedModel" style="min-width: 180px;" filterable>
            <el-option v-for="m in promptStore.enabledModels" :key="m.id" :label="m.name" :value="m.id" />
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
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useComicStore } from '../../stores/comic'
import { usePromptStore } from '../../stores/prompt'
import type { ComicTemplate, ComicCategory, Novel } from '../../types/comic'

const { t } = useI18n()
const store = useComicStore()
const promptStore = usePromptStore()

onMounted(async () => {
  // Load models if not already loaded
  if (promptStore.allModels.length === 0) {
    await promptStore.loadModels()
  }
  // Set default model to first enabled one
  if (!selectedModel.value && promptStore.enabledModels.length > 0) {
    selectedModel.value = promptStore.enabledModels[0].id
  }
})

const selectedNovelId = ref('')
const currentStepId = ref('')
const selectedModel = ref('')
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

const totalSteps = computed(() => store.templates.length)

const hasIncompleteRun = computed(() => {
  const run = store.latestRun
  if (!run) return false
  return run.completed_steps.length < totalSteps.value || run.current_step !== null
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

function selectStage(category: ComicCategory) {
  // Select the first template in this stage
  const templates = getStageTemplates(category)
  if (templates.length > 0) {
    // Find the first uncompleted template, or fallback to the first one
    const firstUncompleted = templates.find(t => !isCompleted(t.id))
    const targetTemplate = firstUncompleted || templates[0]
    selectStep(targetTemplate.id)
  }
}

function selectStep(templateId: string, isCompletedStep: boolean = false) {
  // Allow clicking completed steps for re-run
  currentStepId.value = templateId
  inputValues.value = {}
  autoFillInputValues(templateId)
}

// [AGC:START] tool=Cc author=fangkun
function autoFillInputValues(templateId: string) {
  const template = store.templates.find(t => t.id === templateId)
  const novelId = selectedNovelId.value
  if (!template || !novelId) return

  // Build map of template_id → output from current step logs
  const stepOutputMap = new Map<string, string>()
  for (const log of store.stepLogs) {
    if (log.output && log.status === 200) {
      stepOutputMap.set(log.template_id, log.output)
    }
  }

  for (const v of template.input_variables) {
    if (inputValues.value[v]) continue // already filled by user, don't overwrite

    // 1. Try to resolve from step logs via depend_on chain
    const fromStep = resolveFromStepLogs(v, template, stepOutputMap)
    if (fromStep !== undefined) {
      inputValues.value[v] = fromStep
      continue
    }

    // 2. Fallback: resolve from novel sub-tables
    const fromTables = resolveFromSubTables(v, novelId)
    if (fromTables) {
      inputValues.value[v] = fromTables
      continue
    }

    // 3. Use placeholder or empty
    inputValues.value[v] = getPlaceholder(v) || ''
  }
}

function resolveFromStepLogs(
  varName: string,
  template: ComicTemplate,
  stepOutputMap: Map<string, string>
): string | undefined {
  // Walk the depend_on chain upward to find a completed step's output
  let current = template
  const visited = new Set<string>()
  while (current.depend_on && !visited.has(current.depend_on)) {
    visited.add(current.depend_on)
    const prevTemplate = store.templates.find(t => t.id === current.depend_on)
    if (!prevTemplate) break

    const output = stepOutputMap.get(prevTemplate.id)
    if (output) {
      return output
    }

    current = prevTemplate
  }
  return undefined
}

function resolveFromSubTables(varName: string, novelId: string): string {
  const content = store.novelContent[novelId]
  const characters = store.novelCharacters[novelId] || []
  const scripts = store.novelScripts[novelId] || []
  const storyboards = store.novelStoryboards[novelId] || []

  switch (varName) {
    case 'content':
      return content?.cleaned_text || content?.original_text || ''
    case 'original_text':
      return content?.original_text || ''
    case 'character_text':
      return characters.map(c => {
        let text = `[${c.type}] ${c.name}`
        if (c.appearance) text += ` | 外貌: ${c.appearance}`
        if (c.description) text += ` | ${c.description}`
        return text
      }).join('\n')
    case 'script_text':
      return scripts.map(s => {
        let text = `场景${s.scene_number || ''}: ${s.scene_location || ''} ${s.scene_time || ''}`
        if (s.scene_description) text += `\n${s.scene_description}`
        return text
      }).join('\n\n')
    case 'storyboard_text':
      return storyboards.map(sb => {
        let text = `分镜${sb.frame_number || ''}: ${sb.content || ''}`
        if (sb.shot_type) text += ` [${sb.shot_type}]`
        return text
      }).join('\n')
    default:
      return ''
  }
}
// [AGC:END]

function getPlaceholder(varName: string): string {
  const novelId = selectedNovelId.value
  if (!novelId) return ''

  const content = store.novelContent[novelId]
  const characters = store.novelCharacters[novelId] || []
  const scripts = store.novelScripts[novelId] || []

  switch (varName) {
    case 'content':
      return content?.cleaned_text || content?.original_text || ''
    case 'character_text':
      return characters.map(c => `[${c.type}] ${c.name}`).join(', ')
    case 'script_text':
      return scripts.map(s => `场景${s.scene_number || ''}: ${s.scene_description || ''}`).join('\n')
    default:
      return ''
  }
}

// Save step output to the appropriate sub-table and persist to backend
async function saveStepOutput(template: ComicTemplate, output: string) {
  const novelId = selectedNovelId.value
  if (!novelId) return

  try {
    switch (template.category) {
      case 'cleaning':
        // Save cleaned text to novel_content
        await store.updateNovelContent(novelId, { cleaned_text: output })
        break

      case 'extraction':
        // Parse JSON output and save characters
        try {
          const parsed = JSON.parse(output)
          const items = Array.isArray(parsed) ? parsed : [parsed]
          // Delete old characters and recreate
          await fetch(`/api/v1/comic/novels/${novelId}/characters`, { method: 'DELETE' })
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            await store.createNovelCharacter(novelId, {
              name: item.name || '',
              type: item.type || 'character',
              appearance: item.appearance || null,
              description: item.description || null,
              order_index: i,
            })
          }
          await store.loadNovelCharacters(novelId)
        } catch (parseErr) {
          console.warn('Failed to parse character extraction output:', parseErr)
        }
        break

      case 'script':
        // Parse output and save script scenes
        try {
          const parsed = JSON.parse(output)
          const scenes = Array.isArray(parsed) ? parsed : [parsed]
          // Delete old scripts and recreate
          await fetch(`/api/v1/comic/novels/${novelId}/scripts`, { method: 'DELETE' })
          for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i]
            const script = await store.createNovelScript(novelId, {
              scene_number: scene.scene_number || i + 1,
              scene_location: scene.scene_location || null,
              scene_time: scene.scene_time || null,
              scene_description: scene.scene_description || null,
              order_index: i,
            })
            // Save dialogues if present
            if (scene.dialogues && Array.isArray(scene.dialogues)) {
              for (let j = 0; j < scene.dialogues.length; j++) {
                const d = scene.dialogues[j]
                await store.createNovelScriptDialogue(script.id, {
                  character_name: d.character_name || null,
                  dialogue_text: d.dialogue_text || d.text || '',
                  order_index: j,
                })
              }
            }
          }
          await store.loadNovelScripts(novelId)
        } catch (parseErr) {
          console.warn('Failed to parse script output:', parseErr)
        }
        break

      case 'storyboard':
        // Parse JSON output and save storyboards
        try {
          const parsed = JSON.parse(output)
          const frames = Array.isArray(parsed) ? parsed : [parsed]
          // Delete old storyboards and recreate
          await fetch(`/api/v1/comic/novels/${novelId}/storyboards`, { method: 'DELETE' })
          for (let i = 0; i < frames.length; i++) {
            const frame = frames[i]
            await store.createNovelStoryboard(novelId, {
              frame_number: frame.frame_number || frame.frame_id || i + 1,
              shot_type: frame.shot_type || null,
              camera_angle: frame.camera_angle || frame.camera || null,
              content: frame.content || frame.description || null,
              characters: Array.isArray(frame.characters) ? frame.characters.join(',') : (frame.characters || null),
              image_prompt: frame.image_prompt || null,
              subtitles: frame.subtitles || null,
              notes: frame.notes || null,
              order_index: i,
            })
          }
          await store.loadNovelStoryboards(novelId)
        } catch (parseErr) {
          console.warn('Failed to parse storyboard output:', parseErr)
        }
        break
    }
  } catch (err) {
    console.warn('Failed to save step output:', err)
  }
}

watch(selectedNovelId, async (newId) => {
  store.setSelectedNovel(newId)
  if (newId) {
    await Promise.all([
      store.loadLatestRun(newId),
      store.loadPipelineRuns(newId),
      store.loadNovelContent(newId),
      store.loadNovelCharacters(newId),
      store.loadNovelScripts(newId),
      store.loadNovelStoryboards(newId),
      store.loadNovelStepLogs(newId),
    ])
  }
})

watch(() => store.pendingRestoreRun, (run) => {
  if (!run) return
  // Restore state from the pending run
  selectedNovelId.value = run.novel_id
  store.setSelectedNovel(run.novel_id)
  runId.value = run.run_id
  completedSteps.value = new Set(run.completed_steps)
  selectedModel.value = run.model_key || ''

  if (run.current_step) {
    currentStepId.value = run.current_step
  } else {
    const nextStep = findNextUncompletedStep()
    currentStepId.value = nextStep?.id || ''
  }

  inputValues.value = {}
  if (currentStepId.value) {
    autoFillInputValues(currentStepId.value)
  }

  store.executeOutput = ''
  store.executeError = ''
  store.setPendingRestoreRun(null)
  ElMessage.success(t('comic.restoredRunState'))
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${min}`
}

async function resumePipeline() {
  const run = store.latestRun
  if (!run) return

  // Restore state from saved run
  runId.value = run.run_id
  completedSteps.value = new Set(run.completed_steps)
  selectedModel.value = run.model_key || ''

  // Find current step: use saved current_step, or find next uncompleted step
  if (run.current_step) {
    currentStepId.value = run.current_step
  } else {
    // Find the first uncompleted step
    const nextStep = findNextUncompletedStep()
    if (nextStep) {
      currentStepId.value = nextStep.id
    } else {
      // All steps completed
      currentStepId.value = ''
      ElMessage.info(t('comic.allStepsCompleted'))
    }
  }

  inputValues.value = {}
  if (currentStepId.value) {
    autoFillInputValues(currentStepId.value)
  }

  store.executeOutput = ''
  store.executeError = ''
  ElMessage.success(t('comic.resumedFromBreakpoint'))
}

function findNextUncompletedStep(): ComicTemplate | null {
  // Get all templates in order
  const allTemplates: ComicTemplate[] = []
  const categories: ComicCategory[] = ['cleaning', 'extraction', 'script', 'storyboard']
  for (const cat of categories) {
    allTemplates.push(...getStageTemplates(cat))
  }

  // Find first uncompleted
  for (const t of allTemplates) {
    if (!completedSteps.value.has(t.id)) {
      return t
    }
  }
  return null
}

function handleRunHistory(run: any) {
  // Restore state from selected run
  runId.value = run.run_id
  completedSteps.value = new Set(run.completed_steps)
  selectedModel.value = run.model_key || ''

  // Find current step
  if (run.current_step) {
    currentStepId.value = run.current_step
  } else {
    const nextStep = findNextUncompletedStep()
    currentStepId.value = nextStep?.id || ''
  }

  inputValues.value = {}
  if (currentStepId.value) {
    autoFillInputValues(currentStepId.value)
  }

  store.executeOutput = ''
  store.executeError = ''
  ElMessage.success(t('comic.restoredRunState'))
}

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
    autoFillInputValues(firstCleaning[0].id)
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

    // Save output to novel sub-tables (extraction/script/storyboard)
    await saveStepOutput(currentTemplate.value, fullOutput)

    // Reload step logs so next step's autoFill can use this step's output
    await store.loadStepLogs(runId.value)

    const nextTemplate = findNextTemplate(currentTemplate.value)
    if (nextTemplate) {
      currentStepId.value = nextTemplate.id
      inputValues.value = {}
      autoFillInputValues(nextTemplate.id)
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

/* Resume Banner */
.resume-banner {
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%);
  border: 1px solid #91d5ff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.resume-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.resume-icon {
  font-size: 18px;
}

.resume-text {
  font-size: 14px;
  font-weight: 500;
  color: #1890ff;
}

.resume-meta {
  font-size: 12px;
  color: #666;
}

.resume-actions {
  display: flex;
  gap: 8px;
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
  cursor: pointer;
}

.step-circle:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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

.step-circle.current:hover {
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15);
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

.rerun-hint {
  font-size: 11px;
  color: #1890ff;
  margin-top: 4px;
  opacity: 0.8;
}

.sub-step-card.done:hover .rerun-hint {
  opacity: 1;
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
