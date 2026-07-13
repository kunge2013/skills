<template>
  <div class="chat-input-bar">
    <div class="input-wrapper">
      <textarea
        v-model="message"
        :placeholder="$t('agent.chatInputPlaceholder')"
        @keydown.enter.exact.prevent="send"
        @keydown.ctrl.enter="send"
        rows="2"
        class="input-textarea"
      />
      <div class="input-actions">
        <div class="toggle-row">
          <label class="toggle-label">
            <input type="checkbox" v-model="hideToolCallsLocal" class="toggle-checkbox" />
            <span class="toggle-track" :class="{ checked: hideToolCallsLocal }">
              <span class="toggle-thumb" />
            </span>
            <span>{{ $t('agent.hideToolCalls') }}</span>
          </label>
        </div>
        <div class="button-row">
          <el-select v-model="modelKey" :placeholder="$t('agent.selectModel')" size="small" class="model-select" clearable>
            <el-option v-for="m in enabledModels" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
          <button
            v-if="loading"
            class="btn-cancel"
            @click="emit('cancel')"
          >
            <span class="spinner" />
            {{ $t('agent.cancel') }}
          </button>
          <button
            v-else
            class="btn-send"
            :disabled="!canSend"
            @click="send"
          >
            {{ $t('agent.send') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePromptStore } from '../../stores/prompt'
import type { TextModelConfig } from '../../types/prompt'

const emit = defineEmits<{ send: [text: string, modelKey: string]; cancel: []; 'update:hideToolCalls': [value: boolean] }>()
const props = defineProps<{ loading: boolean; hideToolCalls: boolean }>()

const promptStore = usePromptStore()
const enabledModels = computed<TextModelConfig[]>(() => promptStore.enabledModels)

const message = ref('')
const modelKey = ref('')
const hideToolCallsLocal = ref(props.hideToolCalls)

watch(enabledModels, (models) => {
  if (!modelKey.value && models.length > 0) modelKey.value = models[0].id
}, { immediate: true })

const canSend = computed(() => !!message.value.trim() && !!modelKey.value)

function send() {
  if (!canSend.value) return
  emit('send', message.value.trim(), modelKey.value)
  message.value = ''
}

watch(hideToolCallsLocal, (v) => emit('update:hideToolCalls', v))
watch(() => props.hideToolCalls, (v) => { hideToolCallsLocal.value = v })
</script>

<style scoped>
.chat-input-bar { padding: 12px 16px 16px; border-top: 1px solid #e5e7eb; }
.input-wrapper {
  width: 100%;
  margin: 0 auto;
  background: #f5f5f5;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.input-wrapper:focus-within {
  border-color: #111827;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.input-textarea {
  width: 100%;
  border: none;
  background: transparent;
  resize: none;
  font-size: 15px;
  line-height: 1.5;
  outline: none;
  padding: 0;
  color: #111827;
}
.input-textarea::placeholder { color: #9ca3af; }
.input-actions { margin-top: 8px; }
.toggle-row { margin-bottom: 8px; }
.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
}
.toggle-checkbox { display: none; }
.toggle-track {
  width: 36px; height: 20px;
  border-radius: 999px;
  background: #d1d5db;
  position: relative;
  transition: background 200ms ease;
}
.toggle-track.checked { background: #111827; }
.toggle-thumb {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2px; left: 2px;
  transition: transform 200ms ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.toggle-track.checked .toggle-thumb { transform: translateX(16px); }
.button-row { display: flex; gap: 8px; align-items: center; justify-content: flex-end; }
.model-select { width: 180px; }
.btn-cancel, .btn-send {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 150ms ease;
}
.btn-cancel {
  background: #f3f4f6;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-cancel:hover { background: #e5e7eb; }
.spinner {
  width: 14px; height: 14px;
  border: 2px solid #d1d5db;
  border-top-color: #6b7280;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.btn-send {
  background: #111827;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.btn-send:hover:not(:disabled) { background: #1f2937; }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
