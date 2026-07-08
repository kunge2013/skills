// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08
<template>
  <el-card shadow="never" class="variable-config">
    <template #header>
      <div class="header">
        <span>{{ t('prompt.variableConfig') }}</span>
        <el-button size="small" @click="$emit('scan')">
          {{ t('prompt.scanVariables') }}
        </el-button>
      </div>
    </template>

    <div v-if="allVariables.length === 0" class="empty">
      {{ t('prompt.noVariables') }}
    </div>

    <div v-else class="variable-list">
      <div v-for="varName in allVariables" :key="varName" class="variable-item">
        <el-checkbox
          :model-value="systemVariables.includes(varName)"
          @change="toggleVariable(varName)"
        >
          <span class="var-name">{{ varName }}</span>
          <el-tag size="small" type="info">
            {{ systemVariables.includes(varName) ? t('prompt.systemVariable') : t('prompt.userVariable') }}
          </el-tag>
        </el-checkbox>
      </div>
    </div>
  </el-card>
</template>

// [AGC:START] tool=Cc author=fangkun
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  systemVariables: string[]
  allVariables: string[]
}>()

const emit = defineEmits<{
  'update:systemVariables': [value: string[]]
  'scan': []
}>()

function toggleVariable(varName: string) {
  const current = [...props.systemVariables]
  const index = current.indexOf(varName)

  if (index > -1) {
    current.splice(index, 1)
  } else {
    current.push(varName)
  }

  emit('update:systemVariables', current)
}
</script>
// [AGC:END]

<style scoped>
.variable-config {
  margin-top: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.variable-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.variable-item {
  display: flex;
  align-items: center;
}

.var-name {
  margin-right: 8px;
  font-family: monospace;
  font-weight: 500;
}
</style>