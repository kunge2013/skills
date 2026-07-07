<template>
  <div class="workspace">
    <el-row :gutter="16" class="full-height">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header><span>{{ t('prompt.iterateInput') }}</span></template>
          <el-input v-model="store.iterateOriginal" type="textarea" :rows="3" :placeholder="t('prompt.originalPlaceholder')" resize="vertical" />
          <el-input v-model="store.iterateLastOptimized" type="textarea" :rows="3" :placeholder="t('prompt.lastOptimizedPlaceholder')" resize="vertical" class="mt-2" />
          <el-input v-model="store.iterateInput" type="textarea" :rows="4" :placeholder="t('prompt.feedbackPlaceholder')" resize="vertical" class="mt-2" />
          <div class="actions">
            <el-button type="primary" :disabled="!store.canIterate || store.iterating" :loading="store.iterating" @click="store.handleIterate()">
              {{ store.iterating ? t('prompt.iterating') : t('prompt.iterate') }}
            </el-button>
            <el-button type="success" :disabled="!store.canIterate || store.iterating" :loading="store.iterating" @click="store.handleIterateStream()">
              {{ store.iterating ? t('prompt.iterating') : t('prompt.iterateStream') }}
            </el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header><span>{{ t('prompt.result') }}</span></template>
          <div class="output-display">
            <pre v-if="store.iterateOutput">{{ store.iterateOutput }}</pre>
            <span v-else class="placeholder">{{ t('prompt.resultPlaceholder') }}</span>
          </div>
          <el-alert v-if="store.iterateError" type="error" :title="store.iterateError" show-icon closable />
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
