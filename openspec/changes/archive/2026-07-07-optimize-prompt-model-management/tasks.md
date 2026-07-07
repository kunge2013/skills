## 1. Store Layer — Add updateModel Action

- [x] 1.1 Add `updateModel(key, updates)` action to `web/src/stores/prompt.ts` that calls `apiPut(/models/${key}, updates)` and reloads the model list
- [x] 1.2 Add `editingModelId` and `editForm` to the store state for edit form management

## 2. UI — ModelsView Edit Form

- [x] 2.1 Add "Edit" button to each model card in `web/src/components/prompt/ModelsView.vue`
- [x] 2.2 Implement expandable edit form within model cards, pre-filled with current model values
- [x] 2.3 Add "Save" and "Cancel" buttons to the edit form
- [x] 2.4 Wire edit form Save button to the store's `updateModel` action
- [x] 2.5 Implement single-edit-mode logic (editing one model collapses any other edit/add forms)

## 3. i18n — Add Edit-Related Translations

- [x] 3.1 Add edit-related keys to `web/src/i18n/locales/zh-CN.json` (编辑、保存、取消、模型ID不可修改等)
- [x] 3.2 Add corresponding keys to `web/src/i18n/locales-prompt/en.json`
- [x] 3.3 Update ModelsView.vue to use i18n keys for all edit form labels and buttons

## 4. Verification

- [x] 4.1 Start the web server and verify edit form opens/closes correctly
- [x] 4.2 Test saving edited model with various field changes and confirm persistence
- [x] 4.3 Test cancel behavior (no API call, form collapses)
- [x] 4.4 Test switching edit targets (unsaved changes discarded)
- [x] 4.5 Test concurrent add-model and edit-model forms (only one open at a time)
