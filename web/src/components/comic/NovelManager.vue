<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-29 -->
<template>
  <div class="novel-manager">
    <div class="toolbar">
      <div class="info">{{ $t('comic.totalNovels', { count: store.novelsTotal }) }}</div>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        {{ $t('comic.addNovel') }}
      </el-button>
    </div>

    <div class="novel-list">
      <div v-for="novel in store.novels" :key="novel.id" class="novel-card">
        <div class="novel-info">
          <h4>{{ novel.name }}</h4>
          <div class="novel-meta">
            <span>📏 {{ formatLength(getNovelContentLength(novel.id)) }} {{ $t('comic.chars') }}</span>
            <span>🕐 {{ formatTime(novel.updated_at) }}</span>
            <span class="progress-tags">
              <span class="progress-tag" :class="getContentField(novel.id, 'is_format_cleaned') ? 'done' : 'pending'">{{ $t('comic.format') }}</span>
              <span class="progress-tag" :class="getContentField(novel.id, 'is_serial_cleaned') ? 'done' : 'pending'">{{ $t('comic.serial') }}</span>
              <span class="progress-tag" :class="getContentField(novel.id, 'is_punct_cleaned') ? 'done' : 'pending'">{{ $t('comic.punct') }}</span>
              <span class="progress-tag" :class="getContentField(novel.id, 'is_shot_cleaned') ? 'done' : 'pending'">{{ $t('comic.shot') }}</span>
            </span>
          </div>
        </div>
        <div class="novel-actions">
          <el-button size="small" :type="hasIncompleteRun(novel.id) ? 'success' : 'primary'" @click="goToPipeline(novel.id)">
            {{ hasIncompleteRun(novel.id) ? $t('comic.resumeExecution') : $t('comic.startExecution') }}
          </el-button>
          <el-button size="small" @click="startEdit(novel)">{{ $t('comic.edit') }}</el-button>
          <el-button size="small" type="danger" @click="handleDelete(novel)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <el-empty v-if="store.novels.length === 0" :description="$t('comic.noNovels')" />

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showCreateDialog" :title="editingNovel ? $t('comic.editNovel') : $t('comic.addNovel')" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item :label="$t('comic.novelName')">
          <el-input v-model="form.name" :placeholder="$t('comic.novelNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('comic.inputMode')">
          <el-radio-group v-model="inputMode">
            <el-radio value="paste">{{ $t('comic.pasteText') }}</el-radio>
            <el-radio value="upload">{{ $t('comic.uploadFile') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="inputMode === 'paste'" :label="$t('comic.novelContent')">
          <el-input
            v-model="form.original_text"
            type="textarea"
            :rows="10"
            :placeholder="$t('comic.pastePlaceholder')"
          />
        </el-form-item>
        <el-form-item v-if="inputMode === 'upload'" :label="$t('comic.uploadFile')">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".txt"
            :on-change="handleFileChange"
          >
            <el-button type="primary">{{ $t('comic.selectFile') }}</el-button>
            <template #tip>
              <div class="el-upload__tip">{{ $t('comic.uploadTip') }}</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { useComicStore } from '../../stores/comic'
import type { Novel } from '../../types/comic'

const { t } = useI18n()
const store = useComicStore()

const showCreateDialog = ref(false)
const editingNovel = ref<Novel | null>(null)
const inputMode = ref<'paste' | 'upload'>('paste')
const saving = ref(false)

const form = reactive({
  name: '',
  original_text: '',
})

onMounted(async () => {
  // Load latest runs and content for all novels
  if (store.novels.length > 0) {
    await Promise.all([
      store.loadLatestRunsForAllNovels(),
      ...store.novels.map(n => store.loadNovelContent(n.id)),
    ])
  }
})

function hasIncompleteRun(novelId: string): boolean {
  return store.novelHasIncompleteRun(novelId)
}

function getNovelContentLength(novelId: string): number {
  return store.novelContent[novelId]?.original_text?.length || 0
}

function getContentField(novelId: string, field: 'is_format_cleaned' | 'is_serial_cleaned' | 'is_punct_cleaned' | 'is_shot_cleaned'): boolean {
  const content = store.novelContent[novelId]
  if (!content) return false
  return content[field]
}

function formatLength(len: number): string {
  return len.toLocaleString()
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function startEdit(novel: Novel) {
  editingNovel.value = novel
  form.name = novel.name
  form.original_text = store.novelContent[novel.id]?.original_text || ''
  inputMode.value = 'paste'
  showCreateDialog.value = true
}

function handleFileChange(file: any) {
  const reader = new FileReader()
  reader.onload = (e) => {
    form.original_text = e.target?.result as string
    if (!form.name && file.name) {
      form.name = file.name.replace(/\.txt$/i, '')
    }
  }
  reader.readAsText(file.raw)
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning(t('comic.nameRequired'))
    return
  }

  saving.value = true
  try {
    if (editingNovel.value) {
      await store.updateNovel(editingNovel.value.id, { name: form.name })
      await store.updateNovelContent(editingNovel.value.id, { original_text: form.original_text })
      ElMessage.success(t('comic.updateSuccess'))
    } else {
      await store.createNovel({
        name: form.name,
        original_text: form.original_text,
      })
      ElMessage.success(t('comic.createSuccess'))
    }
    showCreateDialog.value = false
    resetForm()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(novel: Novel) {
  try {
    await ElMessageBox.confirm(
      t('comic.deleteConfirm', { name: novel.name }),
      t('common.confirm'),
      { type: 'warning' }
    )
    await store.deleteNovel(novel.id)
    ElMessage.success(t('comic.deleteSuccess'))
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.message)
    }
  }
}

function goToPipeline(novelId: string) {
  store.setSelectedNovel(novelId)
  store.setActiveTab('pipeline')
}

function resetForm() {
  editingNovel.value = null
  form.name = ''
  form.original_text = ''
  inputMode.value = 'paste'
}
// [AGC:END]
</script>

<style scoped>
.novel-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar .info {
  font-size: 14px;
  color: #666;
}

.novel-list {
  flex: 1;
  overflow: auto;
}

.novel-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: box-shadow 0.2s;
}

.novel-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.novel-info h4 {
  font-size: 15px;
  margin: 0 0 4px 0;
}

.novel-meta {
  font-size: 12px;
  color: #999;
  display: flex;
  gap: 12px;
  align-items: center;
}

.progress-tags {
  display: flex;
  gap: 4px;
}

.progress-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.progress-tag.done {
  background: #e8f5e9;
  color: #2e7d32;
}

.progress-tag.pending {
  background: #f5f5f5;
  color: #999;
}

.novel-actions {
  display: flex;
  gap: 6px;
}
</style>
