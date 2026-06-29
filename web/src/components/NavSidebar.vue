<template>
  <div class="nav-sidebar">
    <div class="nav-header">
      <h2>{{ $t('nav.title') }}</h2>
      <span class="version">v{{ version }}</span>
    </div>
    <el-menu :default-active="activeMenu" class="nav-menu" @select="handleMenuSelect">
      <el-menu-item index="list"><el-icon><Document /></el-icon><span>{{ $t('nav.allSkills') }}</span></el-menu-item>
      <el-menu-item index="manage"><el-icon><FolderOpened /></el-icon><span>{{ $t('nav.skillManagement') }}</span></el-menu-item>
    </el-menu>
    <div class="nav-footer">
      <div class="cache-status">
        <el-tag :type="store.hasCache ? 'success' : 'danger'" size="small">{{ store.hasCache ? $t('nav.cacheValid') : $t('nav.cacheMissing') }}</el-tag>
        <span class="last-sync" v-if="store.cacheStatus?.lastSync">{{ $t('nav.synced') }} {{ new Date(store.cacheStatus.lastSync).toLocaleString() }}</span>
      </div>
      <div class="lang-switcher">
        <el-select v-model="currentLocale" size="small" @change="handleLocaleChange" class="locale-select">
          <el-option :label="$t('nav.langEn')" value="en" />
          <el-option :label="$t('nav.langZh')" value="zh-CN" />
        </el-select>
      </div>
      <el-button v-if="!store.hasCache" type="primary" size="small" @click="handleInit" :loading="store.loading">{{ $t('nav.initialize') }}</el-button>
      <el-button v-else type="info" size="small" @click="handleUpdate" :loading="store.loading">{{ $t('nav.update') }}</el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Document, FolderOpened } from '@element-plus/icons-vue'
import { useSkillsStore } from '../stores/skills'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import i18n, { setAppLocale, type SupportedLocale } from '../i18n'
const store = useSkillsStore()
const { t } = useI18n()
const version = __APP_VERSION__
const currentLocale = ref(i18n.global.locale.value as SupportedLocale)
const activeMenu = computed(() => store.currentView === 'manage' ? 'manage' : 'list')

function handleMenuSelect(index: string) {
  if (index === 'manage') {
    store.setView('manage')
  } else {
    store.clearSelection()
  }
}

async function handleInit() { const r = await store.initMarketplace(); if (r.success) ElMessage.success(t('message.cacheInitialized')); else ElMessage.error(t('message.failed')) }
async function handleUpdate() { const r = await store.updateMarketplace(); if (r.success) ElMessage.success(t('message.updated')); else ElMessage.error(t('message.failed')) }

function handleLocaleChange(val: string) {
  const locale = val as SupportedLocale
  setAppLocale(locale)
}
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
.lang-switcher { margin-bottom: 8px; }
.locale-select { width: 100%; }
</style>
