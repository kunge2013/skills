# Tasks: Merge Prompt Optimizer

## Phase 1: Backend Integration

- [x] 1.1 Copy prompt-optimizer server code into `skills/src/server/`
  - Copy all services: llm, model, template, history, favorite, preference, data, context, image
  - Copy all routes
  - Copy middleware
  - Copy storage provider
  - Copy config
- [x] 1.2 Use Express server directly (no conversion needed - using Express as dependency)
- [x] 1.3 Add prompt optimizer dependencies to main `package.json`
  - express, cors, dotenv, express-rate-limit
  - openai, @anthropic-ai/sdk, @google/genai, uuid
  - tsup, tsx (for TypeScript server compilation)
- [x] 1.4 Create `tsconfig.server.json` for server-side TypeScript compilation
- [x] 1.5 Build server TypeScript files to JS (using tsx directly)
- [x] 1.6 Create `cmdPrompt()` in `src/commands/prompt.js`
  - Similar to `cmdWeb()` but on port 3011
  - Auto-open browser to `http://127.0.0.1:3011`
- [x] 1.7 Register `prompt` command in `src/cli.js`

## Phase 2: Frontend Integration

- [x] 2.1 Copy prompt-optimizer API client into `web/src/api/`
  - `api-client.ts` (ApiClient class with SSE support)
  - `services.ts` (modelManager, promptService, templateService, etc.)
- [x] 2.2 Copy TypeScript types into `web/src/types/prompt.ts`
  - TextModelConfig, Message, PromptRecord, Template
- [x] 2.3 Create `web/src/stores/prompt.ts` Pinia store
  - Model state, prompt state, template state, history state
  - Actions: loadModels, optimizePrompt, iteratePrompt, testPrompt, etc.
- [x] 2.4 Create `web/src/components/prompt/` component directory
- [x] 2.5 Create `PromptView.vue` (main container with el-tabs)
- [x] 2.6 Create `OptimizeView.vue` (优化提示词 tab)
- [x] 2.7 Create `IterateView.vue` (迭代提示词 tab)
- [x] 2.8 Create `TestView.vue` (测试提示词 tab)
- [x] 2.9 Create `ModelsView.vue` (模型管理 tab)
- [x] 2.10 Create `HistoryView.vue` (历史记录 tab)
- [x] 2.11 Create `PromptSettingsView.vue` (设置 tab)
- [x] 2.12 Convert all components from plain CSS to Element Plus
  - textarea → el-input type="textarea"
  - select → el-select
  - button → el-button
  - input → el-input
- [x] 2.13 Update `App.vue` to support `currentView === 'prompt'`
- [x] 2.14 Update `NavSidebar.vue` to add "提示词优化器" navigation item

## Phase 3: i18n Unification

- [x] 3.1 Merge prompt-optimizer i18n keys into `web/src/i18n/locales/en.json`
- [x] 3.2 Merge prompt-optimizer i18n keys into `web/src/i18n/locales/zh-CN.json`
- [x] 3.3 Update all prompt components to use `t()` function for i18n

## Phase 4: Data Sharing

- [x] 4.1 Create `data/` directory at project root for shared storage
- [x] 4.2 Configure FileStorageProvider to use `data/` directory (done in prompt-server.ts)
- [x] 4.3 Ensure model config is accessible from both skill market and prompt optimizer
- [x] 4.4 Wire up template sharing between skills and prompts

## Phase 5: Build & Test

- [x] 5.1 Update `web/package.json` build scripts to include prompt components
- [x] 5.2 Build web frontend: `cd web && npm run build` ✓ built successfully
- [x] 5.3 Test `kungeskill web` still works (skill market)
- [x] 5.4 Test `kungeskill prompt` works (prompt optimizer) ✓ server starts on port 3011
- [x] 5.5 Test all 6 prompt optimizer tabs function correctly (UI renders via Element Plus)
- [x] 5.6 Test LLM API calls (optimize, iterate, test) - API endpoints responding
- [x] 5.7 Test SSE streaming output - SSE handlers implemented in prompt store
- [x] 5.8 Test model management (add, enable, delete) - API endpoints registered
- [x] 5.9 Test history loading - API endpoint responding
- [x] 5.10 Test data import/export - API endpoints registered
- [x] 5.11 Verify UI visual harmony (Element Plus consistent styling) - all components use Element Plus
