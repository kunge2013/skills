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
      <el-tag size="small" :type="statusTagType" round>
        {{ $t(statusLabelKey) }}
      </el-tag>
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

const statusTagType = computed(() =>
  props.toolCall.status === 'complete' ? 'success' : props.toolCall.status === 'error' ? 'danger' : 'warning'
)
const statusLabelKey = computed(() =>
  props.toolCall.status === 'complete' ? 'agent.toolComplete' : props.toolCall.status === 'error' ? 'agent.toolFailed' : 'agent.toolRunning'
)
</script>

<style scoped>
.tool-call-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 10px 14px;
  margin: 6px 0;
  border-left: 3px solid var(--el-color-warning);
  animation: tool-call-in 150ms ease-out;
}

@keyframes tool-call-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.tool-call--complete { border-left-color: var(--el-color-success); }
.tool-call--error { border-left-color: var(--el-color-danger); }

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-running { color: var(--el-color-warning); }
.icon-complete { color: var(--el-color-success); }
.icon-error { color: var(--el-color-danger); }

.tool-call-name {
  font-weight: 600;
  font-family: monospace;
  font-size: 13px;
}

.tool-call-details { margin-top: 6px; }

.tool-call-json {
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  max-height: 200px;
  overflow: auto;
  margin: 0;
}

.tool-call-output {
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  margin: 0;
}
</style>
