// [AGC:START] tool=Cc author=fangkun
<template>
  <el-dialog
    :model-value="visible"
    :title="$t('manage.conflictTitle')"
    width="500px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="conflict-content">
      <p class="conflict-message">{{ $t('manage.conflictMessage', { file: conflictInfo?.path || '' }) }}</p>
      <div class="conflict-actions">
        <el-button type="primary" @click="handleOverwrite">
          {{ $t('manage.overwrite') }}
        </el-button>
        <el-button @click="handleReload">
          {{ $t('manage.reload') }}
        </el-button>
        <el-button @click="handleSkip">
          {{ $t('manage.skip') }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface ConflictInfo {
  path: string
  currentContent: string
}

defineProps<{
  visible: boolean
  conflictInfo: ConflictInfo | null
}>()

const emit = defineEmits<{
  (e: 'overwrite'): void
  (e: 'reload'): void
  (e: 'skip'): void
  (e: 'close'): void
}>()

function handleOverwrite() { emit('overwrite') }
function handleReload() { emit('reload') }
function handleSkip() { emit('skip') }
function handleClose() { emit('close') }
</script>

<style scoped>
.conflict-content { padding: 8px 0; }
.conflict-message { margin-bottom: 16px; color: #606266; }
.conflict-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
// [AGC:END]
