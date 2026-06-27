<template>
  <div class="status-bar">
    <el-card shadow="never">
      <template #header><span>Marketplace Status</span></template>
      <div class="status-items">
        <div class="status-item"><span class="label">Cache:</span><el-tag :type="store.hasCache ? 'success' : 'danger'" size="small">{{ store.hasCache ? 'Valid' : 'Missing' }}</el-tag></div>
        <div class="status-item"><span class="label">Location:</span><span class="value">{{ store.cacheStatus?.cacheDir || 'N/A' }}</span></div>
        <div class="status-item"><span class="label">Last Sync:</span><span class="value">{{ store.cacheStatus?.lastSync ? new Date(store.cacheStatus.lastSync).toLocaleString() : 'Never' }}</span></div>
        <div class="status-item"><span class="label">Version:</span><span class="value">v0.8.0</span></div>
      </div>
      <div class="status-actions">
        <el-button v-if="!store.hasCache" type="primary" @click="handleInit" :loading="store.loading">Initialize</el-button>
        <el-button v-else @click="handleUpdate" :loading="store.loading">Update Now</el-button>
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
const store = useSkillsStore()
async function handleInit() { const r = await store.initMarketplace(); if (r.success) ElMessage.success('Initialized'); else ElMessage.error(r.error || 'Failed') }
async function handleUpdate() { const r = await store.updateMarketplace(); if (r.success) ElMessage.success('Updated'); else ElMessage.error(r.error || 'Failed') }
</script>
<style scoped>
.status-bar { height: 100%; padding: 16px; background: #f5f7fa; overflow-y: auto; }
.status-items { display: flex; flex-direction: column; gap: 12px; }
.status-item { display: flex; align-items: center; gap: 8px; }
.label { font-weight: 500; width: 80px; color: #666; }
.value { color: #333; font-size: 14px; }
.status-actions { margin-top: 16px; }
</style>
