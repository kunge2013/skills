<template>
  <div class="agent-input">
    <el-input
      v-model="message"
      type="textarea"
      :rows="3"
      :placeholder="$t('agent.inputPlaceholder')"
      @keydown.ctrl.enter="submit"
    />
    <div class="input-controls">
      <el-select v-model="providerId" :placeholder="$t('agent.selectProvider')" size="small" class="provider-select">
        <el-option v-for="skill in skills" :key="skill.name" :label="skill.name" :value="skill.name" />
      </el-select>
      <el-input v-model="modelKey" :placeholder="$t('agent.modelKey')" size="small" class="model-input" />
      <el-button type="primary" :loading="loading" @click="submit">{{ $t('agent.generatePlan') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SkillInfo } from '../../types/agent'

defineProps<{ skills: SkillInfo[]; loading: boolean }>()
const emit = defineEmits<{ 'create-plan': [data: { message: string; providerId: string; modelKey: string }] }>()

const message = ref('')
const providerId = ref('anthropic')
const modelKey = ref('')

function submit() {
  if (!message.value || !providerId.value || !modelKey.value) return
  emit('create-plan', { message: message.value, providerId: providerId.value, modelKey: modelKey.value })
}
</script>

<style scoped>
.agent-input { margin-bottom: 20px; }
.input-controls { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.provider-select { width: 180px; }
.model-input { width: 200px; }
</style>
