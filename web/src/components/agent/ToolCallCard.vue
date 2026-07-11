<template>
  <div class="tool-call-card" :class="`tool-call--${toolCall.status}`">
    <div class="tool-call-header">
      <el-icon v-if="toolCall.status === 'running'" class="is-loading icon-running">
        <Loading />
      </el-icon>
      <el-icon v-else-if="toolCall.status === 'complete'" class="icon-complete">
        <CircleCheck />
      </el-icon>
      <el-icon v-else class="icon-error">
        <CircleClose />
      </el-icon>
      <span class="tool-call-name">{{ toolCall.toolName }}</span>
      <span class="status-label" :class="`status-label--${toolCall.status}`">{{ $t(statusLabel) }}</span>
    </div>
    <el-collapse v-model="activeNames" class="tool-call-details">
      <el-collapse-item :title="$t('agent.toolArgs')" name="args">
        <pre class="tool-call-json">{{ JSON.stringify(toolCall.args, null, 2) }}</pre>
      </el-collapse-item>
      <el-collapse-item v-if="toolCall.result" :title="$t('agent.toolResult')" name="result">
        <pre class="tool-call-output">{{ toolCall.result }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Loading, CircleCheck, CircleClose } from '@element-plus/icons-vue'

const props = defineProps<{
  toolCall: {
    toolName: string
    args: Record<string, unknown>
    result: string | null
    status: 'running' | 'complete' | 'error'
  }
}>()
const activeNames = ref<string[]>([])

const statusLabel = computed(() => {
  const keys: Record<string, string> = {
    running: 'agent.toolRunning',
    complete: 'agent.toolComplete',
    error: 'agent.toolFailed',
  }
  return props.toolCall.status in keys
    ? keys[props.toolCall.status]
    : 'agent.toolRunning'
})
</script>

<style scoped>
.tool-call-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 14px;
  margin: 6px 0;
  animation: tool-call-in 150ms ease-out;
}

@keyframes tool-call-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-running { color: #f59e0b; }
.icon-complete { color: #22c55e; }
.icon-error { color: #ef4444; }

.tool-call-name {
  font-weight: 600;
  font-family: monospace;
  font-size: 13px;
}

.status-label {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 500;
  line-height: 1.4;
}

.status-label--running {
  background: #fef3c7;
  color: #92400e;
}

.status-label--complete {
  background: #dcfce7;
  color: #166534;
}

.status-label--error {
  background: #fee2e2;
  color: #991b1b;
}

.tool-call-details { margin-top: 6px; }

.tool-call-json {
  background: #f9fafb;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  max-height: 200px;
  overflow: auto;
  margin: 0;
}

.tool-call-output {
  background: #f9fafb;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  margin: 0;
}
</style>
