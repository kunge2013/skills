<template>
  <div class="chat-input-bar">
    <el-input
      v-model="message"
      type="textarea"
      :rows="2"
      :placeholder="$t('agent.chatInputPlaceholder')"
      @keydown.ctrl.enter="send"
    />
    <div class="input-actions">
      <el-popover trigger="click" placement="top-start" width="280">
        <template #reference>
          <el-button :icon="Setting" circle />
        </template>
        <div class="chat-settings">
          <label>{{ $t('agent.selectProvider') }}</label>
          <el-select v-model="providerId" style="width: 100%">
            <el-option v-for="p in PROVIDERS" :key="p.id" :label="$t(p.nameKey)" :value="p.id" />
          </el-select>
          <label>{{ $t('agent.modelKey') }}</label>
          <el-input v-model="modelKey" :placeholder="$t('agent.modelKey')" />
        </div>
      </el-popover>
      <el-button type="primary" :loading="loading" @click="send">
        {{ $t('agent.send') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Setting } from '@element-plus/icons-vue'

const emit = defineEmits<{
  send: [text: string, providerId: string, modelKey: string]
}>()
defineProps<{ loading: boolean }>()

const PROVIDERS = [
  { id: 'anthropic', nameKey: 'agent.providerAnthropic' },
  { id: 'openai', nameKey: 'agent.providerOpenai' },
  { id: 'gemini', nameKey: 'agent.providerGemini' },
  { id: 'deepseek', nameKey: 'agent.providerDeepseek' },
] as const

const message = ref('')
const providerId = ref('anthropic')
const modelKey = ref('')

function send() {
  if (!message.value || !providerId.value || !modelKey.value) return
  emit('send', message.value, providerId.value, modelKey.value)
  message.value = ''
}
</script>

<style scoped>
.chat-input-bar { padding: 12px 0; border-top: 1px solid var(--el-border-color-light); }
.input-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.chat-settings { display: flex; flex-direction: column; gap: 8px; }
.chat-settings label { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
