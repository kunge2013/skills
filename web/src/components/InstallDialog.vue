<template>
  <el-dialog
    v-model="visible"
    :title="$t('install.title')"
    width="560px"
    :close-on-click-modal="false"
    @close="reset"
  >
    <div class="install-dialog-content" v-loading="loading">
      <!-- Skill name (read-only) -->
      <div class="field">
        <label>{{ $t('install.skillName') }}</label>
        <span class="skill-name">{{ skillName }}</span>
      </div>

      <!-- Install mode selector -->
      <div class="field">
        <label>{{ $t('install.installMode') }}</label>
        <div class="mode-options">
          <label class="mode-option">
            <el-radio v-model="form.mode" value="symlink" size="default">{{ $t('install.symlinkMode') }}</el-radio>
            <span class="mode-desc">{{ $t('install.symlinkDesc') }}</span>
          </label>
          <label class="mode-option">
            <el-radio v-model="form.mode" value="copy" size="default">{{ $t('install.copyMode') }}</el-radio>
            <span class="mode-desc">{{ $t('install.copyDesc') }}</span>
          </label>
        </div>
      </div>

      <!-- Copy mode warning -->
      <el-alert
        v-if="form.mode === 'copy'"
        type="warning"
        :closable="false"
        show-icon
        class="copy-warning"
      >
        {{ $t('install.copyWarning') }}
      </el-alert>

      <!-- Target directory with tree -->
      <div class="field">
        <label>{{ $t('install.targetDirectory') }}</label>
        <div class="dir-picker">
          <el-input v-model="form.targetDir" :placeholder="$t('install.targetDirPlaceholder')" clearable />
          <el-button @click="toggleTree" size="small" :icon="showTree ? ArrowUp : FolderOpened">
            {{ showTree ? $t('install.close') : $t('install.browse') }}
          </el-button>
        </div>
        <div v-if="showTree" class="dir-tree" v-loading="treeLoading">
          <el-tree
            ref="treeRef"
            :data="treeData"
            :props="treeProps"
            node-key="value"
            highlight-current
            lazy
            :load="loadNode"
            @node-click="onNodeClick"
            :current-node-key="form.targetDir"
          >
            <template #default="{ node, data }">
              <span class="tree-node">
                <el-icon class="tree-icon"><Folder /></el-icon>
                <span class="tree-label">{{ node.label }}</span>
              </span>
            </template>
          </el-tree>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ $t('install.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleInstall">
        {{ $t('install.install') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { Folder, FolderOpened, ArrowUp } from '@element-plus/icons-vue'

const store = useSkillsStore()
const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  skillName: string
  defaultTargetDir: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  installed: []
}>()

const visible = ref(props.modelValue)
const loading = ref(false)
const form = reactive({
  mode: 'symlink' as 'symlink' | 'copy',
  targetDir: props.defaultTargetDir,
})

// Tree state
const showTree = ref(false)
const treeLoading = ref(false)
const treeData = ref<any[]>([])
const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: 'isLeaf',
  disabled: 'disabled',
}

watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:modelValue', v) })

function reset() {
  form.mode = 'symlink'
  form.targetDir = props.defaultTargetDir
  showTree.value = false
  treeData.value = []
}

function toggleTree() {
  showTree.value = !showTree.value
  if (showTree.value && treeData.value.length === 0) {
    loadRoot()
  }
}

async function loadRoot() {
  treeLoading.value = true
  try {
    const r = await window.api.listDrives()
    if (r.success && r.data?.drives) {
      treeData.value = r.data.drives.map((d: { label: string; value: string; available: boolean }) => ({
        label: d.label,
        value: d.value,
        isLeaf: false,
        disabled: !d.available,
        children: [],
      }))
    }
  } catch { /* ignore */ } finally {
    treeLoading.value = false
  }
}

async function loadNode(node: any, resolve: (data: any[]) => void) {
  if (node.level === 0) {
    resolve(treeData.value)
    return
  }

  treeLoading.value = true
  try {
    const r = await window.api.listDirs(node.data.value)
    if (r.success && r.data) {
      const children = r.data.children.map((c: any) => ({
        label: c.label,
        value: c.value,
        isLeaf: false,
        children: [],
      }))
      resolve(children)
    } else {
      resolve([])
    }
  } catch {
    resolve([])
  } finally {
    treeLoading.value = false
  }
}

function onNodeClick(data: any) {
  if (data.disabled) return
  form.targetDir = data.value
}

async function handleInstall() {
  if (!props.skillName) return
  loading.value = true
  try {
    const result = await store.installSkillWithMode(
      props.skillName,
      '',
      form.mode,
      form.targetDir
    )
    if (result?.success) {
      ElMessage.success(t('message.skillInstalled', { name: props.skillName }))
      visible.value = false
      emit('installed')
    } else {
      ElMessage.error(result?.error || t('message.failed'))
    }
  } catch (e: any) {
    ElMessage.error(e.message || t('message.failed'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.install-dialog-content { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-weight: 600; font-size: 13px; color: #606266; }
.skill-name { color: #409eff; font-size: 14px; }
.mode-options { display: flex; flex-direction: column; gap: 10px; }
.mode-option { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.mode-option :deep(.el-radio) { margin-right: 0; }
.mode-desc { font-size: 12px; color: #909399; }
.copy-warning { margin-top: 4px; }
.dir-picker { display: flex; gap: 8px; align-items: center; }
.dir-picker .el-input { flex: 1; }

.dir-tree {
  margin-top: 8px;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  background: #fafbfc;
}

.dir-tree :deep(.el-tree-node__content) {
  border-radius: 4px;
  padding: 2px 4px;
  transition: background-color 0.15s;
}

.dir-tree :deep(.el-tree-node__content:hover) {
  background: #f0f5ff;
}

.dir-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #ecf5ff;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.tree-icon {
  color: #e6a23c;
  flex-shrink: 0;
}

.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #303133;
}

.dir-tree :deep(.el-tree-node.is-disabled > .el-tree-node__content) {
  cursor: not-allowed;
  opacity: 0.5;
}

.dir-tree :deep(.el-tree-node.is-disabled > .el-tree-node__content:hover) {
  background: transparent;
}
</style>
