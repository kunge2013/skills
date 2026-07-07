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
        <MdEditor v-model="localTemplate.content.system" :tool="tools" :footers="[]" height="300" />
      </el-form-item>
      <el-form-item :label="t('prompt.userPrompt')">
        <MdEditor v-model="userContent" :tool="tools" :footers="[]" height="200" />
      </el-form-item>
      <div class="form-actions">
        <el-button type="primary" @click="$emit('save')">{{ t(isEdit ? 'prompt.save' : 'prompt.createTemplate') }}</el-button>
        <el-button @click="$emit('cancel')">{{ t('prompt.cancel') }}</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

const { t } = useI18n()

const props = defineProps<{
  template: {
    id?: string
    name: string
    type: string
    content: { system: string; user?: string }
    description?: string
    category?: string
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

// Keep toolbar minimal but functional
const tools = [
  'bold', 'italic', 'underline', 'strikeThrough',
  'title', 'quote', 'unorderedList', 'orderedList',
  'codeRow', 'code', 'link', 'table',
  'revoke', 'next', 'save', '=',
  'pageAnchor', 'prettify', 'preview', 'fullscreen',
]
</script>

<style scoped>
.template-form-content { padding-top: 12px; }
.form-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
