<template>
  <div class="nav-sidebar">
    <div class="nav-header">
      <h2>KungeSkill</h2>
      <span class="version">v{{ version }}</span>
    </div>
    <el-menu :default-active="'list'" class="nav-menu" @select="() => store.clearSelection()">
      <el-menu-item index="list"><el-icon><Document /></el-icon><span>All Skills</span></el-menu-item>
    </el-menu>
    <div class="nav-footer">
      <div class="cache-status">
        <el-tag :type="store.hasCache ? 'success' : 'danger'" size="small">{{ store.hasCache ? 'Cache: OK' : 'Cache: Missing' }}</el-tag>
        <span class="last-sync" v-if="store.cacheStatus?.lastSync">Synced: {{ new Date(store.cacheStatus.lastSync).toLocaleString() }}</span>
      </div>
      <el-button v-if="!store.hasCache" type="primary" size="small" @click="handleInit" :loading="store.loading">Initialize</el-button>
      <el-button v-else type="info" size="small" @click="handleUpdate" :loading="store.loading">Update</el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
const store = useSkillsStore()
const version = __APP_VERSION__
async function handleInit() { const r = await store.initMarketplace(); if (r.success) ElMessage.success('Cache initialized'); else ElMessage.error(r.error || 'Failed') }
async function handleUpdate() { const r = await store.updateMarketplace(); if (r.success) ElMessage.success('Updated'); else ElMessage.error(r.error || 'Failed') }
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
