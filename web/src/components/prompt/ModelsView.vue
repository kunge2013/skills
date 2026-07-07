<template>
  <div class="models-view">
    <div class="models-header">
      <h2>{{ t('prompt.modelsTitle') }}</h2>
      <el-button @click="store.showAddModel = !store.showAddModel">
        {{ store.showAddModel ? t('prompt.cancel') : t('prompt.addModel') }}
      </el-button>
    </div>

    <el-card v-if="store.showAddModel" shadow="never" class="add-model-form">
      <el-form label-position="top">
        <el-form-item :label="t('prompt.modelKey')">
          <el-input v-model="store.newModel.id" />
        </el-form-item>
        <el-form-item :label="t('prompt.displayName')">
          <el-input v-model="store.newModel.name" />
        </el-form-item>
        <el-form-item :label="t('prompt.selectProtocol')">
          <el-select v-model="store.newModel.providerId" @change="onProviderChange">
            <el-option label="" value="" />
            <el-option
              v-for="p in store.llmProviders"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('prompt.modelId')">
          <el-input v-model="store.newModel.modelId" />
        </el-form-item>
        <el-form-item :label="t('prompt.apiKey')">
          <el-input v-model="store.newModel.apiKey" type="password" show-password />
        </el-form-item>
        <el-form-item :label="t('prompt.baseURL')">
          <el-input v-model="store.newModel.baseURL" />
        </el-form-item>
        <el-button type="primary" @click="store.addModelEntry()">{{ t('prompt.saveModel') }}</el-button>
      </el-form>
    </el-card>

    <div class="models-list">
      <el-card v-for="model in store.allModels" :key="model.id" shadow="never" class="model-card">
        <div class="model-info">
          <span class="model-name">{{ model.name }}</span>
          <span class="model-id">{{ model.id }}</span>
        </div>
        <div class="model-actions">
          <el-switch
            :model-value="model.enabled"
            @change="() => store.toggleModel(model)"
            :active-text="t('prompt.enabled')"
            :inactive-text="t('prompt.disabled')"
          />
          <el-button type="danger" size="small" @click="store.deleteModel(model.id)">{{ t('prompt.delete') }}</el-button>
        </div>
      </el-card>
    </div>

    <el-empty v-if="store.allModels.length === 0" :description="t('prompt.emptyModels')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePromptStore } from '../../stores/prompt'

const { t } = useI18n()
const store = usePromptStore()

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; modelId: string }> = {
  openai: { baseURL: 'https://api.openai.com/v1', modelId: 'gpt-4o' },
  anthropic: { baseURL: 'https://api.anthropic.com', modelId: 'claude-sonnet-4-20250514' },
  gemini: { baseURL: '', modelId: 'gemini-2.0-flash' },
  deepseek: { baseURL: 'https://api.deepseek.com/v1', modelId: 'deepseek-chat' },
}

function onProviderChange() {
  const pId = store.newModel.providerId
  store.newModel.baseURL = PROVIDER_DEFAULTS[pId]?.baseURL || ''
  store.newModel.modelId = PROVIDER_DEFAULTS[pId]?.modelId || ''
}
</script>

<style scoped>
.models-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.add-model-form { margin-bottom: 16px; }
.model-card { margin-bottom: 8px; }
.model-info { display: flex; flex-direction: column; gap: 2px; }
.model-name { font-weight: 600; }
.model-id { font-size: 12px; color: var(--el-text-color-secondary); }
.model-actions { display: flex; align-items: center; gap: 12px; }
</style>
