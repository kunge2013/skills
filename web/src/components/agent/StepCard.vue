<template>
  <div class="step-card" :class="step.status">
    <div class="step-header">
      <span class="step-title">{{ step.title }}</span>
      <span class="step-status">{{ statusLabel }}</span>
    </div>
    <div class="step-desc">{{ step.description }}</div>
    <div class="step-actions">
      <el-button
        v-if="step.status === 'pending'"
        size="small"
        type="primary"
        @click="$emit('run')"
      >&#9654;</el-button>
      <el-tag v-if="step.status === 'running'" type="warning" size="small">{{ $t('agent.running') }}</el-tag>
      <el-tag v-if="step.status === 'done'" type="success" size="small">{{ $t('agent.done') }}</el-tag>
      <el-tag v-if="step.status === 'failed'" type="danger" size="small">{{ $t('agent.failed') }}</el-tag>
      <el-tag v-if="step.status === 'waiting_user'" type="info" size="small">{{ $t('agent.waitingUser') }}</el-tag>
    </div>
    <StepOutput v-if="step.status !== 'pending'" :step-id="step.id" :output="output ?? ''" :error="step.error" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Step } from '../../types/agent'
import StepOutput from './StepOutput.vue'

const { t } = useI18n()
const props = defineProps<{ step: Step; output?: string }>()
defineEmits<{ run: [] }>()

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: t('agent.pending'),
    running: t('agent.running'),
    done: t('agent.done'),
    failed: t('agent.failed'),
    waiting_user: t('agent.waitingUser'),
  }
  return labels[props.step.status] || props.step.status
})
</script>

<style scoped>
.step-card { border: 1px solid #e4e7ed; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.step-card.pending { border-left: 3px solid #909399; }
.step-card.running { border-left: 3px solid #e6a23c; }
.step-card.done { border-left: 3px solid #67c23a; }
.step-card.failed { border-left: 3px solid #f56c6c; }
.step-card.waiting_user { border-left: 3px solid #409eff; }
.step-header { display: flex; justify-content: space-between; align-items: center; }
.step-title { font-weight: 600; }
.step-status { font-size: 12px; color: #909399; }
.step-desc { font-size: 13px; color: #606266; margin: 4px 0 8px; }
.step-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
</style>
