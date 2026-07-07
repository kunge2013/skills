<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-06-29 -->
<template>
  <div class="skill-manage">
    <!-- Left panel: Directory tree -->
    <div class="panel tree-panel">
      <div class="tree-header">
        <h3>{{ $t('manage.title') }}</h3>
        <div class="tree-actions">
          <el-button @click="openBrowseDialog" size="small" :icon="FolderOpened">
            {{ $t('manage.browseDirectory') }}
          </el-button>
          <el-tooltip :content="$t('manage.refreshTree')" placement="top">
            <el-button @click="refreshTree" size="small" :icon="Refresh" circle />
          </el-tooltip>
        </div>
      </div>
      <div class="tree-body" v-loading="treeLoading">
        <el-tree
          ref="treeRef"
          :data="treeData"
          :props="treeProps"
          node-key="path"
          highlight-current
          lazy
          :load="loadNode"
          @node-click="onNodeClick"
          class="dir-tree"
        >
          <template #default="{ node, data }">
            <span class="tree-node-content">
              <el-icon class="tree-node-icon">
                <Folder v-if="data.type === 'directory'" />
                <Document v-else />
              </el-icon>
              <span class="tree-node-label" :title="data.path">{{ node.label }}</span>
              <el-tag v-if="data.type === 'file' && isMdFile(data.name)" size="small" class="tree-node-tag">MD</el-tag>
            </span>
          </template>
        </el-tree>
        <div v-if="treeData.length === 0 && !treeLoading" class="tree-empty">
          {{ $t('manage.treeEmpty') }}
          <div class="tree-empty-hint">
            {{ $t('manage.treeEmptyHint') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel: Editor + Linked files -->
    <div class="panel editor-panel">
      <div class="editor-header">
        <div class="file-tabs">
          <span
            v-for="file in store.openFiles"
            :key="file.path"
            class="file-tab"
            :class="{ active: store.activeFilePath === file.path }"
            :title="file.path"
            @click="store.activeFilePath = file.path"
          >
            <span class="tab-name">{{ file.name }}</span>
            <el-tag v-if="isModified(file.path)" type="warning" size="small" class="tab-modified" />
            <el-icon class="tab-close" @click.stop="store.closeFile(file.path)"><Close /></el-icon>
          </span>
        </div>
        <el-button
          type="primary"
          size="small"
          @click="handleSaveAll"
          :loading="store.saveProgress !== null"
          :disabled="store.modifiedFiles.size === 0"
        >
          {{ store.saveProgress ? $t('manage.saving') : $t('manage.saveAll') }}
          ({{ store.modifiedFiles.size }})
        </el-button>
      </div>

      <div class="editor-body">
        <template v-if="store.activeFilePath">
          <MdEditor
            v-model="activeFileContent"
            :toolbars="toolbars"
            :preview="isMarkdownFile"
            :footers="[]"
            height="calc(100vh - 180px)"
            @onSave="handleSingleSave"
          />
        </template>
        <div v-else class="no-file">
          {{ $t('manage.noFileSelected') }}
        </div>
      </div>

      <!-- Linked files panel -->
      <div v-if="store.linkedFiles.length > 0" class="linked-files">
        <h4>{{ $t('manage.linkedFiles') }}</h4>
        <div class="linked-file-list">
          <div
            v-for="ref in store.linkedFiles"
            :key="ref.resolvedPath"
            class="linked-file-item"
            :class="{ active: store.activeFilePath === ref.resolvedPath }"
            :title="ref.resolvedPath"
            @click="openLinkedFile(ref)"
          >
            <el-icon><Link /></el-icon>
            <span class="linked-path">{{ ref.relativePath }}</span>
            <el-tag v-if="isModified(ref.resolvedPath)" type="warning" size="small">
              {{ $t('manage.modified') }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- Save conflict dialog -->
    <SaveConflictDialog
      :visible="showConflictDialog"
      :conflict-info="conflictInfo"
      @overwrite="handleConflictOverwrite"
      @reload="handleConflictReload"
      @skip="handleConflictSkip"
    />

    <!-- Browse directory dialog -->
    <DirPicker
      v-model="showBrowseDialog"
      :initial-path="browseInitialPath"
      :confirm-text="$t('dirPicker.confirm')"
      :cancel-text="$t('dirPicker.cancel')"
      :dialog-title="$t('dirPicker.selectSkillDir')"
      @confirm="onBrowseConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { Close, Link, Folder, Document, FolderOpened, Refresh } from '@element-plus/icons-vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import type { SkillInfo, LinkedFileReference } from '../types/skill'
import SaveConflictDialog from './SaveConflictDialog.vue'
import DirPicker from './DirPicker.vue'
import { parseReferences } from '../utils/referenceParser'

const store = useSkillsStore()
const { t } = useI18n()

// Tree state
const treeRef = ref()
const treeData = ref<any[]>([])
const treeLoading = ref(false)
const selectedSkillPath = ref('')
const currentDirPath = ref('')

const treeProps = {
  children: 'children',
  label: 'name',
  isLeaf: 'isLeaf',
}

const toolbars = [
  'bold', 'underline', 'italic', '-',
  'title', 'quote', 'unorderedList', 'orderedList',
  'codeRow', 'code', 'link', 'table',
  'revoke', 'next', 'save',
  '=', 'preview', 'fullscreen'
] as any

const activeFileContent = ref('')
const showConflictDialog = ref(false)
const conflictInfo = ref<{ path: string; currentContent: string } | null>(null)
const pendingConflictPath = ref('')

// Browse directory dialog state
const showBrowseDialog = ref(false)
const browseInitialPath = ref('')

// Check if current file is a markdown file (supports preview)
const isMarkdownFile = computed(() => {
  if (!store.activeFilePath) return true
  const ext = store.activeFilePath.split('.').pop()?.toLowerCase() || ''
  return ['md', 'markdown'].includes(ext)
})

function isMdFile(name: string): boolean {
  if (!name) return false
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return ext === 'md' || ext === 'markdown'
}

// Lazy load tree nodes
async function loadNode(node: any, resolve: (data: any[]) => void) {
  if (node.level === 0) {
    // Root level: return initial directory
    resolve(treeData.value)
    return
  }

  try {
    const r = await window.api.listSkillDirectory(node.data.path)
    if (r.success && r.data && r.data.children) {
      const children = r.data.children.map((c: any) => ({
        name: c.name,
        path: c.path,
        type: c.type || 'directory',
        isLeaf: c.type === 'file',
        children: [],
      }))
      resolve(children)
    } else {
      resolve([])
    }
  } catch {
    resolve([])
  }
}

// Click on a tree node
async function onNodeClick(data: any, node: any) {
  if (data.type === 'file') {
    await openFile(data.path)
  } else if (data.type === 'directory') {
    // Expand directory node
    node.expanded = !node.expanded
    selectedSkillPath.value = data.path
  }
}

// Load the directory tree starting from a path
async function loadDirectoryTree(dirPath: string) {
  treeLoading.value = true
  try {
    const r = await window.api.listSkillDirectory(dirPath)
    if (r.success && r.data) {
      const rootName = dirPath.split(/[\\/]/).pop() || dirPath
      treeData.value = [{
        name: rootName,
        path: dirPath,
        type: 'directory',
        isLeaf: false,
        children: (r.data.children || []).map((c: any) => ({
          name: c.name,
          path: c.path,
          type: c.type || 'directory',
          isLeaf: c.type === 'file',
          children: [],
        })),
      }]
      currentDirPath.value = dirPath
      selectedSkillPath.value = dirPath
    } else {
      ElMessage.error('Failed to load directory')
    }
  } catch {
    ElMessage.error('Failed to load directory')
  } finally {
    treeLoading.value = false
  }
}

// Refresh tree
function refreshTree() {
  if (currentDirPath.value) {
    loadDirectoryTree(currentDirPath.value)
  }
}

// Open a file for editing
async function openFile(p: string) {
  const r = await window.api.readSkillFile(p)
  if (r.success && r.data) {
    // Check if already in openFiles
    const existing = store.openFiles.find(f => f.path === p)
    if (!existing) {
      store.openFiles.push({ path: p, name: p.split('/').pop() || p, content: r.data.content, mtime: r.data.lastModified })
    }
    store.activeFilePath = p
    activeFileContent.value = r.data.content

    // If it's skill.md, parse references
    if (p.endsWith('SKILL.md') || p.endsWith('skill.md')) {
      const refs = parseReferences(r.data.content, p)
      store.linkedFiles = refs
    } else {
      store.linkedFiles = []
    }
  } else {
    ElMessage.error(r.error || t('message.failed'))
  }
}

// Open a linked file
async function openLinkedFile(ref: LinkedFileReference) {
  await openFile(ref.resolvedPath)
}

// Check if a file is modified
function isModified(p: string): boolean {
  return store.modifiedFiles.has(p)
}

// Track changes to active file
watch(activeFileContent, (newContent) => {
  if (!store.activeFilePath) return
  const file = store.openFiles.find(f => f.path === store.activeFilePath)
  if (!file) return
  if (newContent !== file.content) {
    store.trackFileChange(store.activeFilePath, newContent, file.mtime)
  }
})

// Save all modified files
async function handleSaveAll() {
  const result = await store.saveModifiedFiles()

  if (result.success) {
    ElMessage.success(t('manage.saveComplete'))
    // Update openFiles mtime
    for (const savedPath of result.saved) {
      const idx = store.openFiles.findIndex(f => f.path === savedPath)
      if (idx >= 0) {
        const r = await window.api.readSkillFile(savedPath)
        if (r.success && r.data) {
          store.openFiles[idx].mtime = r.data.lastModified
          if (store.activeFilePath === savedPath) {
            activeFileContent.value = r.data.content
          }
        }
      }
    }
  } else if (result.conflicts.length > 0) {
    // Show conflict dialog for first conflict
    const conflict = result.conflicts[0]
    pendingConflictPath.value = conflict.path
    conflictInfo.value = conflict
    showConflictDialog.value = true
  } else if (result.failed.length > 0) {
    ElMessage.error(t('manage.saveFailed') + ': ' + result.failed[0]?.error)
  }
}

// Single file save (Ctrl+S)
async function handleSingleSave() {
  if (!store.activeFilePath) return
  const file = store.openFiles.find(f => f.path === store.activeFilePath)
  if (!file) return
  const r = await window.api.saveSkillFile(store.activeFilePath, activeFileContent.value, file.mtime)
  if (r.success) {
    store.modifiedFiles.delete(store.activeFilePath)
    const idx = store.openFiles.findIndex(f => f.path === store.activeFilePath)
    if (idx >= 0) {
      const fresh = await window.api.readSkillFile(store.activeFilePath)
      if (fresh.success && fresh.data) {
        store.openFiles[idx].mtime = fresh.data.lastModified
      }
    }
    ElMessage.success(t('message.saved'))
  } else if (r.conflict) {
    pendingConflictPath.value = store.activeFilePath
    conflictInfo.value = { path: store.activeFilePath, currentContent: r.currentContent || '' }
    showConflictDialog.value = true
  } else {
    ElMessage.error(r.error || t('message.failed'))
  }
}

// Conflict dialog handlers
async function handleConflictOverwrite() {
  if (!pendingConflictPath.value) return
  const file = store.openFiles.find(f => f.path === pendingConflictPath.value)
  if (!file) return
  const r = await window.api.saveSkillFile(pendingConflictPath.value, activeFileContent.value)
  if (r.success) {
    store.modifiedFiles.delete(pendingConflictPath.value)
    const fresh = await window.api.readSkillFile(pendingConflictPath.value)
    if (fresh.success && fresh.data) {
      file.mtime = fresh.data.lastModified
    }
    ElMessage.success(t('message.saved'))
  }
  showConflictDialog.value = false
  conflictInfo.value = null
}

async function handleConflictReload() {
  const path = pendingConflictPath.value
  await openFile(path)
  showConflictDialog.value = false
  conflictInfo.value = null
}

function handleConflictSkip() {
  store.handleSaveConflict(pendingConflictPath.value)
  showConflictDialog.value = false
  conflictInfo.value = null
}

// Browse directory functions
async function openBrowseDialog() {
  try {
    const r = await window.api.getDefaultDir('')
    if (r.success && r.data?.defaultDir) {
      browseInitialPath.value = r.data.defaultDir
    }
  } catch { /* ignore */ }
  showBrowseDialog.value = true
}

async function onBrowseConfirm(dirPath: string) {
  showBrowseDialog.value = false
  await loadDirectoryTree(dirPath)
}

onMounted(async () => {
  store.setView('manage')
  // Auto-load the default skills directory
  try {
    const r = await window.api.getDefaultDir('')
    if (r.success && r.data?.defaultDir) {
      selectedSkillPath.value = r.data.defaultDir
      await loadDirectoryTree(r.data.defaultDir)
    }
  } catch { /* ignore */ }
})
</script>

<style scoped>
.skill-manage {
  display: flex;
  height: 100vh;
  gap: 0;
  background: #f5f7fa;
}

.panel {
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel h3 {
  padding: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

/* Tree panel */
.tree-panel {
  width: 300px;
  min-width: 240px;
  max-width: 500px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.tree-header {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tree-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.tree-actions .el-button:first-child {
  flex: 1;
}

.tree-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.dir-tree {
  background: transparent;
  --el-tree-node-content-height: 32px;
}

.dir-tree :deep(.el-tree-node__content) {
  border-radius: 6px;
  padding: 2px 4px;
  transition: background-color 0.2s;
}

.dir-tree :deep(.el-tree-node__content:hover) {
  background: #f0f5ff;
}

.dir-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #ecf5ff;
  color: #409eff;
}

.dir-tree :deep(.el-tree-node__expand-icon) {
  color: #909399;
  font-size: 12px;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.tree-node-icon {
  flex-shrink: 0;
  color: #909399;
  font-size: 14px;
}

.tree-node-content .el-icon--Folder {
  color: #e6a23c;
}

.tree-node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #303133;
}

.tree-node-tag {
  flex-shrink: 0;
  font-size: 10px;
  height: 16px;
  line-height: 14px;
}

.tree-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: #909399;
  font-size: 13px;
  text-align: center;
}

.tree-empty-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #c0c4cc;
}

/* Editor panel */
.editor-panel {
  flex: 1;
  min-width: 400px;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #e4e7ed;
  gap: 8px;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
}

.file-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  flex: 1;
}

.file-tabs::-webkit-scrollbar {
  height: 4px;
}

.file-tabs::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 2px;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  transition: all 0.15s;
}

.file-tab:hover {
  background: #e8edf3;
}

.file-tab.active {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.tab-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-modified {
  flex-shrink: 0;
}

.tab-close {
  flex-shrink: 0;
  cursor: pointer;
  color: #909399;
  font-size: 12px;
  border-radius: 50%;
  padding: 1px;
  transition: all 0.15s;
}

.tab-close:hover {
  color: #f56c6c;
  background: #fef0f0;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

.no-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #c0c4cc;
  font-size: 16px;
  gap: 8px;
}

/* Linked files */
.linked-files {
  border-top: 1px solid #ebeef5;
  max-height: 180px;
  overflow-y: auto;
  background: #fafbfc;
}

.linked-files h4 {
  padding: 8px 16px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  background: transparent;
  border-bottom: 1px solid #ebeef5;
  position: sticky;
  top: 0;
  z-index: 1;
}

.linked-file-list {
  padding: 4px;
}

.linked-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.15s;
}

.linked-file-item:hover {
  background: #f0f5ff;
}

.linked-file-item.active {
  background: #ecf5ff;
}

.linked-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #606266;
}

/* Responsive */
@media (max-width: 768px) {
  .tree-panel {
    width: 240px;
    min-width: 200px;
  }
  .editor-panel {
    min-width: 300px;
  }
}
</style>
// [AGC:END]
