<template>
  <div class="workspace">
    <el-row :gutter="16" class="full-height">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header><span>{{ t('prompt.testInput') }}</span></template>
          <el-input v-model="store.testSystemPrompt" type="textarea" :rows="4" :placeholder="t('prompt.systemPlaceholder')" resize="vertical" />
          <el-input v-model="store.testUserPrompt" type="textarea" :rows="6" :placeholder="t('prompt.userPlaceholder')" resize="vertical" class="mt-2" />
          <div class="actions">
            <el-button type="primary" :disabled="!store.canTest || store.testing" :loading="store.testing" @click="store.handleTest()">
              {{ store.testing ? t('prompt.testing') : t('prompt.test') }}
            </el-button>
            <el-button type="success" :disabled="!store.canTest || store.testing" :loading="store.testing" @click="store.handleTestStream()">
              {{ store.testing ? t('prompt.testing') : t('prompt.testStream') }}
            </el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header><span>{{ t('prompt.response') }}</span></template>
          <div class="output-display">
            <pre v-if="store.testOutput">{{ store.testOutput }}</pre>
            <span v-else class="placeholder">{{ t('prompt.responsePlaceholder') }}</span>
          </div>
          <el-alert v-if="store.testError" type="error" :title="store.testError" show-icon closable />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePromptStore } from '../../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()
</script>

<style scoped>
.workspace { padding: 0; }
.full-height { min-height: 500px; }
.mt-2 { margin-top: 8px; }
.output-display { background: var(--el-fill-color-light); border-radius: 4px; padding: 16px; min-height: 200px; white-space: pre-wrap; word-break: break-word; }
.output-display pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; margin: 0; }
.placeholder { color: var(--el-text-color-placeholder); }
.actions { margin-top: 12px; display: flex; gap: 8px; }
</style>
