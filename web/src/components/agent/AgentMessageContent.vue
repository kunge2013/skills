<template>
  <div class="agent-message-content">
    <p v-if="message.content" class="agent-text">{{ message.content }}</p>
    <div v-if="message.planId" class="plan-reference">
      <el-button text @click="showPlan = !showPlan">
        {{ showPlan ? $t('agent.hideSteps') : $t('agent.viewSteps') }}
      </el-button>
      <div v-if="showPlan && plan" class="plan-embedded">
        <PlanView :plan="plan" :plan-buffer="planBuffer" :step-outputs="stepOutputs" @run-step="$emit('run-step', $event)" />
      </div>
    </div>
    <div v-if="message.toolCalls?.length" class="tool-calls">
      <ToolCallCard v-for="tc in message.toolCalls" :key="tc.id" :tool-call="tc" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAgent } from '../../composables/useAgent'
import PlanView from './PlanView.vue'
import ToolCallCard from './ToolCallCard.vue'
import type { ChatMessage } from '../../types/chat'
import type { Step } from '../../types/agent'

defineProps<{ message: ChatMessage }>()
defineEmits<{ 'run-step': [step: Step] }>()

const showPlan = ref(false)
const { currentPlan: plan, planTextBuffer: planBuffer, stepOutputs } = useAgent()
</script>

<style scoped>
.agent-message-content { line-height: 1.6; }
.agent-text { margin: 0 0 8px; }
.plan-reference { margin: 8px 0; }
.plan-embedded { margin-top: 8px; border: 1px solid var(--el-border-color-light); border-radius: 8px; padding: 8px; }
.tool-calls { display: flex; flex-direction: column; gap: 4px; }
</style>
