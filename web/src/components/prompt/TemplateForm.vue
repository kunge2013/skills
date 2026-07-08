// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08
<template>
  <div class="template-form-content">
    <el-form label-position="top">
      <el-form-item :label="t('prompt.templateName')">
        <el-input v-model="localTemplate.name" :disabled="isEdit" />
      </el-form-item>
      <el-form-item :label="t('prompt.templateType')">
        <el-select v-model="localTemplate.type">
          <el-option
            v-for="type in providers"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('prompt.systemPrompt')">
        <MdEditor v-model="localTemplate.content.system" :tool="tools" :footers="[]" :preview="false" height="150" />
      </el-form-item>
      <el-form-item :label="t('prompt.userPrompt')">
        <MdEditor v-model="userContent" :tool="tools" :footers="[]" :preview="false" height="100" />
      </el-form-item>

      <!-- Variable Configuration Section -->
      <VariableConfigSection
        v-model:system-variables="systemVariablesRef"
        :all-variables="allVariables"
        @scan="handleScanVariables"
      />

      <!-- Test Panel (only in edit mode) -->
      <TemplateTestPanel
        v-if="isEdit && localTemplate.id"
        :template="{
          id: localTemplate.id,
          name: localTemplate.name,
          content: localTemplate.content,
          systemVariables: systemVariablesRef
        }"
      />

      <div class="form-actions">
        <el-button type="primary" @click="$emit('save')">
          {{ t(isEdit ? 'prompt.save' : 'prompt.createTemplate') }}
        </el-button>
        <el-button @click="$emit('cancel')">
          {{ t('prompt.cancel') }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

// [AGC:START] tool=Cc author=fangkun
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useTemplateVariables } from '../../composables/useTemplateVariables'
import VariableConfigSection from './VariableConfigSection.vue'
import TemplateTestPanel from './TemplateTestPanel.vue'
import { usePromptStore } from '../../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()

const props = defineProps<{
  template: {
    id?: string
    name: string
    type: string
    content: { system: string; user?: string }
    description?: string
    category?: string
    systemVariables?: string[]
  }
  providers: Array<{ value: string; label: string }>
  isEdit?: boolean
}>()

defineEmits<{
  save: []
  cancel: []
}>()

const localTemplate = computed(() => props.template)
const userContent = computed({
  get: () => props.template.content.user || '',
  set: (val: string) => { props.template.content.user = val },
})

// Variable configuration
const systemVariablesRef = ref<string[]>(props.template.systemVariables || [])
const { allVariables, userVariables } = useTemplateVariables(
  computed(() => props.template.content.system),
  userContent,
  systemVariablesRef
)

// [AGC:START] tool=Cc author=fangkun
function handleScanVariables() {
  // Trigger recalculation by filtering out variables that no longer exist
  systemVariablesRef.value = systemVariablesRef.value.filter(v =>
    allVariables.value.includes(v)
  )
}
// [AGC:END]

// Update template's systemVariables
watch(systemVariablesRef, (newVal) => {
  props.template.systemVariables = newVal
}, { deep: true })

const enabledModels = computed(() => store.enabledModels)

// Keep toolbar minimal but functional (removed preview)
const tools = [
  'bold', 'italic', 'underline', 'strikeThrough',
  'title', 'quote', 'unorderedList', 'orderedList',
  'codeRow', 'code', 'link', 'table',
  'revoke', 'next', 'save', '=',
  'pageAnchor', 'prettify', 'fullscreen',
]
</script>
// [AGC:END]

<style scoped>
.template-form-content { padding-top: 12px; }
.form-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
