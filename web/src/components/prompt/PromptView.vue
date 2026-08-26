<template>
  <div class="prompt-view">
    <el-tabs v-model="activeTab" type="border-card" class="prompt-tabs">
      <el-tab-pane :label="t('prompt.models')" name="models">
        <ModelsView />
      </el-tab-pane>
      <el-tab-pane :label="t('prompt.settings')" name="settings">
        <PromptSettingsView />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePromptStore } from '../../stores/prompt'
import ModelsView from './ModelsView.vue'
import PromptSettingsView from './PromptSettingsView.vue'

const { t } = useI18n()
const store = usePromptStore()
const activeTab = computed({
  get: () => store.activePromptTab,
  set: (val: string) => { store.activePromptTab = val },
})
// [AGC:END]
</script>

<style scoped>
.prompt-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.prompt-tabs {
  flex: 1;
  overflow: hidden;
}
.prompt-tabs :deep(.el-tabs__content) {
  height: calc(100vh - 80px);
  overflow: auto;
  padding: 16px;
}
</style>
