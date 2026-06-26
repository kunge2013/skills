// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
<template>
  <div class="skill-detail">
    <div class="detail-header">
      <el-button text @click="store.clearSelection()">&#8592; Back to list</el-button>
      <h2>{{ store.selectedSkill?.skillName }}</h2>
      <span class="plugin-badge">{{ store.selectedSkill?.pluginName }}</span>
    </div>
    <div class="detail-content" v-loading="contentLoading">
      <div class="metadata">
        <h3>Metadata</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="Name">{{ store.selectedSkill?.skillName }}</el-descriptions-item>
          <el-descriptions-item label="Plugin">{{ store.selectedSkill?.pluginName }}</el-descriptions-item>
          <el-descriptions-item label="Author">{{ store.selectedSkill?.pluginAuthor }}</el-descriptions-item>
          <el-descriptions-item label="License">{{ store.selectedSkill?.pluginLicense }}</el-descriptions-item>
          <el-descriptions-item label="Category">{{ store.selectedSkill?.pluginCategory }}</el-descriptions-item>
          <el-descriptions-item label="Path">{{ skillContent?.path }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="preview">
        <h3>Preview</h3>
        <div class="markdown-body" v-html="renderedMarkdown"></div>
      </div>
      <div class="detail-actions">
        <el-button type="primary" @click="startEditing">Edit Skill</el-button>
        <el-button type="success" @click="handleInstall">Install to Project</el-button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, onMounted } from 'vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'

const store = useSkillsStore()
const contentLoading = ref(false)
const skillContent = ref<{ content: string; path: string; lastModified: number } | null>(null)

const renderedMarkdown = computed(() =>
  skillContent.value?.content ? marked.parse(skillContent.value.content) : ''
)

async function loadContent() {
  if (!store.selectedSkill) return
  contentLoading.value = true
  try {
    const content = await store.loadSkillContent(store.selectedSkill.sourcePath)
    if (content) skillContent.value = content
  } finally {
    contentLoading.value = false
  }
}

function startEditing() {
  store.skillContent = skillContent.value
  store.setView('editor')
}

async function handleInstall() {
  if (!store.selectedSkill) return
  const res = await store.installSkill(store.selectedSkill.skillName, '')
  if (res.success) ElMessage.success(`Skill '${store.selectedSkill.skillName}' installed`)
  else ElMessage.error(res.error || 'Failed to install skill')
}

onMounted(loadContent)
// [AGC:END]
</script>
<style scoped>
.skill-detail { height: 100%; display: flex; flex-direction: column; background: #f5f7fa; }
.detail-header { padding: 12px 16px; background: #fff; border-bottom: 1px solid #e4e7ed; display: flex; align-items: center; gap: 12px; }
.detail-header h2 { font-size: 18px; }
.plugin-badge { background: #e8f4fd; color: #409eff; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
.detail-content { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.metadata, .preview { background: #fff; padding: 16px; border-radius: 8px; }
.metadata h3, .preview h3 { margin-bottom: 12px; font-size: 15px; color: #333; }
.markdown-body { line-height: 1.6; }
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) { margin-top: 16px; margin-bottom: 8px; }
.markdown-body :deep(pre) { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdown-body :deep(code) { background: #f6f8fa; padding: 2px 4px; border-radius: 3px; font-size: 14px; }
.detail-actions { display: flex; gap: 12px; padding: 12px 16px; background: #fff; border-top: 1px solid #e4e7ed; }
</style>
