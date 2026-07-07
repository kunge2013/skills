<template>
  <div class="skill-detail">
    <div class="detail-header">
      <el-button text @click="store.clearSelection()">&#8592; {{ $t('detail.back') }}</el-button>
      <h2>{{ store.selectedSkill?.skillName }}</h2>
      <span class="plugin-badge">{{ store.selectedSkill?.pluginName }}</span>
      <span v-if="installStatus" :class="['status-badge', installStatus.mode]" :title="statusTooltip">
        {{ statusLabel }}
      </span>
    </div>
    <div class="detail-content" v-loading="loading">
      <div class="metadata"><h3>{{ $t('detail.metadata') }}</h3><el-descriptions :column="1" border>
        <el-descriptions-item :label="$t('detail.name')">{{ store.selectedSkill?.skillName }}</el-descriptions-item>
        <el-descriptions-item :label="$t('detail.plugin')">{{ store.selectedSkill?.pluginName }}</el-descriptions-item>
        <el-descriptions-item :label="$t('detail.author')">{{ store.selectedSkill?.pluginAuthor }}</el-descriptions-item>
        <el-descriptions-item :label="$t('detail.license')">{{ store.selectedSkill?.pluginLicense }}</el-descriptions-item>
        <el-descriptions-item :label="$t('detail.path')">{{ skillContent?.path }}</el-descriptions-item>
      </el-descriptions></div>
      <div class="preview"><h3>{{ $t('detail.preview') }}</h3><div class="markdown-body" v-html="renderedMarkdown"></div></div>
      <div class="detail-actions">
        <el-button type="primary" @click="startEditing">{{ $t('detail.editSkill') }}</el-button>
        <el-button type="success" @click="showInstallDialog = true">{{ $t('detail.installSkill') }}</el-button>
      </div>
    </div>

    <InstallDialog
      v-model="showInstallDialog"
      :skill-name="store.selectedSkill?.skillName || ''"
      :default-target-dir="defaultTargetDir"
      @installed="onInstalled"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import type { InstallStatus } from '../types/skill'
import InstallDialog from './InstallDialog.vue'
const store = useSkillsStore()
const { t } = useI18n()
const loading = ref(false)
const uninstalling = ref(false)
const skillContent = ref<{ content: string; path: string; lastModified: number } | null>(null)
const renderedMarkdown = computed(() => skillContent.value?.content ? marked.parse(skillContent.value.content) : '')
const showInstallDialog = ref(false)
const installStatus = ref<InstallStatus | null>(null)
const defaultTargetDir = ref('')

const statusLabel = computed(() => {
  if (!installStatus.value) return t('detail.notInstalled')
  return t('detail.installedAs', { mode: installStatus.value.mode === 'copy' ? 'Copy' : 'Symlink' })
})

const statusTooltip = computed(() => {
  if (!installStatus.value) return ''
  return installStatus.value.mode === 'copy' ? 'Installed as copy (manual sync needed)' : 'Installed as symlink (auto-updates)'
})

async function loadContent() { if (!store.selectedSkill) return; loading.value = true; try { const c = await store.loadSkillContent(store.selectedSkill.sourcePath); if (c) skillContent.value = c } finally { loading.value = false } }
async function loadInstallStatus() {
  if (!store.selectedSkill) return
  const status = await store.checkInstallStatus(store.selectedSkill.skillName, '')
  installStatus.value = status
}
async function loadDefaultDir() {
  defaultTargetDir.value = await store.getDefaultDir('')
}
function startEditing() { store.skillContent = skillContent.value; store.setView('editor') }
function onInstalled() { loadInstallStatus() }
async function handleUninstall() {
  if (!store.selectedSkill) return
  uninstalling.value = true
  try {
    const result = await store.uninstallSkill(store.selectedSkill.skillName, '')
    if (result?.success) {
      ElMessage.success('Uninstalled: ' + store.selectedSkill.skillName)
      installStatus.value = null
    } else {
      ElMessage.error(result?.error || t('message.failed'))
    }
  } catch (e: any) {
    ElMessage.error(e.message || t('message.failed'))
  } finally {
    uninstalling.value = false
  }
}
onMounted(() => { loadContent(); loadInstallStatus(); loadDefaultDir() })
watch(() => store.selectedSkill, () => { loadContent(); loadInstallStatus(); loadDefaultDir() })
</script>
<style scoped>
.skill-detail { height: 100%; display: flex; flex-direction: column; background: #f5f7fa; }
.detail-header { padding: 12px 16px; background: #fff; border-bottom: 1px solid #e4e7ed; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.detail-header h2 { font-size: 18px; }
.plugin-badge { background: #e8f4fd; color: #409eff; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
.status-badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; cursor: default; }
.status-badge.symlink { background: #f0f9ff; color: #67c23a; }
.status-badge.copy { background: #fdf6ec; color: #e6a23c; }
.detail-content { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.metadata, .preview { background: #fff; padding: 16px; border-radius: 8px; }
.metadata h3, .preview h3 { margin-bottom: 12px; font-size: 15px; }
.markdown-body { line-height: 1.6; }
.markdown-body :deep(pre) { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdown-body :deep(code) { background: #f6f8fa; padding: 2px 4px; border-radius: 3px; }
.detail-actions { display: flex; gap: 12px; padding: 12px 16px; background: #fff; border-top: 1px solid #e4e7ed; }
</style>
