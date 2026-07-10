<template>
  <div class="agent-panel">
    <h2 class="panel-title">{{ $t('agent.title') }}</h2>
    <AgentInput
      :skills="skills"
      :loading="loading"
      @create-plan="handleCreatePlan"
    />
    <div v-if="error" class="error-banner">{{ error }}</div>
    <PlanView
      v-if="currentPlan"
      :plan="currentPlan"
      :plan-buffer="planTextBuffer"
      :step-outputs="stepOutputs"
      @run-step="handleRunStep"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAgent } from '../../composables/useAgent'
import AgentInput from './AgentInput.vue'
import PlanView from './PlanView.vue'
import type { Step } from '../../types/agent'

const {
  currentPlan, planTextBuffer, skills, loading, error, stepOutputs,
  loadSkills, createPlan, runStep,
} = useAgent()

onMounted(() => { loadSkills() })

async function handleCreatePlan(data: { message: string; providerId: string; modelKey: string }) {
  await createPlan(data.message, data.providerId, data.modelKey)
}

async function handleRunStep(step: Step) {
  await runStep(step)
}
</script>

<style scoped>
.agent-panel { padding: 20px; max-width: 900px; margin: 0 auto; }
.panel-title { font-size: 20px; margin-bottom: 16px; }
.error-banner { background: #fef0f0; color: #f56c6c; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; }
</style>
