<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-07-02 -->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="520px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="dir-picker" v-loading="loading">
      <!-- Drive selector -->
      <div class="drive-selector">
        <label>{{ $t?.('dirPicker.drive') || 'Drive' }}:</label>
        <el-select v-model="currentDrive" @change="onDriveChange" size="small" class="drive-select">
          <el-option
            v-for="drive in drives"
            :key="drive.value"
            :label="drive.label"
            :value="drive.value"
            :disabled="!drive.available"
          />
        </el-select>
        <el-button @click="goUp" :disabled="!canGoUp" size="small" class="up-btn">
          {{ $t?.('dirPicker.up') || '↑ Up' }}
        </el-button>
      </div>

      <!-- Breadcrumb navigation -->
      <div class="breadcrumb-bar">
        <el-breadcrumb separator=">">
          <el-breadcrumb-item
            v-for="(seg, idx) in breadcrumbSegments"
            :key="idx"
            @click="onBreadcrumbClick(seg, idx)"
            class="breadcrumb-segment"
          >
            {{ seg.label }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <!-- Flat directory listing -->
      <div class="dir-list">
        <div v-if="error" class="dir-error">
          {{ error }}
        </div>
        <div v-else-if="dirItems.length === 0 && !loading" class="dir-empty">
          {{ $t?.('dirPicker.emptyDir') || 'Empty directory' }}
        </div>
        <div
          v-for="item in dirItems"
          :key="item.path"
          class="dir-item"
          @click="onDirClick(item)"
        >
          <el-icon class="dir-icon"><Folder /></el-icon>
          <span class="dir-name">{{ item.name }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('confirm', currentPath)" type="primary" :disabled="!currentPath">
        {{ confirmText }}
      </el-button>
      <el-button @click="$emit('update:modelValue', false)">
        {{ cancelText }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, watch } from 'vue'
import { Folder } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  initialPath?: string
  confirmText?: string
  cancelText?: string
  dialogTitle?: string
}>(), {
  initialPath: '',
  confirmText: 'Load Skills',
  cancelText: 'Cancel',
  dialogTitle: 'Select Directory',
})

const emit = defineEmits<{
  confirm: [path: string]
  'update:modelValue': [visible: boolean]
}>()

// State
const drives = ref<{ label: string; value: string; available: boolean }[]>([])
const currentDrive = ref('')
const currentPath = ref('')
const dirItems = ref<{ name: string; path: string }[]>([])
const loading = ref(false)
const error = ref('')

// Breadcrumb segments computed from current path
const breadcrumbSegments = computed(() => {
  if (!currentPath.value) return []
  const p = currentPath.value
  // Windows: D:\github.io\skills -> [{label: 'D:\', path: 'D:\'}, {label: 'github.io', path: 'D:\github.io'}, ...]
  // Unix: /home/user -> [{label: '/', path: '/'}, {label: 'home', path: '/home'}, ...]
  const isWindows = /^[A-Z]:\\/i.test(p)
  const segments: { label: string; path: string }[] = []

  if (isWindows) {
    const driveRoot = p.substring(0, 3) // e.g., "D:\"
    segments.push({ label: driveRoot, path: driveRoot })
    const rest = p.substring(3)
    if (rest) {
      const parts = rest.split(/[\\/]/).filter(Boolean)
      let builtPath = driveRoot
      for (const part of parts) {
        builtPath = buildPath(builtPath, part)
        segments.push({ label: part, path: builtPath })
      }
    }
  } else {
    // Unix path
    if (p === '/') {
      segments.push({ label: '/', path: '/' })
    } else {
      segments.push({ label: '/', path: '/' })
      const parts = p.split('/').filter(Boolean)
      let builtPath = ''
      for (const part of parts) {
        builtPath = builtPath ? `${builtPath}/${part}` : `/${part}`
        segments.push({ label: part, path: builtPath })
      }
    }
  }
  return segments
})

