<template>
  <div class="agent-chat-view">
    <ChatMessageList :messages="messages" :is-loading="isLoading" />
    <ChatInputBar :loading="isLoading" @send="handleSend" />
  </div>
</template>

<script setup lang="ts">
import { useAgentChat } from '../../composables/useAgentChat'
import ChatMessageList from './ChatMessageList.vue'
import ChatInputBar from './ChatInputBar.vue'

const { messages, sendMessage, isLoading } = useAgentChat()

function handleSend(text: string, modelKey: string) {
  sendMessage(text, modelKey)
}
</script>

<style scoped>
.agent-chat-view { display: flex; flex-direction: column; height: calc(100vh - 160px); position: relative; }
</style>
