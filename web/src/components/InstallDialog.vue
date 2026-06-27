<template>
  <el-dialog
    v-model="visible"
    :title="$t('install.title')"
    width="520px"
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

      <!-- Target directory with tree picker -->
      <div class="field">
        <label>{{ $t('install.targetDirectory') }}</label>
        <div class="dir-picker">
          <el-input v-model="form.targetDir" :placeholder="$t('install.targetDirPlaceholder')" clearable />
          <el-button @click="browseDir('/')" :loading="treeLoading">{{ $t('install.browse') }}</el-button>
        </div>
        <!-- Directory tree -->
        <div v-if="showTree" class="dir-tree" v-loading="treeLoading">
          <el-tree
            :data="treeData"
            :props="treeProps"
            :load="loadNode"
            lazy
            node-key="value"
            highlight-current
            @current-change="onDirSelect"
          >
            <template #default="{ node, data }">
              <span class="tree-node">
                <el-icon><Folder /></el-icon>
                <span>{{ node.label }}</span>
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
import { Folder } from '@element-plus/icons-vue'

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

// Directory tree state
const showTree = ref(false)
const treeLoading = ref(false)
const treeData = ref<any[]>([])
const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: 'isLeaf',
}

watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:modelValue', v) })

function reset() {
  form.mode = 'symlink'
  form.targetDir = props.defaultTargetDir
  showTree.value = false
  treeData.value = []
}

async function browseDir(dirPath: string) {
  showTree.value = true
  treeLoading.value = true
  try {
    const r = await window.api.listDirs(dirPath)
    if (r.success && r.data) {
      treeData.value = r.data.children.map((c: any) => ({
        ...c,
        isLeaf: false,
      }))
    } else {
      ElMessage.error(r.error || 'Failed to load directories')
    }
  } catch (e: any) {
    ElMessage.error(e.message || 'Failed to load directories')
  } finally {
    treeLoading.value = false
  }
}

async function loadNode(node: any, resolve: (data: any[]) => void) {
  if (node.level === 0) {
    resolve([])
    return
  }
  treeLoading.value = true
  try {
    const r = await window.api.listDirs(node.data.value)
    if (r.success && r.data) {
      const children = r.data.children.map((c: any) => ({ ...c, isLeaf: false }))
      if (children.length === 0) {
        node.data.isLeaf = true
      }
      resolve(children)
    } else {
      node.data.isLeaf = true
      resolve([])
    }
  } catch {
    node.data.isLeaf = true
    resolve([])
  } finally {
    treeLoading.value = false
  }
}

function onDirSelect(data: any) {
  if (data && data.value) {
    form.targetDir = data.value
  }
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
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
  margin-top: 8px;
}
.tree-node { display: flex; align-items: center; gap: 4px; }
</style>