// Whether the Up button should be enabled
const canGoUp = computed(() => {
  if (!currentPath.value) return false
  const p = currentPath.value
  // Windows: disabled at "D:\"
  if (/^[A-Z]:\\$/i.test(p)) return false
  // Unix: disabled at "/"
  if (p === '/') return false
  return true
})

function buildPath(parent: string, child: string): string {
  const isWin = /^[A-Z]:\\$/i.test(parent) || /^[A-Z]:\\/i.test(parent)
  if (isWin) {
    return parent.endsWith('\\') ? parent + child : parent + '\\' + child
  }
  return parent === '/' ? '/' + child : parent + '/' + child
}

function getDriveFromPath(p: string): string {
  const match = p.match(/^([A-Z]:\\)/i)
  return match ? match[1].toUpperCase() : '/'
}

async function loadDrives() {
  try {
    const r = await window.api.listDrives()
    if (r.success && r.data?.drives) {
      drives.value = r.data.drives
    }
  } catch { /* ignore */ }
}

async function loadDirectory(dirPath: string) {
  loading.value = true
  error.value = ''
  try {
    const r = await window.api.listDirs(dirPath)
    if (r.success && r.data) {
      currentPath.value = r.data.path
      dirItems.value = (r.data.children || [])
        .map((c: any) => ({ name: c.label, path: c.value }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      // Update drive selector to match current path
      currentDrive.value = getDriveFromPath(r.data.path)
    } else {
      error.value = r.error || 'Failed to load directory'
      dirItems.value = []
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load directory'
    dirItems.value = []
  } finally {
    loading.value = false
  }
}

async function onDriveChange(drive: string) {
  await loadDirectory(drive)
}

function onDirClick(item: { name: string; path: string }) {
  loadDirectory(item.path)
}

async function goUp() {
  if (!canGoUp.value) return
  const p = currentPath.value
  const isWindows = /^[A-Z]:\\/i.test(p)
  if (isWindows) {
    // Remove last segment
    const parts = p.substring(3).split(/[\\/]/).filter(Boolean)
    parts.pop()
    const newPath = parts.length > 0
      ? p.substring(0, 3) + parts.join('\\')
      : p.substring(0, 3)
    await loadDirectory(newPath)
  } else {
    const parent = p.split('/').slice(0, -1).join('/') || '/'
    await loadDirectory(parent)
  }
}

function onBreadcrumbClick(_seg: { label: string; path: string }, _idx: number) {
  loadDirectory(_seg.path)
}

// Watch for dialog open to initialize
watch(() => props.modelValue, async (visible) => {
  if (visible) {
    await loadDrives()
    if (props.initialPath) {
      currentPath.value = props.initialPath
      currentDrive.value = getDriveFromPath(props.initialPath)
      await loadDirectory(props.initialPath)
    } else if (drives.value.length > 0) {
      currentDrive.value = drives.value[0].value
      await loadDirectory(drives.value[0].value)
    }
  }
})
// [AGC:END]
</script>

<style scoped>
.dir-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drive-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drive-selector > label {
  font-weight: 600;
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
}

.drive-select {
  flex: 1;
  min-width: 0;
}

.up-btn {
  flex-shrink: 0;
}

.breadcrumb-bar {
  padding: 4px 0;
  border-bottom: 1px solid #e4e7ed;
}

.breadcrumb-bar :deep(.el-breadcrumb) {
  font-size: 13px;
}

.breadcrumb-segment {
  cursor: pointer;
  color: #409eff;
}

.breadcrumb-segment:hover {
  color: #66b1ff;
}

.dir-list {
  height: 280px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 4px;
}

.dir-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.dir-item:hover {
  background: #f0f5ff;
}

.dir-icon {
  color: #e6a23c;
  flex-shrink: 0;
}

.dir-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.dir-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 13px;
}

.dir-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #f56c6c;
  font-size: 13px;
  text-align: center;
  padding: 16px;
}
</style>
