<template>
  <div class="settings-view">
    <h2>{{ t('prompt.settingsTitle') }}</h2>

    <el-card shadow="never" class="settings-section">
      <el-form label-position="top">
        <el-form-item :label="t('prompt.apiToken')">
          <el-input
            v-model="store.apiToken"
            type="password"
            show-password
            :placeholder="t('prompt.apiTokenPlaceholder')"
            @change="updateApiToken"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="settings-section">
      <template #header>{{ t('prompt.dataManagement') }}</template>
      <div class="settings-actions">
        <el-button @click="store.exportData()">{{ t('prompt.exportAll') }}</el-button>
        <el-button @click="triggerImport">{{ t('prompt.importData') }}</el-button>
        <input ref="importFileInput" type="file" style="display:none" @change="handleImport" accept=".json" />
      </div>
    </el-card>

    <el-card shadow="never" class="settings-section">
      <template #header>{{ t('prompt.serverInfo') }}</template>
      <p>{{ t('prompt.apiBase') }}: /api/v1</p>
      <p>
        {{ t('prompt.status') }}:
        <el-tag :type="store.serverStatus === 'online' ? 'success' : 'danger'">
          {{ store.serverStatus === 'online' ? t('prompt.online') : store.serverStatus === 'offline' ? t('prompt.offline') : t('prompt.error') }}
        </el-tag>
      </p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePromptStore } from '../../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()
const importFileInput = ref<HTMLInputElement | null>(null)

function updateApiToken() {
  // API token is managed via request headers
}

function triggerImport() {
  importFileInput.value?.click()
}

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  await store.importData(file)
}
</script>

<style scoped>
.settings-view { max-width: 600px; }
.settings-section { margin-bottom: 16px; }
.settings-actions { display: flex; gap: 8px; }
</style>
