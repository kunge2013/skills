<template>
  <div class="agent-chat-view">
    <ChatMessageList :messages="messages" :is-loading="isLoading" @run-step="handleRunStep" />
    <ChatInputBar :loading="isLoading" @send="handleSend" />
  </div>
</template>

<script setup lang="ts">
import { useAgentChat } from '../../composables/useAgentChat'
import ChatMessageList from './ChatMessageList.vue'
import ChatInputBar from './ChatInputBar.vue'
import type { Step } from '../../types/agent'

const { messages, sendMessage, isLoading, runStep } = useAgentChat()

function handleSend(text: string, providerId: string, modelKey: string) {
  sendMessage(text, providerId, modelKey)
}

function handleRunStep(step: Step) {
  runStep(step)
}
</script>

<style scoped>
.agent-chat-view { display: flex; flex-direction: column; height: calc(100vh - 160px); }
</style>
