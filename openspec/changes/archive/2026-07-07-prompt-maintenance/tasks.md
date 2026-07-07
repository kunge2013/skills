## 1. Store Layer — Add Template CRUD Actions

- [x] 1.1 Add `createTemplate(template)`, `updateTemplate(id, updates)`, `deleteTemplate(id)` actions to `web/src/stores/prompt.ts`
- [x] 1.2 Add `isBuiltin` flag logic to distinguish built-in from custom templates in the store
- [x] 1.3 Add `activePromptTab` to store state to allow tab switching from child components
- [x] 1.4 Add `selectAndOptimize(template)` action that sets `optimizeInput` and switches to optimize tab

## 2. UI — PromptMaintenanceView Component

- [x] 2.1 Create `web/src/components/prompt/PromptMaintenanceView.vue` with template list display
- [x] 2.2 Add template card with name, type, truncated preview, and built-in badge
- [x] 2.3 Add create form (name, type selector, system/user prompt via md-editor-v3, save/cancel)
- [x] 2.4 Add inline edit form for custom templates (md-editor-v3 for prompt content, edit/save/cancel buttons)
- [x] 2.5 Add delete button with confirmation for custom templates
- [x] 2.6 Add "Optimize" button on all templates that triggers `selectAndOptimize`

## 3. UI — Integrate into PromptView

- [x] 3.1 Add "维护" (Maintenance) tab to `PromptView.vue` importing `PromptMaintenanceView`
- [x] 3.2 Bind `activeTab` to store's `activePromptTab` for cross-tab navigation
- [x] 3.3 Ensure tab switching from maintenance to optimize works correctly

## 4. i18n — Add Maintenance Translations

- [x] 4.1 Add maintenance keys to `web/src/i18n/locales/zh-CN.json` (维护、创建、模板名称、系统提示词、用户提示词、类型、内置等)
- [x] 4.2 Add corresponding keys to `web/src/i18n/locales/en.json`

## 5. Verification

- [x] 5.1 Start the web server and verify maintenance tab loads with template list
- [x] 5.2 Test creating a new template and confirm it appears in the list
- [x] 5.3 Test editing a custom template and confirm changes persist
- [x] 5.4 Test deleting a custom template with confirmation
- [x] 5.5 Verify built-in templates show no edit/delete buttons
- [x] 5.6 Test "Optimize" button switches to optimize tab with pre-filled content
