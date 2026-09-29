<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-29 -->
<template>
  <div class="comic-view">
    <div class="comic-tabs">
      <div class="tab-item" :class="{ active: store.activeTab === 'novels' }" @click="store.setActiveTab('novels')">
        📖 {{ $t('comic.novels') }}
      </div>
      <div class="tab-item" :class="{ active: store.activeTab === 'templates' }" @click="store.setActiveTab('templates')">
        📝 {{ $t('comic.templates') }}
      </div>
      <div class="tab-item" :class="{ active: store.activeTab === 'pipeline' }" @click="store.setActiveTab('pipeline')">
        ⚡ {{ $t('comic.pipeline') }}
      </div>
      <div class="tab-item" :class="{ active: store.activeTab === 'logs' }" @click="store.setActiveTab('logs')">
        📋 {{ $t('comic.callLogs') }}
      </div>
    </div>

    <div class="comic-content">
      <NovelManager v-if="store.activeTab === 'novels'" />
      <TemplateManager v-else-if="store.activeTab === 'templates'" />
      <PipelineExecutor v-else-if="store.activeTab === 'pipeline'" />
      <CallLogs v-else-if="store.activeTab === 'logs'" />
    </div>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { onMounted } from 'vue'
import { useComicStore } from '../../stores/comic'
import NovelManager from './NovelManager.vue'
import TemplateManager from './TemplateManager.vue'
import PipelineExecutor from './PipelineExecutor.vue'
import CallLogs from './CallLogs.vue'

const store = useComicStore()

onMounted(async () => {
  await store.loadAll()
})
// [AGC:END]
</script>

<style scoped>
.comic-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.comic-tabs {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  padding: 0 16px;
}

.tab-item {
  padding: 14px 20px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-item:hover {
  color: #409eff;
}

.tab-item.active {
  color: #409eff;
  border-bottom-color: #409eff;
  font-weight: 500;
}

.comic-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}
</style>
