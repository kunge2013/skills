<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-08-16 -->
<template>
  <div class="skill-manager">
    <!-- Header -->
    <div class="manager-header">
      <div class="title-wrap">
        <h3>{{ $t('manager.title') }}</h3>
        <span v-if="sources" class="summary">
          {{ $t('manager.enabledCount', { enabled: enabledCount, total: totalCount }) }}
        </span>
      </div>
      <div class="header-actions">
        <el-tooltip :content="$t('manager.refresh')" placement="top">
          <el-button size="small" :icon="Refresh" circle @click="loadData" />
        </el-tooltip>
      </div>
    </div>
    <div class="manager-hint">{{ $t('manager.hint') }}</div>

    <!-- Tree -->
    <div class="tree-wrap" v-loading="loading">
      <el-tree
        v-if="treeData.length > 0"
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
              <Folder v-else-if="data.type === 'category'" />
              <Document v-else />
            </el-icon>
            <span class="node-label" :class="{ 'skill-disabled': data.type === 'skill' && !data.enabled }">
              {{ data.label }}
            </span>
          </span>
        </template>
      </el-tree>
      <div v-if="!loading && treeData.length === 0" class="empty">
        {{ $t('manager.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { TreeInstance } from 'element-plus'
import { Refresh, User, Document, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

interface Skill {
  name: string
  key: string
  enabled: boolean
  category: string
  owner: string
  repo: string
}

interface CategoryNode {
  name: string
  skills: Skill[]
}

interface ManagedSource {
  owner: string
  repo: string
  name: string
  totalSkills: number
  enabledCount: number
  categories: CategoryNode[]
}

interface TreeNode {
  key: string
  label: string
  type: 'owner' | 'category' | 'skill'
  owner?: string
  repo?: string
  category?: string
  skillName?: string
  enabled?: boolean
  children?: TreeNode[]
}

const { t } = useI18n()
const loading = ref(false)
const busy = ref(false)
const sources = ref<ManagedSource[]>([])
const treeData = ref<TreeNode[]>([])
const treeRef = ref<TreeInstance>()
const treeKey = ref(0)

const enabledCount = computed(() =>
  sources.value.reduce((sum, s) =>
    sum + s.categories.reduce((cs, c) => cs + c.skills.filter(sk => sk.enabled).length, 0), 0))

const totalCount = computed(() =>
  sources.value.reduce((sum, s) =>
    sum + s.categories.reduce((cs, c) => cs + c.skills.length, 0), 0))

// Default expand only owner level
const defaultExpandedKeys = computed(() =>
  sources.value.map(s => `owner:${s.owner}`))

// Default checked keys for enabled skills (used on initial render only)
const defaultCheckedKeys = computed(() =>
  sources.value.flatMap(s =>
    s.categories.flatMap(c =>
      c.skills.filter(sk => sk.enabled).map(sk => `skill:${sk.key}`)
    )
  ))

function buildTree(): TreeNode[] {
  return sources.value.map(source => {
    const ownerEnabled = source.categories.some(c => c.skills.some(s => s.enabled))
    return {
      key: `owner:${source.owner}`,
      label: `${source.owner}/${source.repo} (${source.categories.reduce((a, c) => a + c.skills.filter(s => s.enabled).length, 0)}/${source.totalSkills})`,
      type: 'owner' as const,
      owner: source.owner,
      repo: source.repo,
      children: source.categories.map(cat => ({
        key: `category:${source.owner}:${cat.name}`,
        label: `${formatCategoryName(cat.name)} (${cat.skills.filter(s => s.enabled).length}/${cat.skills.length})`,
        type: 'category' as const,
        owner: source.owner,
        repo: source.repo,
        category: cat.name,
        children: cat.skills.map(skill => ({
          key: `skill:${skill.key}`,
          label: skill.name,
          type: 'skill' as const,
          owner: source.owner,
          repo: source.repo,
          category: cat.name,
          skillName: skill.name,
          enabled: skill.enabled,
        })),
      })),
    }
  })
}

function formatCategoryName(name: string): string {
  if (name === '_root') return 'Root'
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

async function loadData() {
  loading.value = true
  try {
    const r = await window.api.listManagedSkills()
    if (r.success && r.data) {
      sources.value = r.data as ManagedSource[]
      treeData.value = buildTree()
      treeKey.value++ // Force tree re-render to apply default-expanded-keys and default-checked-keys
    } else {
      ElMessage.error(r.error || t('manager.loadFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('manager.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function onCheck(data: any, checkState: { checkedKeys: (string | number)[] }) {
  if (busy.value || !data) return
  busy.value = true
  try {
    const checked = checkState.checkedKeys.includes(data.key)

    if (data.type === 'skill') {
      // Toggle single skill
      const r = await window.api.toggleManagedSkill(data.owner, data.repo, data.category, data.skillName, checked)
      if (!r.success) {
        ElMessage.error(r.error || t('manager.toggleFailed'))
      }
    } else if (data.type === 'category') {
      // Toggle all skills in category
      const source = sources.value.find(s => s.owner === data.owner)
      if (!source) return
      const cat = source.categories.find(c => c.name === data.category)
      if (!cat) return
      for (const skill of cat.skills) {
        if (skill.enabled === checked) continue
        await window.api.toggleManagedSkill(data.owner, data.repo, data.category, skill.name, checked)
      }
    } else if (data.type === 'owner') {
      // Toggle all skills for this owner
      const source = sources.value.find(s => s.owner === data.owner)
      if (!source) return
      for (const cat of source.categories) {
        for (const skill of cat.skills) {
          if (skill.enabled === checked) continue
          await window.api.toggleManagedSkill(data.owner, data.repo, cat.name, skill.name, checked)
        }
      }
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('manager.toggleFailed'))
  } finally {
    busy.value = false
    await loadData()
  }
}

onMounted(loadData)
</script>

<style scoped>
.skill-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.manager-header {
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

.manager-hint {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
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

.empty {
  text-align: center;
  color: #909399;
  padding: 32px 0;
}
</style>
