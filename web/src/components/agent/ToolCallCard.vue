<template>
  <div class="tool-call-card" :class="toolCall.status">
    <div class="tool-call-header">
      <el-icon v-if="toolCall.status === 'running'" class="is-loading">
        <Loading />
      </el-icon>
      <el-icon v-else-if="toolCall.status === 'complete'" color="#67c23a">
        <CircleCheck />
      </el-icon>
      <el-icon v-else color="#f56c6c">
        <CircleClose />
      </el-icon>
      <span class="tool-call-name">{{ toolCall.toolName }}</span>
      <el-tag size="small" :type="statusTagType">
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
  props.toolCall.status === 'complete' ? 'agent.done' : props.toolCall.status === 'error' ? 'agent.failed' : 'agent.running'
)
</script>

<style scoped>
.tool-call-card { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 8px 12px; margin: 4px 0; }
.tool-call-header { display: flex; align-items: center; gap: 6px; }
.tool-call-name { font-weight: 600; font-family: monospace; }
.tool-call-details { margin-top: 4px; }
.tool-call-json { background: var(--el-fill-color-light); padding: 8px; border-radius: 4px; font-size: 12px; max-height: 200px; overflow: auto; margin: 0; }
.tool-call-output { background: var(--el-fill-color-light); padding: 8px; border-radius: 4px; font-size: 12px; max-height: 300px; overflow: auto; white-space: pre-wrap; margin: 0; }
</style>
