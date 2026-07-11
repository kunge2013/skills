<template>
  <div class="tool-call-card">
    <div class="tool-call-header">
      <span class="tool-call-name">{{ toolCall.name }}</span>
      <code v-if="toolCall.id" class="tool-call-id">{{ toolCall.id }}</code>
      <span class="tool-call-status" :class="toolCall.status">
        <span v-if="toolCall.status === 'running'" class="dot-running" />
        <span v-else-if="toolCall.status === 'complete'" class="dot-complete">✓</span>
        <span v-else class="dot-error">✗</span>
      </span>
    </div>
    <div v-if="hasArgs" class="tool-call-args">
      <table>
        <tbody>
          <tr v-for="[key, value] in Object.entries(toolCall.args)" :key="key">
            <td>{{ key }}</td>
            <td>
              <code v-if="isComplex(value)">{{ JSON.stringify(value, null, 2) }}</code>
              <span v-else>{{ String(value) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <code v-else class="tool-call-empty-args">{}</code>
    <div v-if="toolCall.output !== null" class="tool-call-result">
      <div class="result-content" :class="{ truncated: isTruncated && !isExpanded }">
        <code>{{ toolCall.output }}</code>
      </div>
      <button v-if="isTruncated" class="expand-btn" @click="isExpanded = !isExpanded">
        {{ isExpanded ? '▲' : '▼' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  toolCall: {
    id: string
    name: string
    args: Record<string, unknown>
    output: string | null
    status: 'running' | 'complete' | 'error'
  }
}>()

const isExpanded = ref(false)
const hasArgs = computed(() => Object.keys(props.toolCall.args).length > 0)
const isTruncated = computed(() =>
  props.toolCall.output !== null &&
  (props.toolCall.output!.length > 500 || props.toolCall.output!.split('\n').length > 4)
)

function isComplex(v: unknown): boolean {
  return Array.isArray(v) || (typeof v === 'object' && v !== null)
}
</script>

<style scoped>
.tool-call-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  margin: 6px 0;
}
.tool-call-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
.tool-call-name { font-weight: 500; color: #111827; }
.tool-call-id { font-size: 12px; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
.dot-running {
  width: 8px; height: 8px; border-radius: 50%;
  background: #f59e0b;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.dot-complete { color: #22c55e; font-size: 14px; }
.dot-error { color: #ef4444; font-size: 14px; }
.tool-call-args { padding: 0; }
.tool-call-args table { width: 100%; border-collapse: collapse; }
.tool-call-args td {
  padding: 8px 16px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}
.tool-call-args td:first-child { font-weight: 500; color: #111827; white-space: nowrap; }
.tool-call-args td:last-child { color: #6b7280; }
.tool-call-args code {
  background: #f9fafb;
  font-family: monospace;
  font-size: 12px;
  padding: 4px;
  border-radius: 4px;
  word-break: break-all;
  display: block;
}
.tool-call-empty-args {
  display: block;
  padding: 12px 16px;
  font-size: 14px;
}
.tool-call-result { background: #f3f4f6; }
.result-content code {
  display: block;
  padding: 12px 16px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}
.result-content.truncated { max-height: 120px; overflow: hidden; position: relative; }
.result-content.truncated::after {
  content: '...';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, #f3f4f6);
  padding: 20px 16px 0;
  text-align: center;
}
.expand-btn {
  width: 100%;
  border: none;
  border-top: 1px solid #e5e7eb;
  padding: 8px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 14px;
}
.expand-btn:hover { background: #f9fafb; color: #4b5563; }
</style>
