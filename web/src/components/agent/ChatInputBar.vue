<template>
  <div class="chat-input-bar">
    <div class="input-wrapper">
      <el-input
        v-model="message"
        type="textarea"
        :rows="2"
        :placeholder="$t('agent.chatInputPlaceholder')"
        :autosize="{ minRows: 2, maxRows: 6 }"
        @keydown.ctrl.enter="send"
        resize="none"
      />
      <div class="input-actions">
        <el-select v-model="modelKey" :placeholder="$t('agent.selectModel')" size="small" class="model-select" clearable>
          <el-option v-for="m in enabledModels" :key="m.id" :label="m.name" :value="m.id" />
        </el-select>
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!canSend"
          size="default"
          @click="send"
        >
          {{ $t('agent.send') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePromptStore } from '../../stores/prompt'
import type { TextModelConfig } from '../../types/prompt'

const emit = defineEmits<{ send: [text: string, modelKey: string] }>()
defineProps<{ loading: boolean }>()

const promptStore = usePromptStore()
const enabledModels = computed<TextModelConfig[]>(() => promptStore.enabledModels)

const message = ref('')
const modelKey = ref('')

watch(enabledModels, (models) => {
  if (!modelKey.value && models.length > 0) {
    modelKey.value = models[0].id
  }
}, { immediate: true })

const canSend = computed(() => !!message.value.trim() && !!modelKey.value)

function send() {
  if (!canSend.value) return
  emit('send', message.value.trim(), modelKey.value)
  message.value = ''
}
</script>

<style scoped>
.chat-input-bar {
  padding: 12px 0;
  border-top: 1px solid #e5e7eb;
}

.input-wrapper {
  background: #f5f5f5;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 10px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.input-wrapper:focus-within {
  border-color: #111827;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.input-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  align-items: center;
  justify-content: flex-end;
}

.model-select { width: 180px; }
</style>
