<!-- [AGC:FILE] tool=Cc author=fangkun -->
<template>
  <div class="skill-toggle">
    <!-- Header -->
    <div class="toggle-header">
      <div class="title-wrap">
        <h3>{{ $t('toggle.title') }}</h3>
        <span v-if="state" class="summary">
          {{ $t('toggle.enabledCount', { enabled: enabledCount, total: totalCount }) }}
        </span>
      </div>
      <div class="header-actions">
        <el-tooltip :content="$t('toggle.refresh')" placement="top">
          <el-button size="small" :icon="Refresh" circle @click="loadState" />
        </el-tooltip>
        <el-tooltip :content="$t('toggle.addSource')" placement="top">
          <el-button size="small" :icon="Plus" circle @click="showAddSourceDialog = true" />
        </el-tooltip>
      </div>
    </div>

    <!-- Provider Tabs -->
    <div class="provider-tabs">
      <el-radio-group v-model="currentProvider" size="small">
        <el-radio-button
          v-for="p in providers"
          :key="p.name"
          :value="p.name"
        >
          {{ p.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div class="toggle-hint">{{ $t('toggle.hint') }}</div>

    <!-- External Sources -->
    <div v-if="externalSources.length > 0" class="sources-section">
      <div class="section-title">{{ $t('toggle.externalSources') }}</div>
      <div v-for="source in externalSources" :key="`${source.owner}/${source.repo}`" class="source-item">
        <span class="source-name">{{ source.owner }}/{{ source.repo }}</span>
        <el-tag size="small" :type="source.cached ? 'success' : 'info'">
          {{ source.cached ? $t('toggle.cached') : $t('toggle.notCached') }}
        </el-tag>
        <el-tag
          v-for="p in (source.providers || ['claude-code', 'pi-agent', 'codex'])"
          :key="p"
          size="small"
          type="warning"
          effect="plain"
        >
          {{ p === 'claude-code' ? 'CC' : p === 'pi-agent' ? 'PI' : 'CX' }}
        </el-tag>
        <el-button size="small" text type="primary" @click="syncSource(source)">
          {{ $t('toggle.sync') }}
        </el-button>
        <el-button size="small" text type="warning" @click="openEditSourceDialog(source)">
          {{ $t('toggle.edit') }}
        </el-button>
        <el-button size="small" text type="danger" @click="removeSource(source)">
          {{ $t('toggle.remove') }}
        </el-button>
      </div>
    </div>

    <!-- Git Proxy Configuration -->
    <div class="proxy-section">
      <div class="section-title">
        {{ $t('toggle.gitProxy') }}
        <el-button size="small" text type="primary" @click="openProxyDialog">
          {{ $t('toggle.configure') }}
        </el-button>
      </div>
      <div class="proxy-status">
        <el-tag size="small" :type="proxyConfig.enabled ? 'success' : 'info'">
          {{ proxyConfig.enabled ? $t('toggle.enabled') : $t('toggle.disabled') }}
        </el-tag>
        <span v-if="proxyConfig.enabled && proxyConfig.url" class="proxy-url">
          {{ proxyConfig.url }}
        </span>
        <span v-else class="proxy-url proxy-disabled">{{ $t('toggle.noProxy') }}</span>
      </div>
    </div>

    <!-- User skills directory -->
    <div v-if="state" class="scope-info">
      <div class="scope-line">
        <el-tag size="small" type="warning">{{ $t('toggle.user') }}</el-tag>
        <span class="scope-dir" :title="userDir">{{ userDir }}</span>
      </div>
    </div>

    <!-- Owner -> Project -> Skills tree -->
    <div class="tree-wrap" v-loading="loading">
      <el-tree
        ref="treeRef"
        :data="treeData"
        show-checkbox
        node-key="key"
        :key="treeKey"
        :default-expanded-keys="defaultExpandedKeys"
        :default-checked-keys="defaultCheckedKeys"
        :props="{ label: 'label', children: 'children' }"
        @check="onCheck"
      >
        <template #default="{ data }">
          <span class="node-content">
            <el-icon class="node-icon">
              <User v-if="data.type === 'owner'" />
              <Folder v-else-if="data.type === 'project'" />
              <Document v-else />
            </el-icon>
            <span class="node-label" :class="{ 'skill-disabled': data.type === 'skill' && !data.enabled }">
              {{ data.label }}
            </span>
            <el-tag
              v-if="data.type === 'skill' && modeLabel(data.installMode)"
              size="small"
              type="info"
              effect="plain"
            >
              {{ modeLabel(data.installMode) }}
            </el-tag>
            <span
              v-if="data.type === 'skill' && data.description"
              class="node-desc"
              :title="data.description"
            >
              {{ data.description }}
            </span>
          </span>
        </template>
      </el-tree>
      <div v-if="!loading && treeData.length === 0" class="empty">
        {{ $t('toggle.empty') }}
      </div>
    </div>

    <!-- Add Source Dialog -->
    <el-dialog v-model="showAddSourceDialog" :title="$t('toggle.addSource')" width="500px">
      <el-form :model="addSourceForm" label-width="100px">
        <el-form-item :label="$t('toggle.sourceUrl')">
          <el-input v-model="addSourceForm.source" placeholder="owner/repo" />
        </el-form-item>
        <el-form-item :label="$t('toggle.branch')">
          <el-input v-model="addSourceForm.branch" placeholder="main" />
        </el-form-item>
        <el-form-item label="Providers">
          <el-checkbox-group v-model="addSourceForm.providers">
            <el-checkbox
              v-for="p in providers"
              :key="p.name"
              :value="p.name"
              :label="p.label"
            />
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddSourceDialog = false">{{ $t('toggle.cancel') }}</el-button>
        <el-button type="primary" :loading="addingSource" @click="handleAddSource">
          {{ $t('toggle.add') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Edit Source Dialog -->
    <el-dialog v-model="showEditSourceDialog" :title="$t('toggle.editSource')" width="500px">
      <el-form :model="editSourceForm" label-width="100px">
        <el-form-item :label="$t('toggle.sourceUrl')">
          <el-input :model-value="`${editSourceForm.owner}/${editSourceForm.repo}`" disabled />
        </el-form-item>
        <el-form-item :label="$t('toggle.branch')">
          <el-input v-model="editSourceForm.branch" placeholder="main" />
        </el-form-item>
        <el-form-item label="Providers">
          <el-checkbox-group v-model="editSourceForm.providers">
            <el-checkbox
              v-for="p in providers"
              :key="p.name"
              :value="p.name"
              :label="p.label"
            />
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditSourceDialog = false">{{ $t('toggle.cancel') }}</el-button>
        <el-button type="primary" :loading="editingSource" @click="handleEditSource">
          {{ $t('toggle.save') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Git Proxy Dialog -->
    <el-dialog v-model="showProxyDialog" :title="$t('toggle.gitProxy')" width="500px">
      <el-form :model="proxyForm" label-width="120px">
        <el-form-item :label="$t('toggle.enableProxy')">
          <el-switch v-model="proxyForm.enabled" />
        </el-form-item>
        <el-form-item :label="$t('toggle.proxyUrl')">
          <el-input
            v-model="proxyForm.url"
            placeholder="http://127.0.0.1:7890"
            :disabled="!proxyForm.enabled"
          />
        </el-form-item>
        <div class="proxy-hint">{{ $t('toggle.proxyHint') }}</div>
      </el-form>
      <template #footer>
        <el-button @click="showProxyDialog = false">{{ $t('toggle.cancel') }}</el-button>
        <el-button type="primary" :loading="savingProxy" @click="handleSaveProxy">
          {{ $t('toggle.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { TreeInstance } from 'element-plus'
import { Refresh, User, Document, Folder, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'

// [AGC:START] tool=Cc author=fangkun
interface ToggleSkillEntry {
  skillName: string
  enabled: boolean
  path: string
  skillsDir: string
  installMode: string
  author: string
  description: string
  isExternal: boolean
  owner: string
  projectPath: string
}

interface ToggleProject {
  projectPath: string
  total: number
  enabledCount: number
  skills: ToggleSkillEntry[]
}

interface ToggleGroup {
  owner: string
  total: number
  enabledCount: number
  projects: ToggleProject[]
}

interface ToggleState {
  userSkillsDir: string
  exists: boolean
  groups: ToggleGroup[]
}

interface ExternalSource {
  owner: string
  repo: string
  url: string
  branch: string
  providers: string[]
  cached: boolean
  cacheDir: string
}

type ProviderName = 'claude-code' | 'pi-agent' | 'codex'

interface TreeNodeData {
  key: string
  label: string
  type: 'owner' | 'project' | 'skill'
  owner?: string
  projectPath?: string
  skillName?: string
  enabled?: boolean
  installMode?: string
  description?: string
  path?: string
  children?: TreeNodeData[]
}

const { t } = useI18n()
const loading = ref(false)
const busy = ref(false)
const state = ref<ToggleState | null>(null)
const treeData = ref<TreeNodeData[]>([])
const treeRef = ref<TreeInstance>()
const treeKey = ref(0)

// Provider state
const currentProvider = ref<ProviderName>('claude-code')
const providers: { name: ProviderName; label: string }[] = [
  { name: 'claude-code', label: 'Claude Code' },
  { name: 'pi-agent', label: 'Pi Agent' },
  { name: 'codex', label: 'Codex' }
]

// Default expand only owner level
const defaultExpandedKeys = computed(() =>
  (state.value?.groups || []).map(g => `owner:${g.owner}`))

// Default checked keys for enabled skills (applied on render via :key)
const defaultCheckedKeys = computed(() =>
  (state.value?.groups || []).flatMap(g =>
    (g.projects || []).flatMap(p =>
      (p.skills || []).filter(s => s.enabled).map(s => s.skillName)
    )
  ))
const externalSources = ref<ExternalSource[]>([])
const showAddSourceDialog = ref(false)
const addingSource = ref(false)
const addSourceForm = ref({ source: '', branch: 'main', providers: ['claude-code', 'pi-agent', 'codex'] as ProviderName[] })
const showEditSourceDialog = ref(false)
const editingSource = ref(false)
const editSourceForm = ref({ owner: '', repo: '', branch: 'main', providers: ['claude-code', 'pi-agent', 'codex'] as ProviderName[] })
const showProxyDialog = ref(false)
const savingProxy = ref(false)
const proxyConfig = ref({ enabled: false, url: '' })
const proxyForm = ref({ enabled: false, url: '' })

const enabledCount = computed(
  () => state.value?.groups.reduce((n, g) => n + g.enabledCount, 0) ?? 0
)
const totalCount = computed(() => state.value?.groups.reduce((n, g) => n + g.total, 0) ?? 0)
const userDir = computed(() => state.value?.userSkillsDir ?? '')

// Watch provider change to reload state
watch(currentProvider, () => {
  loadState()
})

async function loadState() {
  loading.value = true
  try {
    const r = await window.api.listSkillToggleState(currentProvider.value)
    if (r.success && r.data) {
      const st = r.data as ToggleState
      state.value = st
      treeData.value = st.groups.map(g => ({
        key: `owner:${g.owner}`,
        label: `${g.owner} (${g.enabledCount}/${g.total})`,
        type: 'owner' as const,
        owner: g.owner,
        children: (g.projects || []).map(proj => ({
          key: `project:${g.owner}:${proj.projectPath}`,
          label: proj.projectPath ? `${proj.projectPath} (${proj.enabledCount}/${proj.total})` : `${t('toggle.local')} (${proj.enabledCount}/${proj.total})`,
          type: 'project' as const,
          owner: g.owner,
          projectPath: proj.projectPath,
          children: (proj.skills || []).map(s => ({
            key: `skill:${s.skillName}`,
            label: s.skillName,
            type: 'skill' as const,
            owner: g.owner,
            skillName: s.skillName,
            enabled: s.enabled,
            installMode: s.installMode,
            description: s.description,
            path: s.path,
          })),
        })),
      }))
      treeKey.value++ // Force tree re-render to apply default-expanded-keys and default-checked-keys
    } else {
      ElMessage.error(r.error || t('toggle.updateFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('toggle.updateFailed'))
  } finally {
    loading.value = false
  }
}

async function loadExternalSources() {
  try {
    const r = await window.api.listExternalSources()
    if (r.success && r.data) {
      externalSources.value = r.data as ExternalSource[]
    }
  } catch {
    // Silent fail
  }
}

async function loadProxyConfig() {
  try {
    const r = await window.api.getGitProxy()
    if (r.success && r.data) {
      proxyConfig.value = r.data as { enabled: boolean; url: string }
    }
  } catch {
    // Silent fail
  }
}

function openProxyDialog() {
  proxyForm.value = { ...proxyConfig.value }
  showProxyDialog.value = true
}

async function handleSaveProxy() {
  savingProxy.value = true
  try {
    const r = await window.api.setGitProxy(proxyForm.value.enabled, proxyForm.value.url)
    if (r.success) {
      proxyConfig.value = { ...proxyForm.value }
      showProxyDialog.value = false
      ElMessage.success(t('toggle.proxySaved'))
    } else {
      ElMessage.error(r.error || t('toggle.proxySaveFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('toggle.proxySaveFailed'))
  } finally {
    savingProxy.value = false
  }
}

/**
 * Checkbox handler.
 * - Owner node -> batch enable/disable all skills of that owner
 * - Project node -> batch enable/disable all skills in that project
 * - Skill node -> single enable/disable
 */
async function onCheck(data: any, checkState: { checkedKeys: (string | number)[] }) {
  if (busy.value || !data) return
  busy.value = true
  try {
    const checked = checkState.checkedKeys.includes(data.key)

    if (data.type === 'owner') {
      const r = await window.api.setOwnerSkillsEnabled(data.owner, checked, currentProvider.value)
      if (!r.success) {
        ElMessage.error(r.error || t('toggle.updateFailed'))
      } else if (r.data?.changed) {
        ElMessage.success(t('toggle.batchSuccess', { count: r.data.changed }))
      }
    } else if (data.type === 'project') {
      const r = await window.api.setProjectSkillsEnabled(data.owner, data.projectPath, checked, currentProvider.value)
      if (!r.success) {
        ElMessage.error(r.error || t('toggle.updateFailed'))
      } else if (r.data?.changed) {
        ElMessage.success(t('toggle.batchSuccess', { count: r.data.changed }))
      }
    } else if (data.type === 'skill') {
      const r = await window.api.setSkillEnabled(data.skillName, checked, currentProvider.value)
      if (!r.success) {
        ElMessage.error(r.error || t('toggle.updateFailed'))
      }
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('toggle.updateFailed'))
  } finally {
    busy.value = false
    await loadState()
  }
}

async function handleAddSource() {
  if (!addSourceForm.value.source) {
    ElMessage.warning(t('toggle.sourceRequired'))
    return
  }
  if (!addSourceForm.value.providers || addSourceForm.value.providers.length === 0) {
    ElMessage.warning('Please select at least one provider')
    return
  }
  addingSource.value = true
  try {
    const r = await window.api.addExternalSource(addSourceForm.value.source, addSourceForm.value.branch, addSourceForm.value.providers)
    if (r.success) {
      ElMessage.success(t('toggle.sourceAdded'))
      showAddSourceDialog.value = false
      addSourceForm.value = { source: '', branch: 'main', providers: ['claude-code', 'pi-agent', 'codex'] }
      await loadExternalSources()
      await loadState()
    } else {
      ElMessage.error(r.error || t('toggle.addFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('toggle.addFailed'))
  } finally {
    addingSource.value = false
  }
}

function openEditSourceDialog(source: ExternalSource) {
  editSourceForm.value = {
    owner: source.owner,
    repo: source.repo,
    branch: source.branch || 'main',
    providers: (source.providers || ['claude-code', 'pi-agent', 'codex']) as ProviderName[]
  }
  showEditSourceDialog.value = true
}

async function handleEditSource() {
  if (!editSourceForm.value.providers || editSourceForm.value.providers.length === 0) {
    ElMessage.warning('Please select at least one provider')
    return
  }
  editingSource.value = true
  try {
    const r = await window.api.updateExternalSource(editSourceForm.value.owner, editSourceForm.value.repo, {
      providers: editSourceForm.value.providers,
      branch: editSourceForm.value.branch
    })
    if (r.success) {
      ElMessage.success(t('toggle.sourceUpdated'))
      showEditSourceDialog.value = false
      await loadExternalSources()
      await loadState()
    } else {
      ElMessage.error(r.error || t('toggle.updateFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('toggle.updateFailed'))
  } finally {
    editingSource.value = false
  }
}

async function syncSource(source: ExternalSource) {
  try {
    const r = await window.api.syncExternalSource(source.owner, source.repo)
    if (r.success) {
      ElMessage.success(t('toggle.synced'))
      await loadExternalSources()
      await loadState()
    } else {
      ElMessage.error(r.error || t('toggle.syncFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('toggle.syncFailed'))
  }
}

async function removeSource(source: ExternalSource) {
  try {
    await ElMessageBox.confirm(
      t('toggle.confirmRemoveSource', { source: `${source.owner}/${source.repo}` }),
      t('toggle.confirm'),
      { type: 'warning' }
    )
    const r = await window.api.removeExternalSource(source.owner, source.repo)
    if (r.success) {
      ElMessage.success(t('toggle.sourceRemoved'))
      await loadExternalSources()
      await loadState()
    } else {
      ElMessage.error(r.error || t('toggle.removeFailed'))
    }
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || t('toggle.removeFailed'))
    }
  }
}

function modeLabel(mode?: string): string {
  if (mode === 'symlink') return t('toggle.symlink')
  if (mode === 'copy') return t('toggle.copy')
  if (mode === 'manual') return t('toggle.manual')
  if (mode === 'external') return t('toggle.external')
  return ''
}

onMounted(() => {
  loadState()
  loadExternalSources()
  loadProxyConfig()
})
// [AGC:END]
</script>

<style scoped>
.skill-toggle {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.toggle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.title-wrap {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.title-wrap h3 {
  margin: 0;
  font-size: 16px;
}

.summary {
  font-size: 12px;
  color: #909399;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.provider-tabs {
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #e4e7ed;
}

.toggle-hint {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.sources-section {
  margin-bottom: 12px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 8px;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.source-name {
  font-size: 13px;
  color: #303133;
}

.proxy-section {
  margin-bottom: 12px;
  padding: 8px;
  background: #f0f9eb;
  border-radius: 4px;
}

.proxy-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.proxy-url {
  font-size: 12px;
  color: #606266;
}

.proxy-url.proxy-disabled {
  color: #909399;
}

.proxy-hint {
  font-size: 12px;
  color: #909399;
  padding: 8px 12px;
  margin-top: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.scope-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.scope-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scope-dir {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.tree-wrap {
  flex: 1;
  overflow: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.node-icon {
  flex-shrink: 0;
}

.node-label {
  white-space: nowrap;
}

.node-label.skill-disabled {
  color: #c0c4cc;
  text-decoration: line-through;
}

.node-desc {
  font-size: 12px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.empty {
  text-align: center;
  color: #909399;
  padding: 32px 0;
}
</style>
