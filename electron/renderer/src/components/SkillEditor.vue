// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
<template>
  <div class="skill-editor">
    <div class="editor-header">
      <el-button text @click="store.setView('detail')">&#8592; Back to detail</el-button>
      <h2>Editing: {{ store.selectedSkill?.skillName }}</h2>
    </div>
    <div class="editor-body">
      <MdEditor v-model="editorContent" :toolbars="toolbars" :preview="true" :footers="[]" height="calc(100vh - 120px)" @onSave="handleSave" />
    </div>
    <div class="editor-footer">
      <span v-if="validationErrors.length > 0" class="validation-errors">
        <el-tag v-for="err in validationErrors" :key="err" type="danger" size="small" style="margin-right: 8px;">{{ err }}</el-tag>
      </span>
      <div class="actions">
        <el-button @click="handleValidate" :loading="validating">Validate</el-button>
        <el-button @click="handleDiscard">Discard Changes</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">Save</el-button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, onMounted } from 'vue'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useSkillsStore } from '../stores/skills'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useSkillsStore()
const editorContent = ref('')
const saving = ref(false)
const validating = ref(false)
const validationErrors = ref<string[]>([])
const originalContent = ref('')
const expectedMtime = ref(0)

const toolbars = ['bold','underline','italic','strikeThrough','-','title','quote','unorderedList','orderedList','task','-','codeRow','code','link','image','table','revoke','next','save','=','preview','fullscreen'] as any

async function loadContent() {
  if (!store.selectedSkill) return
  const content = await store.loadSkillContent(store.selectedSkill.sourcePath)
  if (content) {
    editorContent.value = content.content
    originalContent.value = content.content
    expectedMtime.value = content.lastModified
  }
}

async function handleSave() {
  if (!store.selectedSkill) return
  saving.value = true
  try {
    const res = await store.saveSkillContent(store.selectedSkill.sourcePath, editorContent.value, expectedMtime.value)
    if (res.success) {
      ElMessage.success('Skill saved successfully')
      originalContent.value = editorContent.value
      await loadContent()
    } else if (res.conflict) {
      await ElMessageBox.confirm(
        'The file was modified externally. Overwrite with your changes?',
        'Conflict Detected',
        { confirmButtonText: 'Overwrite', cancelButtonText: 'Reload' }
      ).then(async () => {
        const current = await store.loadSkillContent(store.selectedSkill!.sourcePath)
        if (current) {
          expectedMtime.value = current.lastModified
          await handleSave()
        }
      }).catch(() => loadContent())
    } else {
      ElMessage.error(res.error || 'Failed to save')
    }
  } finally {
    saving.value = false
  }
}

function handleDiscard() {
  editorContent.value = originalContent.value
  validationErrors.value = []
  ElMessage.info('Changes discarded')
}

async function handleValidate() {
  validating.value = true
  try {
    const result = await store.validateSkillMd(editorContent.value)
    validationErrors.value = result.errors
    if (result.valid) ElMessage.success('Validation passed')
  } finally {
    validating.value = false
  }
}

onMounted(loadContent)
// [AGC:END]
</script>
<style scoped>
.skill-editor { height: 100%; display: flex; flex-direction: column; }
.editor-header { padding: 12px 16px; background: #fff; border-bottom: 1px solid #e4e7ed; display: flex; align-items: center; gap: 12px; }
.editor-header h2 { font-size: 16px; }
.editor-body { flex: 1; overflow: hidden; }
.editor-footer { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #fff; border-top: 1px solid #e4e7ed; }
.actions { display: flex; gap: 8px; }
.validation-errors { display: flex; flex-wrap: wrap; }
</style>
