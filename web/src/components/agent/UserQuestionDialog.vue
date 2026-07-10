<template>
  <el-dialog :model-value="visible" :title="$t('agent.questionTitle')" width="400px" @close="$emit('close')">
    <p>{{ question }}</p>
    <el-input v-model="answer" type="textarea" :rows="3" :placeholder="$t('agent.answerPlaceholder')" />
    <template #footer>
      <el-button @click="$emit('close')">{{ $t('agent.cancel') }}</el-button>
      <el-button type="primary" @click="submit">{{ $t('agent.submit') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ visible: boolean; question: string }>()
const emit = defineEmits<{ close: []; submit: [answer: string] }>()
const answer = ref('')

function submit() {
  emit('submit', answer.value)
  answer.value = ''
}
</script>
