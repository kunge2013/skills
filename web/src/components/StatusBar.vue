<template>
  <div class="status-bar">
    <el-card shadow="never">
      <template #header><span>{{ $t('status.title') }}</span></template>
      <div class="status-items">
        <div class="status-item"><span class="label">{{ $t('status.cache') }}</span><el-tag :type="store.hasCache ? 'success' : 'danger'" size="small">{{ store.hasCache ? $t('status.valid') : $t('status.missing') }}</el-tag></div>
        <div class="status-item"><span class="label">{{ $t('status.location') }}</span><span class="value">{{ store.cacheStatus?.cacheDir || $t('status.na') }}</span></div>
        <div class="status-item"><span class="label">{{ $t('status.lastSync') }}</span><span class="value">{{ store.cacheStatus?.lastSync ? new Date(store.cacheStatus.lastSync).toLocaleString() : $t('status.never') }}</span></div>
        <div class="status-item"><span class="label">{{ $t('status.version') }}</span><span class="value">v{{ version }}</span></div>
      </div>
      <div class="status-actions">
        <el-button v-if="!store.hasCache" type="primary" @click="handleInit" :loading="store.loading">{{ $t('status.initialize') }}</el-button>
        <el-button v-else @click="handleUpdate" :loading="store.loading">{{ $t('status.updateNow') }}</el-button>
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
const store = useSkillsStore()
const { t } = useI18n()
const version = __APP_VERSION__
async function handleInit() { const r = await store.initMarketplace(); if (r.success) ElMessage.success(t('message.initialized')); else ElMessage.error(t('message.failed')) }
async function handleUpdate() { const r = await store.updateMarketplace(); if (r.success) ElMessage.success(t('message.updated')); else ElMessage.error(t('message.failed')) }
</script>
<style scoped>
.status-bar { height: 100%; padding: 16px; background: #f5f7fa; overflow-y: auto; }
.status-items { display: flex; flex-direction: column; gap: 12px; }
.status-item { display: flex; align-items: center; gap: 8px; }
.label { font-weight: 500; width: 80px; color: #666; }
.value { color: #333; font-size: 14px; }
.status-actions { margin-top: 16px; }
</style>
