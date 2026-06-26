// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
<template>
  <div class="status-bar">
    <el-card shadow="never">
      <template #header><div class="status-header"><span>Marketplace Status</span></div></template>
      <div class="status-items">
        <div class="status-item">
          <span class="label">Cache:</span>
          <el-tag :type="store.hasCache ? 'success' : 'danger'" size="small">{{ store.hasCache ? 'Valid' : 'Missing' }}</el-tag>
        </div>
        <div class="status-item">
          <span class="label">Location:</span>
          <span class="value">{{ store.cacheStatus?.cacheDir || 'N/A' }}</span>
        </div>
        <div class="status-item">
          <span class="label">Last Sync:</span>
          <span class="value">{{ store.cacheStatus?.lastSync ? formatDate(store.cacheStatus.lastSync) : 'Never' }}</span>
        </div>
        <div class="status-item">
          <span class="label">Version:</span>
          <span class="value">v{{ version }}</span>
        </div>
      </div>
      <div class="status-actions">
        <el-button v-if="!store.hasCache" type="primary" @click="handleInit" :loading="store.loading">Initialize</el-button>
        <el-button v-else @click="handleUpdate" :loading="store.loading">Update Now</el-button>
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'

const store = useSkillsStore()
const version = '0.0.0'

async function handleInit() {
  const res = await store.initMarketplace()
  if (res.success) ElMessage.success('Marketplace cache initialized')
  else ElMessage.error(res.error || 'Failed to initialize')
}

async function handleUpdate() {
  const res = await store.updateMarketplace()
  if (res.success) ElMessage.success('Marketplace updated')
  else ElMessage.error(res.error || 'Failed to update')
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}
// [AGC:END]
</script>
<style scoped>
.status-bar { height: 100%; padding: 16px; background: #f5f7fa; overflow-y: auto; }
.status-header { font-weight: 500; font-size: 15px; }
.status-items { display: flex; flex-direction: column; gap: 12px; }
.status-item { display: flex; align-items: center; gap: 8px; }
.label { font-weight: 500; width: 80px; color: #666; }
.value { color: #333; font-size: 14px; }
.status-actions { margin-top: 16px; }
</style>
