// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
<template>
  <div class="nav-sidebar">
    <div class="nav-header">
      <h2>KungeSkill Desktop</h2>
      <span class="version">v{{ version }}</span>
    </div>
    <el-menu :default-active="store.currentView" class="nav-menu" @select="handleSelect">
      <el-menu-item index="list">
        <el-icon><Document /></el-icon><span>All Skills</span>
      </el-menu-item>
    </el-menu>
    <div class="nav-footer">
      <div class="cache-status">
        <el-tag :type="store.hasCache ? 'success' : 'danger'" size="small">
          {{ store.hasCache ? 'Cache: OK' : 'Cache: Missing' }}
        </el-tag>
        <span class="last-sync" v-if="store.cacheStatus?.lastSync">
          Synced: {{ formatDate(store.cacheStatus.lastSync) }}
        </span>
      </div>
      <el-button v-if="!store.hasCache" type="primary" size="small" @click="handleInit" :loading="store.loading">
        Initialize Cache
      </el-button>
      <el-button v-else type="info" size="small" @click="handleUpdate" :loading="store.loading">
        Update
      </el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { Document } from '@element-plus/icons-vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'

const store = useSkillsStore()
const version = (window as any).__APP_VERSION__ || '0.0.0'

function handleSelect(key: string) {
  store.clearSelection()
}

async function handleInit() {
  const res = await store.initMarketplace()
  if (res.success) ElMessage.success('Cache initialized')
  else ElMessage.error(res.error || 'Failed to initialize cache')
}

async function handleUpdate() {
  const res = await store.updateMarketplace()
  if (res.success) ElMessage.success('Skills updated')
  else ElMessage.error(res.error || 'Failed to update')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString()
}
// [AGC:END]
</script>
<style scoped>
.nav-sidebar { width: 220px; height: 100%; background: #1a1a2e; color: #eee; display: flex; flex-direction: column; }
.nav-header { padding: 16px; border-bottom: 1px solid #333; }
.nav-header h2 { font-size: 16px; margin-bottom: 4px; }
.version { font-size: 12px; color: #888; }
.nav-menu { flex: 1; background: transparent; border: none; }
.nav-menu .el-menu-item { color: #ccc; }
.nav-menu .el-menu-item.is-active { background: #16213e; color: #409eff; }
.nav-footer { padding: 12px 16px; border-top: 1px solid #333; }
.cache-status { margin-bottom: 8px; }
.last-sync { font-size: 11px; color: #888; margin-left: 8px; }
</style>
