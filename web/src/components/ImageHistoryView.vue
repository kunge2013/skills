<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-16 -->
<template>
  <div class="image-history">
    <div class="toolbar">
      <el-button type="primary" @click="handleRefresh" :loading="store.loading">{{ $t('imageHistory.refresh') }}</el-button>
    </div>

    <div class="image-grid" v-loading="store.loading">
      <div
        v-for="img in store.items"
        :key="img.id"
        class="image-card"
      >
        <el-image
          :src="img.url"
          :preview-src-list="previewUrls"
          :initial-index="previewUrls.indexOf(img.url)"
          fit="cover"
          class="card-image"
        />
        <div class="card-info">
          <div class="card-prompt" :title="img.prompt">{{ img.prompt }}</div>
          <div class="card-meta">
            <span>{{ img.modelKey }}</span>
            <span>{{ formatTime(img.createdAt) }}</span>
          </div>
        </div>
        <div class="card-actions">
          <el-button type="danger" size="small" text @click="handleDelete(img.id)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <div v-if="!store.loading && store.items.length === 0" class="empty-state">
      <el-empty :description="$t('imageHistory.empty')" />
    </div>

    <div class="pager" v-if="store.total > 0">
      <el-pagination
        layout="total, prev, pager, next"
        :total="store.total"
        :page-size="store.pageSize"
        :current-page="store.page"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { useImageHistoryStore } from '../stores/imageHistory'

const { t } = useI18n()
const store = useImageHistoryStore()

const previewUrls = computed(() => store.items.map(img => img.url))

function formatTime(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

async function handleRefresh() {
  try { await store.fetchList() } catch (e) { reportError(e) }
}

async function handlePageChange(p: number) {
  store.setPage(p)
  try { await store.fetchList() } catch (e) { reportError(e) }
}

async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm(t('imageHistory.confirmDelete'), t('imageHistory.deleteTitle'), {
      type: 'warning',
    })
    await store.deleteImage(id)
    ElMessage.success(t('imageHistory.deleted'))
  } catch (e) {
    if (e !== 'cancel') reportError(e)
  }
}

function reportError(e: unknown) {
  ElMessage.error(e instanceof Error ? e.message : String(e))
}

onMounted(async () => {
  try { await store.fetchList() } catch (e) { reportError(e) }
})
// [AGC:END]
</script>

<style scoped>
.image-history { height: 100%; display: flex; flex-direction: column; padding: 16px; box-sizing: border-box; }
.toolbar { margin-bottom: 12px; }
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  grid-auto-rows: min-content;
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  align-content: start;
}
.image-card {
  position: relative;
  border: 1px solid #e2e5ea;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  transition: box-shadow 0.2s ease;
}
.image-card:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.card-image { width: 100%; height: 140px; display: block; }
.card-info { padding: 6px 8px; }
.card-prompt {
  font-size: 12px;
  line-height: 1.3;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #999;
  margin-top: 2px;
}
.card-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.image-card:hover .card-actions { opacity: 1; }
.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; }
.pager { margin-top: 12px; display: flex; justify-content: flex-end; }
</style>
