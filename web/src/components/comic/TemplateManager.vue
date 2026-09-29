<!-- [AGC:FILE] tool=Cc author=fangkun date=2026-09-29 -->
<template>
  <div class="template-manager">
    <div class="toolbar">
      <div class="info">{{ $t('comic.totalTemplates', { count: store.templates.length }) }}</div>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        {{ $t('comic.addTemplate') }}
      </el-button>
    </div>

    <!-- 清洗类 -->
    <div class="template-section">
      <div class="section-title">🧹 {{ $t('comic.cleaning') }} <span class="badge">{{ cleaningTemplates.length }}</span></div>
      <div class="template-grid">
        <el-card v-for="t in cleaningTemplates" :key="t.id" class="template-card" shadow="never">
          <div class="step-badge">P{{ t.step_order }}</div>
          <h4>{{ t.name }}</h4>
          <div class="desc">{{ t.description }}</div>
          <div class="vars">
            <el-tag v-for="v in t.input_variables" :key="v" size="small" type="warning">{{ '{' + v + '}' }}</el-tag>
          </div>
          <div class="preview">{{ truncate(t.system_prompt, 100) }}</div>
          <div class="actions">
            <el-button v-if="t.is_builtin" size="small" text @click="copyTemplate(t)">{{ $t('comic.copyAsCustom') }}</el-button>
            <el-button v-if="!t.is_builtin" size="small" text @click="startEdit(t)">{{ $t('comic.edit') }}</el-button>
            <el-button v-if="!t.is_builtin" size="small" text type="danger" @click="handleDelete(t)">{{ $t('comic.delete') }}</el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 提取类 -->
    <div class="template-section">
      <div class="section-title">🕵️ {{ $t('comic.extraction') }} <span class="badge">{{ extractionTemplates.length }}</span></div>
      <div class="template-grid">
        <el-card v-for="t in extractionTemplates" :key="t.id" class="template-card" shadow="never">
          <div class="step-badge">P{{ t.step_order }}</div>
          <h4>{{ t.name }}</h4>
          <div class="desc">{{ t.description }}</div>
          <div class="vars">
            <el-tag v-for="v in t.input_variables" :key="v" size="small" type="warning">{{ '{' + v + '}' }}</el-tag>
          </div>
          <div class="preview">{{ truncate(t.system_prompt, 100) }}</div>
          <div class="actions">
            <el-button v-if="t.is_builtin" size="small" text @click="copyTemplate(t)">{{ $t('comic.copyAsCustom') }}</el-button>
            <el-button v-if="!t.is_builtin" size="small" text @click="startEdit(t)">{{ $t('comic.edit') }}</el-button>
            <el-button v-if="!t.is_builtin" size="small" text type="danger" @click="handleDelete(t)">{{ $t('comic.delete') }}</el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 剧本化类 -->
    <div class="template-section">
      <div class="section-title">🎬 {{ $t('comic.script') }} <span class="badge">{{ scriptTemplates.length }}</span></div>
      <div class="template-grid">
        <el-card v-for="t in scriptTemplates" :key="t.id" class="template-card" shadow="never">
          <div class="step-badge">P{{ t.step_order }}</div>
          <h4>{{ t.name }}</h4>
          <div class="desc">{{ t.description }}</div>
          <div class="vars">
            <el-tag v-for="v in t.input_variables" :key="v" size="small" type="warning">{{ '{' + v + '}' }}</el-tag>
          </div>
          <div class="preview">{{ truncate(t.system_prompt, 100) }}</div>
          <div class="actions">
            <el-button v-if="t.is_builtin" size="small" text @click="copyTemplate(t)">{{ $t('comic.copyAsCustom') }}</el-button>
            <el-button v-if="!t.is_builtin" size="small" text @click="startEdit(t)">{{ $t('comic.edit') }}</el-button>
            <el-button v-if="!t.is_builtin" size="small" text type="danger" @click="handleDelete(t)">{{ $t('comic.delete') }}</el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 分镜化类 -->
    <div class="template-section">
      <div class="section-title">🖼️ {{ $t('comic.storyboard') }} <span class="badge">{{ storyboardTemplates.length }}</span></div>
      <div class="template-grid">
        <el-card v-for="t in storyboardTemplates" :key="t.id" class="template-card" shadow="never">
          <div class="step-badge">P{{ t.step_order }}</div>
          <h4>{{ t.name }}</h4>
          <div class="desc">{{ t.description }}</div>
          <div class="vars">
            <el-tag v-for="v in t.input_variables" :key="v" size="small" type="warning">{{ '{' + v + '}' }}</el-tag>
          </div>
          <div class="preview">{{ truncate(t.system_prompt, 100) }}</div>
          <div class="actions">
            <el-button v-if="t.is_builtin" size="small" text @click="copyTemplate(t)">{{ $t('comic.copyAsCustom') }}</el-button>
            <el-button v-if="!t.is_builtin" size="small" text @click="startEdit(t)">{{ $t('comic.edit') }}</el-button>
            <el-button v-if="!t.is_builtin" size="small" text type="danger" @click="handleDelete(t)">{{ $t('comic.delete') }}</el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showDialog" :title="editingTemplate ? $t('comic.editTemplate') : $t('comic.addTemplate')" width="700px">
      <el-form :model="form" label-width="120px">
        <el-form-item :label="$t('comic.templateName')">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item :label="$t('comic.category')">
          <el-select v-model="form.category">
            <el-option label="🧹 文本清洗" value="cleaning" />
            <el-option label="🕵️ 角色/场景提取" value="extraction" />
            <el-option label="🎬 剧本化" value="script" />
            <el-option label="🖼️ 分镜化" value="storyboard" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('comic.description')">
          <el-input v-model="form.description" />
        </el-form-item>
        <el-form-item :label="$t('comic.systemPrompt')">
          <el-input v-model="form.system_prompt" type="textarea" :rows="8" />
        </el-form-item>
        <el-form-item :label="$t('comic.inputVariables')">
          <el-input v-model="inputVariablesText" type="textarea" :rows="3" placeholder="content&#10;character_text" />
          <div class="form-tip">{{ $t('comic.inputVariablesTip') }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// [AGC:START] tool=Cc author=fangkun
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useComicStore } from '../../stores/comic'
import type { ComicTemplate } from '../../types/comic'

