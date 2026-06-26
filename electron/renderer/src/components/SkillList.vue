// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
<template>
  <div class="skill-list">
    <div class="toolbar">
      <el-input v-model="searchQuery" placeholder="Search skills..." clearable class="search-input" @input="handleSearch" />
      <el-select v-model="store.selectedCategory" placeholder="Category" clearable class="filter-select" @change="store.applyFilters()">
        <el-option label="All Categories" value="" />
        <el-option v-for="cat in store.categories" :key="cat" :label="cat" :value="cat" />
      </el-select>
      <el-select v-model="store.sortBy" class="sort-select" @change="store.applyFilters()">
        <el-option label="Sort: Name" value="name" />
        <el-option label="Sort: Plugin" value="plugin" />
        <el-option label="Sort: Author" value="author" />
      </el-select>
    </div>
    <div class="plugin-groups" v-loading="store.loading">
      <div v-for="plugin in groupedSkills" :key="plugin.name" class="plugin-group">
        <div class="plugin-header">
          <div class="plugin-info">
            <h3>{{ plugin.name }}</h3>
            <span class="plugin-desc">{{ plugin.description }}</span>
            <span class="plugin-meta">{{ plugin.skillCount }} skills &bull; {{ plugin.author }} &bull; {{ plugin.category }}</span>
          </div>
          <div class="plugin-actions">
            <el-button size="small" @click="expandPlugin(plugin.name)">View Skills</el-button>
          </div>
        </div>
        <div v-if="expandedPlugins.has(plugin.name)" class="skill-items">
          <div v-for="skill in pluginSkills[plugin.name]" :key="skill.skillName" class="skill-item" @click="store.selectSkill(skill)">
            <span class="skill-name">{{ skill.skillName }}</span>
            <span class="skill-desc">{{ skill.pluginDescription }}</span>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-if="!store.loading && store.filteredSkills.length === 0" description="No skills found" />
  </div>
</template>
<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, computed, onMounted } from 'vue'
import { useSkillsStore } from '../stores/skills'

const store = useSkillsStore()
const searchQuery = ref('')
const expandedPlugins = ref(new Set<string>())
let searchTimer: ReturnType<typeof setTimeout> | null = null

const groupedSkills = computed(() => {
  const groups = new Map<string, any>()
  for (const plugin of store.plugins) groups.set(plugin.name, plugin)
  return Array.from(groups.values())
})

const pluginSkills = computed(() => {
  const map: Record<string, any[]> = {}
  for (const skill of store.filteredSkills) {
    if (!map[skill.pluginName]) map[skill.pluginName] = []
    map[skill.pluginName].push(skill)
  }
  return map
})

function handleSearch(query: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => store.searchSkills(query), 300)
}

function expandPlugin(pluginName: string) {
  if (expandedPlugins.value.has(pluginName)) expandedPlugins.value.delete(pluginName)
  else expandedPlugins.value.add(pluginName)
}

onMounted(async () => {
  await store.checkCacheStatus()
  await store.loadPlugins()
  await store.loadSkills()
})
// [AGC:END]
</script>
<style scoped>
.skill-list { height: 100%; display: flex; flex-direction: column; background: #f5f7fa; }
.toolbar { display: flex; gap: 12px; padding: 16px; background: #fff; border-bottom: 1px solid #e4e7ed; }
.search-input { flex: 1; }
.filter-select, .sort-select { width: 150px; }
.plugin-groups { flex: 1; overflow-y: auto; padding: 16px; }
.plugin-group { margin-bottom: 16px; }
.plugin-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 16px; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.plugin-info h3 { font-size: 15px; margin-bottom: 4px; }
.plugin-desc { font-size: 13px; color: #666; display: block; margin-bottom: 4px; }
.plugin-meta { font-size: 12px; color: #999; }
.skill-items { margin-top: 8px; margin-left: 16px; }
.skill-item { padding: 8px 12px; background: #fff; border-radius: 6px; margin-bottom: 4px; cursor: pointer; transition: background 0.2s; }
.skill-item:hover { background: #ecf5ff; }
.skill-name { font-weight: 500; font-size: 14px; display: block; }
.skill-desc { font-size: 12px; color: #888; }
</style>
