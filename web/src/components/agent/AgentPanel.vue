<template>
  <div class="agent-panel">
    <h2 class="panel-title">{{ $t('agent.title') }}</h2>
    <AgentChatView />
  </div>
</template>

<script setup lang="ts">
import AgentChatView from './AgentChatView.vue'
</script>

<style scoped>
.agent-panel { padding: 20px; max-width: 900px; margin: 0 auto; }
.panel-title { font-size: 20px; margin-bottom: 16px; }
</style>
