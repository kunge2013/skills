<template>
  <div class="app-container">
    <NavSidebar />
    <div class="main-content">
      <template v-if="store.currentView === 'list'"><SkillList /></template>
      <template v-else-if="store.currentView === 'detail'"><SkillDetail /></template>
      <template v-else-if="store.currentView === 'editor'"><SkillEditor /></template>
      <template v-else-if="store.currentView === 'manage'"><SkillManage /></template>
      <template v-else><StatusBar /></template>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import NavSidebar from './components/NavSidebar.vue'
import SkillList from './components/SkillList.vue'
import SkillDetail from './components/SkillDetail.vue'
import SkillEditor from './components/SkillEditor.vue'
import SkillManage from './components/SkillManage.vue'
import { useSkillsStore } from './stores/skills'
const store = useSkillsStore()
onMounted(async () => { await store.checkCacheStatus(); if (!store.hasCache && store.cacheStatus?.hasBundled) await store.initMarketplace() })
</script>
<style scoped>
.app-container { display: flex; height: 100vh; overflow: hidden; }
.main-content { flex: 1; overflow: hidden; }
</style>
