<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-06-29 -->
<template>
  <div class="skill-manage">
    <!-- Left panel: Search -->
    <div class="panel search-panel">
      <h3>{{ $t('manage.title') }}</h3>
      <div class="search-bar">
        <el-input
          v-model="searchInput"
          :placeholder="$t('manage.searchPlaceholder')"
          clearable
          @input="handleSearchInput"
          @keyup.enter="handleSearchEnter"
          prefix-icon="Search"
        />
        <el-button @click="openBrowseDialog" class="browse-btn" size="small">
          {{ $t('manage.browseDirectory') }}
        </el-button>
      </div>
      <div class="path-bar" v-if="selectedSkillPath">
        <el-input
          v-model="selectedSkillPath"
          size="small"
          placeholder="Enter skill directory path"
          clearable
          @keyup.enter="loadDirFromPath"
        >
          <template #append>
            <el-button @click="loadDirFromPath" size="small">Reload</el-button>
          </template>
        </el-input>
      </div>
      <div class="search-results">
        <div
          v-for="skill in searchResults"
          :key="skill.skillName"
          class="search-result-item"
          :class="{ active: selectedSkillPath === skill.sourcePath }"
          @click="selectSkillDirectory(skill)"
        >
          <div class="skill-name">{{ skill.skillName }}</div>
          <div class="skill-plugin">{{ skill.pluginName }}</div>
        </div>
        <div v-if="searchResults.length === 0 && searchInput" class="no-results">
          {{ $t('manage.noResults') }}
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
    <el-dialog v-model="showBrowseDialog" title="Select Skill Directory" width="500px">
      <div class="browse-dialog">
        <div class="current-path">
          <el-input v-model="browsePath" placeholder="Enter directory path" clearable />
        </div>
        <div class="browse-tree" v-loading="treeLoading">
          <el-tree
            :data="treeData"
            :props="browseTreeProps"
            :load="loadTreeNode"
            lazy
            node-key="value"
            highlight-current
            @current-change="onBrowsePathSelect"
          >
            <template #default="{ node }">
              <span class="browse-node">
                <el-icon><Folder /></el-icon>
                <span>{{ node.label }}</span>
              </span>
            </template>
          </el-tree>
        </div>
        <div class="browse-actions">
          <el-button @click="loadSkillListFromPath" type="primary" :disabled="!browsePath">Load Skills</el-button>
          <el-button @click="showBrowseDialog = false">Cancel</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { Close, Link } from '@element-plus/icons-vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import type { SkillInfo, LinkedFileReference } from '../types/skill'
import SaveConflictDialog from './SaveConflictDialog.vue'
import { parseReferences } from '../utils/referenceParser'

const store = useSkillsStore()
const { t } = useI18n()

const searchInput = ref('')
const searchResults = ref<SkillInfo[]>([])
const selectedSkillPath = ref('')
const searchTimer = ref<number | null>(null)

