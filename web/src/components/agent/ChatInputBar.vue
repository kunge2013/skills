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
      <el-select v-model="modelKey" :placeholder="$t('agent.selectModel')" size="small" class="model-select">
        <el-option v-for="m in enabledModels" :key="m.id" :label="m.name" :value="m.id" />
      </el-select>
      <el-button type="primary" :loading="loading" :disabled="!canSend" @click="send">
        {{ $t('agent.send') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePromptStore } from '../../stores/prompt'
import type { TextModelConfig } from '../../types/prompt'

const emit = defineEmits<{ send: [text: string, modelKey: string] }>()
defineProps<{ loading: boolean }>()

const promptStore = usePromptStore()
const enabledModels = computed<TextModelConfig[]>(() => promptStore.enabledModels)

const message = ref('')
const modelKey = ref('')

if (!modelKey.value && enabledModels.value.length > 0) {
  modelKey.value = enabledModels.value[0].id
}

const canSend = computed(() => !!message.value.trim() && !!modelKey.value)

function send() {
  if (!canSend.value) return
  emit('send', message.value.trim(), modelKey.value)
  message.value = ''
}
</script>

<style scoped>
.chat-input-bar { padding: 12px 0; border-top: 1px solid var(--el-border-color-light); }
.input-actions { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.model-select { width: 200px; }
</style>
