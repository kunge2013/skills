<template>
  <div class="step-output">
    <div v-if="error" class="error-text">{{ error }}</div>
    <div v-else-if="output" class="output-text">
      <pre>{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ stepId: string; output: string; error?: string }>()
</script>

<style scoped>
.step-output { margin-top: 8px; }
.output-text pre { background: #f5f7fa; padding: 8px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
.error-text { color: #f56c6c; font-size: 13px; }
</style>
