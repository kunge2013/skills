<template>
  <div class="agent-panel">
    <AgentChatView />
  </div>
</template>

<script setup lang="ts">
import AgentChatView from './AgentChatView.vue'
</script>

<style scoped>
.agent-panel {
  padding: 0;
  max-width: 800px;
  margin: 0 auto;
  height: calc(100vh - 120px);
}
</style>
