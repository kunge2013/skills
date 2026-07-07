<template>
  <div class="workspace">
    <el-row :gutter="16" class="full-height">
      <el-col :xs="24" :md="12" class="input-col">
        <el-card shadow="never" class="input-card">
          <template #header>
            <span>{{ t('prompt.originalPrompt') }}</span>
          </template>
          <el-input
            v-model="store.optimizeInput"
            type="textarea"
            :rows="10"
            :placeholder="t('prompt.originalPlaceholder')"
            resize="vertical"
          />
          <div class="actions">
            <el-button
              type="primary"
              :disabled="!store.canOptimize || store.optimizing"
              :loading="store.optimizing"
              @click="store.handleOptimize()"
            >
              {{ store.optimizing ? t('prompt.optimizing') : t('prompt.optimize') }}
            </el-button>
            <el-button
              type="success"
              :disabled="!store.canOptimize || store.optimizing"
              :loading="store.optimizing"
              @click="store.handleOptimizeStream()"
            >
              {{ store.optimizing ? t('prompt.optimizing') : t('prompt.optimizeStream') }}
            </el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12" class="output-col">
        <el-card shadow="never" class="output-card">
          <template #header>
            <span>{{ t('prompt.optimizedResult') }}</span>
          </template>
          <div class="output-display">
            <pre v-if="store.optimizeOutput">{{ store.optimizeOutput }}</pre>
            <span v-else class="placeholder">{{ t('prompt.resultPlaceholder') }}</span>
          </div>
          <el-alert v-if="store.optimizeError" type="error" :title="store.optimizeError" show-icon closable />
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
.input-card, .output-card { height: 100%; }
.output-display {
  background: var(--el-fill-color-light);
  border-radius: 4px;
  padding: 16px;
  min-height: 200px;
  white-space: pre-wrap;
  word-break: break-word;
}
.output-display pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  margin: 0;
}
.placeholder { color: var(--el-text-color-placeholder); }
.actions { margin-top: 12px; display: flex; gap: 8px; }
</style>
