# Design: Edit Template Dialog

## Architecture

```
┌─ App.vue: .main-content ────────────────────────────┐
│                                                      │
│  提示词维护  [+ 创建模板]                              │
│                                                      │
│  ┌─ Template Card ───────────────────────────────┐   │
│  │  prompt-v1  [optimize]                        │   │
│  │  [Optimize] [编辑] [删除]                      │   │
│  │  预览文本...                                   │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│              ┌─ el-dialog ───────────────────────┐  │
│              │  编辑模板：prompt-v1              │  │
│              │                                    │  │
│              │  模板名称: [prompt-v1] (disabled)  │  │
│              │  模板类型: [optimize ▼]            │  │
│              │  系统提示词:                        │  │
│              │  ┌─ MdEditor (300px) ──────────┐  │  │
│              │  │                              │  │  │
│              │  └──────────────────────────────┘  │  │
│              │  用户提示词:                        │  │
│              │  ┌─ MdEditor (200px) ──────────┐  │  │
│              │  │                              │  │  │
│              │  └──────────────────────────────┘  │  │
│              │                                    │  │
│              │  [保存]  [取消]                     │  │
│              └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## State Changes

### Before
```typescript
const editingTemplateId = ref<string | null>(null)  // v-if guard on inline form
```

### After
```typescript
const showEditDialog = ref(false)  // controls el-dialog v-model
```

## Component Changes

### PromptMaintenanceView.vue

**Template changes:**
- Remove `<TemplateForm v-if="editingTemplateId === template.id">` from inside template cards
- Add `<el-dialog>` with `v-model="showEditDialog"` wrapping `<TemplateForm>`
- Dialog props: `width="800px"`, `:close-on-click-modal="false"`, `@close="cancelEdit"`
- Dialog title: `t('prompt.editTemplate', { name: editForm.name })`

**Logic changes:**
- `startEdit(template)`: populate `editForm` reactive, set `showEditDialog.value = true`
- `cancelEdit()`: set `showEditDialog.value = false`
- `onUpdate()`: save data, then `cancelEdit()`
- Keep inline "Create Template" form unchanged

### TemplateForm.vue
No changes needed. Already emits `save` and `cancel` events that work with the dialog wrapper.

### i18n

**zh-CN.json** — add to `prompt` section:
```json
"editTemplate": "编辑模板：{name}"
```

**en.json** — add to `prompt` section:
```json
"editTemplate": "Edit Template: {name}"
```

## Dialog Behavior

| Property | Value | Rationale |
|----------|-------|-----------|
| `width` | `800px` | Gives MdEditor enough horizontal space |
| `close-on-click-modal` | `false` | Prevents accidental dismissal with unsaved edits |
| `close` event | calls `cancelEdit()` | Resets state when dialog closes via X or Escape |
| Internal scroll | automatic | Dialog content exceeds viewport; scroll handles it |
