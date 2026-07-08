<template>
  <el-collapse v-model="activeCollapse" class="test-panel">
    <el-collapse-item name="test" :title="t('prompt.testTemplate')">
      <!-- 模型选择 -->
      <el-form-item :label="t('prompt.selectModel')">
        <el-select v-model="selectedModel" :placeholder="t('prompt.selectModelPlaceholder')">
          <el-option
            v-for="model in enabledModels"
            :key="model.id"
            :label="model.name"
            :value="model.id"
          />
        </el-select>
      </el-form-item>

      <!-- 变量输入区域 -->
      <div v-if="userVariables.length > 0" class="variables-section">
        <el-divider>{{ t('prompt.variableInput') }}</el-divider>
        <el-form-item
          v-for="varName in userVariables"
          :key="varName"
          :label="varName"
        >
          <el-input
            v-model="variableValues[varName]"
            :placeholder="`输入 ${varName} 的值`"
          />
        </el-form-item>
      </div>

      <!-- 测试按钮 -->
      <div class="test-actions">
        <el-button
          type="primary"
          :loading="testing"
          :disabled="!canTest"
          @click="handleTestStream"
        >
          {{ testing ? t('prompt.testing') : t('prompt.testStream') }}
        </el-button>
      </div>

      <!-- 测试结果 -->
      <div v-if="testOutput" class="test-output">
        <el-divider>{{ t('prompt.response') }}</el-divider>
        <pre>{{ testOutput }}</pre>
      </div>

      <!-- 错误提示 -->
      <el-alert
        v-if="testError"
        type="error"
        :title="testError"
        show-icon
        closable
        @close="testError = ''"
      />
    </el-collapse-item>
  </el-collapse>
</template>

<script setup lang="ts">
// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTemplateVariables } from '../../composables/useTemplateVariables'
import { usePromptStore } from '../../stores/prompt'
import type { TextModelConfig } from '../../types/prompt'

const { t } = useI18n()
const store = usePromptStore()

const props = defineProps<{
  template: {
    id: string
    name: string
    content: { system: string; user?: string }
    systemVariables?: string[]
  }
}>()

const STORAGE_KEY = 'template-test-selected-model'

// [AGC:START] tool=Cc author=fangkun
const selectedModel = ref('')
const variableValues = ref<Record<string, string>>({})
const testOutput = ref('')
const testError = ref('')
const testing = ref(false)
const activeCollapse = ref<string[]>([])
// [AGC:END] tool=Cc author=fangkun

// [AGC:START] tool=Cc author=fangkun
const enabledModels = computed(() => store.enabledModels as TextModelConfig[])
// [AGC:END] tool=Cc author=fangkun

// 使用 composable 提取变量
const { userVariables, replaceVariables } = useTemplateVariables(
  computed(() => props.template.content.system),
  computed(() => props.template.content.user || ''),
  computed(() => props.template.systemVariables || [])
)

// [AGC:START] tool=Cc author=fangkun
const canTest = computed(() => {
  return selectedModel.value &&
         !testing.value &&
         userVariables.value.every(v => variableValues.value[v])
})
// [AGC:END] tool=Cc author=fangkun

// 持久化模型选择
onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && enabledModels.value.find(m => m.id === saved)) {
    selectedModel.value = saved
  }
})

watch(selectedModel, (val) => {
  if (val) localStorage.setItem(STORAGE_KEY, val)
})

// [AGC:START] tool=Cc author=fangkun
// API 辅助函数
async function apiSSE(path: string, body: any, handlers: {
  onToken: (token: string) => void
  onComplete: () => void
  onError: (error: Error) => void
}): Promise<void> {
  const API_BASE = '/api/v1'
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    handlers.onError(new Error(`HTTP ${response.status}`))
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    handlers.onError(new Error('No response body'))
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) {
              handlers.onError(new Error(data.error))
              return
            }
            if (data.done) {
              handlers.onComplete()
              return
            }
            if (data.token) handlers.onToken(data.token)
          } catch {
            // skip malformed
          }
        }
      }
    }
  } catch (error) {
    handlers.onError(error as Error)
  }
}
// [AGC:END] tool=Cc author=fangkun

// [AGC:START] tool=Cc author=fangkun
async function handleTestStream() {
  testing.value = true
  testOutput.value = ''
  testError.value = ''

  const processedSystem = replaceVariables(
    props.template.content.system,
    variableValues.value
  )
  const processedUser = replaceVariables(
    props.template.content.user || '',
    variableValues.value
  )

  const model = enabledModels.value.find(m => m.id === selectedModel.value)
  if (!model) {
    testError.value = 'Model not found'
    testing.value = false
    return
  }

  await apiSSE('/prompts/test-template-stream', {
    templateId: props.template.id,
    templateName: props.template.name,
    variables: variableValues.value,
    processedSystemPrompt: processedSystem,
    processedUserPrompt: processedUser,
    modelKey: selectedModel.value,
    modelInfo: {
      id: model.id,
      name: model.name,
      providerId: model.providerId || ''
    },
    saveHistory: true
  }, {
    onToken: (token) => {
      testOutput.value += token
    },
    onComplete: () => {
      testing.value = false
    },
    onError: (error) => {
      testError.value = error.message
      testing.value = false
    }
  })
}
// [AGC:END] tool=Cc author=fangkun
</script>

<style scoped>
.test-panel {
  margin-top: 16px;
}

.variables-section {
  margin-bottom: 16px;
}

.test-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.test-output {
  margin-top: 16px;
}

.test-output pre {
  background: var(--el-fill-color-light);
  border-radius: 4px;
  padding: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  margin: 0;
}
</style>
