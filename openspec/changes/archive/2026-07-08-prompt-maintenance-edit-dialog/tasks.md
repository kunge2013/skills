# Tasks: Edit Template Dialog

## Implementation

- [x] Add `editTemplate` i18n key to `zh-CN.json` and `en.json`
- [x] Remove inline `<TemplateForm>` from template cards in `PromptMaintenanceView.vue`
- [x] Add `<el-dialog>` with `v-model="showEditDialog"` to `PromptMaintenanceView.vue`
- [x] Replace `editingTemplateId` with `showEditDialog` state, update `startEdit()` and `cancelEdit()`
- [x] Verify edit dialog works: open, edit, save, cancel, scroll behavior
- [x] Verify create form still works unchanged

## Bonus Improvements

- [x] Add fullscreen toggle for edit dialog
- [x] Move create form to dialog (improved UX beyond original scope)
- [x] Add fullscreen toggle for create dialog