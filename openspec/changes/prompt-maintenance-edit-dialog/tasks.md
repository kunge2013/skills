# Tasks: Edit Template Dialog

## Implementation

- [ ] Add `editTemplate` i18n key to `zh-CN.json` and `en.json`
- [ ] Remove inline `<TemplateForm>` from template cards in `PromptMaintenanceView.vue`
- [ ] Add `<el-dialog>` with `v-model="showEditDialog"` to `PromptMaintenanceView.vue`
- [ ] Replace `editingTemplateId` with `showEditDialog` state, update `startEdit()` and `cancelEdit()`
- [ ] Verify edit dialog works: open, edit, save, cancel, scroll behavior
- [ ] Verify create form still works unchanged