const treeProps = {
  children: 'children',
  label: 'name',
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
const browsePath = ref('')
const treeData = ref<any[]>([])
const treeLoading = ref(false)
const browseTreeProps = { children: 'children', label: 'label', isLeaf: 'isLeaf' }

// Cached directory tree data to avoid duplicate API calls
const cachedTreeData = ref<{ path: string; children: any[] } | null>(null)

// Check if current file is a markdown file (supports preview)
const isMarkdownFile = computed(() => {
  if (!store.activeFilePath) return true
  const ext = store.activeFilePath.split('.').pop()?.toLowerCase() || ''
  return ['md', 'markdown'].includes(ext)
})

// Debounced search against installed skills
function handleSearchInput() {
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = window.setTimeout(async () => {
    if (!searchInput.value.trim()) {
      searchResults.value = store.installedSkills
      return
    }
    store.searchQuery = searchInput.value
    const all = store.installedSkills
    const q = searchInput.value.toLowerCase()
    searchResults.value = all.filter(s =>
      s.skillName.toLowerCase().includes(q) ||
      s.pluginName.toLowerCase().includes(q) ||
      s.pluginDescription?.toLowerCase().includes(q) ||
      s.pluginKeywords?.some(kw => kw.toLowerCase().includes(q))
    )
  }, 300)
}

// Enter key in search box: if looks like a path, load directory; otherwise search
function handleSearchEnter() {
  const val = searchInput.value.trim()
  if (!val) return
  // If starts with / or drive letter like C:\, treat as directory path
  if (val.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(val)) {
    selectedSkillPath.value = val
    loadDirFromPath()
  }
}

// Load skill directory from the path bar
async function loadDirFromPath() {
  const p = selectedSkillPath.value.trim()
  if (!p) return
  await loadDirectory(p)
}

// Shared directory loading function
async function loadDirectory(dirPath: string) {
  cachedTreeData.value = null

  // Fetch first-level children from the directory
  try {
    const r = await window.api.listSkillDirectory(dirPath)
    if (r.success && r.data && r.data.children) {
      // Cache the data for lazy loading BEFORE setting selectedSkillPath
      cachedTreeData.value = { path: dirPath, children: r.data.children }

      // Show ALL items (directories and files) as-is, no filtering
      const items: SkillInfo[] = []
      for (const child of r.data.children) {
        items.push({
          skillName: child.name,
          pluginName: '',
          sourcePath: child.path,
          pluginDescription: child.type === 'file' ? `File (${child.name})` : 'Directory',
          pluginAuthor: '',
          pluginLicense: '',
          pluginCategory: '',
          pluginKeywords: [],
        })
      }

      // Set path AFTER caching to trigger el-tree re-render with cached data
      selectedSkillPath.value = dirPath
      store.clearManageState()
      searchResults.value = items
    } else {
      selectedSkillPath.value = dirPath
      store.clearManageState()
      searchResults.value = []
    }
  } catch {
    ElMessage.error('Failed to load directory')
  }
}

// Select a skill and load its directory
async function selectSkillDirectory(skill: SkillInfo) {
  const p = skill.sourcePath
  // Check if it's a file (has extension) or directory
  const ext = p.split('.').pop() || ''
  const isFile = ext && !ext.includes('/') && !ext.includes('\\')
  if (isFile) {
    await openFile(p)
  } else {
    await loadDirectory(p)
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
  showBrowseDialog.value = true
  // Start from the root of the filesystem or default skills directory
  try {
    const r = await window.api.getDefaultDir('')
    if (r.success && r.data?.defaultDir) {
      browsePath.value = r.data.defaultDir
      await loadTreeRoot(browsePath.value)
    }
  } catch { /* ignore */ }
  if (!browsePath.value) {
    browsePath.value = '/'
    await loadTreeRoot('/')
  }
}

async function loadTreeRoot(dirPath: string) {
  treeLoading.value = true
  try {
    const r = await window.api.listDirs(dirPath)
    if (r.success && r.data) {
      treeData.value = (r.data.children || []).map((c: any) => ({ ...c, isLeaf: false }))
    } else {
      treeData.value = []
    }
  } catch {
    treeData.value = []
  } finally {
    treeLoading.value = false
  }
}

function loadTreeNode(node: any, resolve: (data: any[]) => void) {
  if (node.level === 0) {
    // Root level - data already in treeData
    resolve([])
    return
  }
  const path = node.data.value
  treeLoading.value = true
  window.api.listDirs(path).then(r => {
    if (r.success && r.data) {
      resolve(r.data.children || [])
    } else {
      resolve([])
    }
  }).catch(() => resolve([])).finally(() => { treeLoading.value = false })
}

function onBrowsePathSelect(_node: any, data: any) {
  browsePath.value = data.value
}

async function loadSkillListFromPath() {
  if (!browsePath.value) return
  await loadDirectory(browsePath.value)
  showBrowseDialog.value = false
}

onMounted(async () => {
  store.setView('manage')
  store.clearManageState()
  await store.loadInstalledSkills()
  searchResults.value = store.installedSkills
})
</script>

<style scoped>
.skill-manage {
  display: flex;
  height: 100%;
  gap: 1px;
  background: #e4e7ed;
}

.panel {
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel h3 {
  padding: 12px 16px;
  margin: 0;
  font-size: 14px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
}

/* Search panel */
.search-panel {
  width: 250px;
  min-width: 200px;
}

.search-panel .search-bar {
  display: flex;
  gap: 4px;
  padding: 8px;
}

.search-panel .search-bar .el-input {
  flex: 1;
  margin: 0;
}

.browse-btn {
  flex-shrink: 0;
}

.path-bar {
  padding: 0 8px 8px;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.search-result-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2px;
}

.search-result-item:hover {
  background: #f0f5ff;
}

.search-result-item.active {
  background: #e6f7ff;
}

.skill-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.skill-plugin {
  font-size: 11px;
  color: #909399;
}

.no-results {
  padding: 16px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

/* Editor panel */
.editor-panel {
  flex: 1;
  min-width: 400px;
}

.editor-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #e4e7ed;
  gap: 8px;
  background: #fafafa;
}

.file-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  flex: 1;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
}

.file-tab.active {
  background: #e6f7ff;
  border-color: #409eff;
}

.tab-name {
  max-width: 120px;
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
}

.tab-close:hover {
  color: #f56c6c;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

.no-file {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}

/* Linked files */
.linked-files {
  border-top: 1px solid #e4e7ed;
  max-height: 200px;
  overflow-y: auto;
}

.linked-files h4 {
  padding: 8px 12px;
  margin: 0;
  font-size: 13px;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
}

.linked-file-list {
  padding: 4px;
}

.linked-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.linked-file-item:hover {
  background: #f0f5ff;
}

.linked-file-item.active {
  background: #e6f7ff;
}

.linked-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #606266;
}

/* Browse dialog */
.browse-dialog .current-path {
  margin-bottom: 12px;
}

.browse-dialog .browse-tree {
  height: 300px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 12px;
}

.browse-dialog .browse-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.browse-node {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
</style>
// [AGC:END]
