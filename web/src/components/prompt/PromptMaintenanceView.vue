<template>
  <div class="prompt-maintenance-view">
    <div class="maintenance-header">
      <h2>{{ t('prompt.maintenanceTitle') }}</h2>
      <el-button @click="showCreateForm = !showCreateForm">
        {{ showCreateForm ? t('prompt.cancel') : t('prompt.createTemplate') }}
      </el-button>
    </div>

    <!-- Create Form -->
    <el-card v-if="showCreateForm" shadow="never" class="template-form">
      <TemplateForm
        :template="createForm"
        :providers="templateTypes"
        @save="onCreate"
        @cancel="showCreateForm = false"
      />
    </el-card>

    <!-- Template List -->
    <div class="template-list">
      <el-card
        v-for="template in store.templates"
        :key="template.id"
        shadow="never"
        class="template-card"
      >
        <div class="template-header">
          <div class="template-info">
            <span class="template-name">{{ template.name }}</span>
            <el-tag size="small" type="info">{{ template.type }}</el-tag>
            <el-tag v-if="!store.isCustomTemplate(template.id)" size="small" type="warning">
              {{ t('prompt.builtIn') }}
            </el-tag>
          </div>
          <div class="template-actions">
            <el-button size="small" @click="store.selectAndOptimize(template)">
              {{ t('prompt.optimize') }}
            </el-button>
            <el-button
              v-if="store.isCustomTemplate(template.id)"
              size="small"
              @click="startEdit(template)"
            >
              {{ t('prompt.edit') }}
            </el-button>
            <el-button
              v-if="store.isCustomTemplate(template.id)"
              type="danger"
              size="small"
              @click="onDelete(template)"
            >
              {{ t('prompt.delete') }}
            </el-button>
          </div>
        </div>

        <div class="template-preview">{{ truncate(template.content.system) }}</div>

        <!-- Edit Form -->
        <TemplateForm
          v-if="editingTemplateId === template.id"
          :template="editForm"
          :providers="templateTypes"
          :is-edit="true"
          @save="onUpdate"
          @cancel="cancelEdit"
        />
      </el-card>
    </div>

    <el-empty v-if="store.templates.length === 0" :description="t('prompt.emptyTemplates')" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'
import { usePromptStore } from '../../stores/prompt'
import TemplateForm from './TemplateForm.vue'
import type { Template } from '../../types/prompt'

const { t } = useI18n()
const store = usePromptStore()

const showCreateForm = ref(false)
const editingTemplateId = ref<string | null>(null)

const templateTypes = [
  { value: 'optimize', label: 'Optimize' },
  { value: 'userOptimize', label: 'User Optimize' },
  { value: 'iterate', label: 'Iterate' },
  { value: 'evaluation', label: 'Evaluation' },
  { value: 'variable-extraction', label: 'Variable Extraction' },
  { value: 'image-optimize', label: 'Image Optimize' },
]

const createForm = reactive({
  name: '',
  type: 'optimize' as Template['type'],
  content: { system: '', user: '' as string },
  description: '',
  category: '',
})

const editForm = reactive({
  id: '',
  name: '',
  type: 'optimize' as Template['type'],
  content: { system: '', user: '' as string },
  description: '',
  category: '',
})

function startEdit(template: Template) {
  editingTemplateId.value = template.id
  editForm.id = template.id
  editForm.name = template.name
  editForm.type = template.type
  editForm.content = { system: template.content.system, user: template.content.user || '' }
  editForm.description = template.description || ''
  editForm.category = template.category || ''
}

function cancelEdit() {
  editingTemplateId.value = null
}

function truncate(text: string, maxLen = 150) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

async function onCreate() {
  if (!createForm.name || !createForm.content.system) {
    alert(t('prompt.templateValidation'))
    return
  }
  await store.createTemplate({
    name: createForm.name,
    type: createForm.type,
    templateType: 'advanced' as const,
    content: { system: createForm.content.system, user: createForm.content.user || undefined },
    description: createForm.description || undefined,
    category: createForm.category || undefined,
  })
  showCreateForm.value = false
  Object.assign(createForm, { name: '', type: 'optimize', content: { system: '', user: '' }, description: '', category: '' })
}

async function onUpdate() {
  if (!editForm.name || !editForm.content.system) {
    alert(t('prompt.templateValidation'))
    return
  }
  await store.updateTemplate(editForm.id, {
    name: editForm.name,
    type: editForm.type,
    content: { ...editForm.content },
    description: editForm.description || undefined,
    category: editForm.category || undefined,
  })
  cancelEdit()
}

async function onDelete(template: Template) {
  try {
    await ElMessageBox.confirm(
      t('prompt.confirmDeleteTemplate', { name: template.name }),
      t('prompt.delete'),
      { confirmButtonText: t('prompt.delete'), cancelButtonText: t('prompt.cancel'), type: 'warning' }
    )
    await store.deleteTemplate(template.id)
  } catch {
    // User cancelled
  }
}
</script>

<style scoped>
.prompt-maintenance-view { display: flex; flex-direction: column; gap: 16px; }
.maintenance-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.template-form { margin-bottom: 8px; }
.template-list { display: flex; flex-direction: column; gap: 8px; }
.template-card { padding: 12px; }
.template-header { display: flex; justify-content: space-between; align-items: center; }
.template-info { display: flex; align-items: center; gap: 8px; }
.template-name { font-weight: 600; font-size: 14px; }
.template-actions { display: flex; align-items: center; gap: 8px; }
.template-preview { margin-top: 8px; font-size: 13px; color: var(--el-text-color-secondary); white-space: pre-wrap; }
</style>
