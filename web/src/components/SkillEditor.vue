<template>
  <div class="skill-editor">
    <div class="editor-header">
      <el-button text @click="store.setView('detail')">&#8592; {{ $t('editor.back') }}</el-button>
      <h2>{{ $t('editor.editing') }} {{ store.selectedSkill?.skillName }}</h2>
    </div>
    <div class="editor-body"><MdEditor v-model="editorContent" :toolbars="toolbars" :preview="true" :footers="[]" height="calc(100vh - 120px)" @onSave="handleSave" /></div>
    <div class="editor-footer">
      <span v-if="validationErrors.length > 0"><el-tag v-for="err in validationErrors" :key="err" type="danger" size="small" style="margin-right: 8px;">{{ err }}</el-tag></span>
      <div class="actions">
        <el-button @click="handleValidate" :loading="validating">{{ $t('editor.validate') }}</el-button>
        <el-button @click="handleDiscard">{{ $t('editor.discard') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">{{ $t('editor.save') }}</el-button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useSkillsStore } from '../stores/skills'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
const store = useSkillsStore()
const { t } = useI18n()
const editorContent = ref(''), saving = ref(false), validating = ref(false)
const validationErrors = ref<string[]>([]), originalContent = ref(''), expectedMtime = ref(0)
const toolbars = ['bold','underline','italic','-','title','quote','unorderedList','orderedList','codeRow','code','link','table','revoke','next','save','=','preview','fullscreen'] as any
async function loadContent() { if (!store.selectedSkill) return; const c = await store.loadSkillContent(store.selectedSkill.sourcePath); if (c) { editorContent.value = c.content; originalContent.value = c.content; expectedMtime.value = c.lastModified } }
async function handleSave() { if (!store.selectedSkill) return; saving.value = true; try { const r = await store.saveSkillContent(store.selectedSkill.sourcePath, editorContent.value, expectedMtime.value); if (r.success) { ElMessage.success(t('message.saved')); originalContent.value = editorContent.value; await loadContent() } else if (r.conflict) { await ElMessageBox.confirm(t('confirm.conflictMessage'), t('confirm.conflictTitle'), { confirmButtonText: t('confirm.overwrite'), cancelButtonText: t('confirm.reload') }).then(async () => { const cur = await store.loadSkillContent(store.selectedSkill!.sourcePath); if (cur) { expectedMtime.value = cur.lastModified; await handleSave() } }).catch(() => loadContent()) } else ElMessage.error(t('message.failed')) } finally { saving.value = false } }
function handleDiscard() { editorContent.value = originalContent.value; validationErrors.value = []; ElMessage.info(t('message.discarded')) }
async function handleValidate() { validating.value = true; try { const r = await store.validateSkillMd(editorContent.value); validationErrors.value = r.errors; if (r.valid) ElMessage.success(t('message.valid')) } finally { validating.value = false } }
onMounted(loadContent)
</script>
<style scoped>
.skill-editor { height: 100%; display: flex; flex-direction: column; }
.editor-header { padding: 12px 16px; background: #fff; border-bottom: 1px solid #e4e7ed; display: flex; align-items: center; gap: 12px; }
.editor-header h2 { font-size: 16px; }
.editor-body { flex: 1; overflow: hidden; }
.editor-footer { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #fff; border-top: 1px solid #e4e7ed; }
.actions { display: flex; gap: 8px; }
</style>
