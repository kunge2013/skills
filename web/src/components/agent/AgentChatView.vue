<template>
  <div class="agent-chat-view">
    <!-- Chat start screen -->
    <div v-if="messages.length === 0 && !isLoading" class="chat-start-screen">
      <h1 class="chat-start-title">{{ $t('agent.title') }}</h1>
    </div>
    <!-- Chat content -->
    <template v-else>
      <ChatMessageList :messages="messages" :is-loading="isLoading" :hide-tool-calls="hideToolCalls" />
    </template>
    <ChatInputBar :loading="isLoading" :hide-tool-calls="hideToolCallsModel" @update:hide-tool-calls="hideToolCallsModel = $event" @send="handleSend" @cancel="handleCancel" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentChat } from '../../composables/useAgentChat'
import ChatMessageList from './ChatMessageList.vue'
import ChatInputBar from './ChatInputBar.vue'

const { messages, sendMessage, isLoading, hideToolCalls, setHideToolCalls } = useAgentChat()

const hideToolCallsModel = computed({
  get: () => hideToolCalls.value,
  set: (v: boolean) => setHideToolCalls(v),
})

function handleSend(text: string, modelKey: string) {
  sendMessage(text, modelKey)
}

function handleCancel() {
  // No cancel API yet — just a placeholder emit target
}
</script>

<style scoped>
.agent-chat-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 160px);
  position: relative;
}

.chat-start-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 25vh;
}

.chat-start-title {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #111827;
  margin: 0;
}
</style>