const { t } = useI18n()
const store = useComicStore()

const showDialog = ref(false)
const editingTemplate = ref<ComicTemplate | null>(null)
const saving = ref(false)
const inputVariablesText = ref('')

const form = reactive({
  name: '',
  description: '',
  category: 'cleaning' as 'cleaning' | 'extraction' | 'script' | 'storyboard',
  system_prompt: '',
})

const cleaningTemplates = computed(() => store.templatesByCategory('cleaning'))
const extractionTemplates = computed(() => store.templatesByCategory('extraction'))
const scriptTemplates = computed(() => store.templatesByCategory('script'))
const storyboardTemplates = computed(() => store.templatesByCategory('storyboard'))

function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

function openCreateDialog() {
  editingTemplate.value = null
  form.name = ''
  form.description = ''
  form.category = 'cleaning'
  form.system_prompt = ''
  inputVariablesText.value = ''
  showDialog.value = true
}

function startEdit(template: ComicTemplate) {
  editingTemplate.value = template
  form.name = template.name
  form.description = template.description || ''
  form.category = template.category
  form.system_prompt = template.system_prompt
  inputVariablesText.value = template.input_variables?.join('\n') || ''
  showDialog.value = true
}

function copyTemplate(template: ComicTemplate) {
  editingTemplate.value = null
  form.name = `${template.name} (Copy)`
  form.description = template.description || ''
  form.category = template.category
  form.system_prompt = template.system_prompt
  inputVariablesText.value = template.input_variables?.join('\n') || ''
  showDialog.value = true
}

async function handleSave() {
  if (!form.name.trim() || !form.system_prompt.trim()) {
    ElMessage.warning(t('comic.templateValidation'))
    return
  }

  saving.value = true
  try {
    const input_variables = inputVariablesText.value.split('\n').map(v => v.trim()).filter(v => v)

    if (editingTemplate.value) {
      await store.updateTemplate(editingTemplate.value.id, {
        name: form.name,
        description: form.description,
        category: form.category,
        system_prompt: form.system_prompt,
        input_variables,
      })
      ElMessage.success(t('comic.updateSuccess'))
    } else {
      await store.createTemplate({
        name: form.name,
        description: form.description,
        category: form.category,
        step_order: null,
        depend_on: null,
        system_prompt: form.system_prompt,
        user_prompt: null,
        input_variables: input_variables,
        is_builtin: false,
      })
      ElMessage.success(t('comic.createSuccess'))
    }
    showDialog.value = false
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(template: ComicTemplate) {
  try {
    await ElMessageBox.confirm(
      t('comic.deleteTemplateConfirm', { name: template.name }),
      t('common.confirm'),
      { type: 'warning' }
    )
    await store.deleteTemplate(template.id)
    ElMessage.success(t('comic.deleteSuccess'))
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.message)
    }
  }
}
// [AGC:END]
</script>

<style scoped>
.template-manager {
  height: 100%;
  overflow: auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.toolbar .info {
  font-size: 14px;
  color: #666;
}

.template-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  background: #409eff;
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.template-card {
  position: relative;
}

.step-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #f0f5ff;
  color: #409eff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.template-card h4 {
  font-size: 14px;
  margin: 0 0 6px 0;
  padding-right: 50px;
}

.template-card .desc {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.template-card .vars {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.template-card .preview {
  font-size: 12px;
  color: #666;
  background: #fafafa;
  padding: 8px;
  border-radius: 4px;
  max-height: 60px;
  overflow: hidden;
  line-height: 1.5;
}

.template-card .actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
