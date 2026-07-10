<template>
  <div class="plan-view">
    <!-- Streaming text during planning -->
    <div v-if="plan.status === 'planning' && planBuffer" class="plan-buffer">
      <pre>{{ planBuffer }}</pre>
    </div>

    <!-- Structured plan -->
    <div v-if="plan.status === 'pending_review' || plan.status === 'executing'" class="plan-steps">
      <h3>{{ $t('agent.planTitle') }}</h3>
      <StepCard
        v-for="step in plan.steps"
        :key="step.id"
        :step="step"
        :output="stepOutputs.get(step.id)"
        @run="$emit('run-step', step)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plan, Step } from '../../types/agent'
import StepCard from './StepCard.vue'

defineProps<{ plan: Plan; planBuffer: string; stepOutputs: Map<string, string> }>()
defineEmits<{ 'run-step': [step: Step] }>()
</script>

<style scoped>
.plan-buffer { background: #1a1a2e; color: #eee; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; margin-bottom: 16px; }
.plan-steps h3 { margin-bottom: 12px; }
</style>
