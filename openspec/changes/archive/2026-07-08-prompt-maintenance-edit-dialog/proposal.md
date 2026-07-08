# Prompt Maintenance: Edit Template Dialog

Move the template edit form from inline card layout to an `el-dialog` modal, fixing invisible save buttons and improving visual design.

## Problem

1. **Save/Update buttons invisible**: The edit form (with two MdEditor instances at 300px + 200px) renders inside a template card. The parent `.main-content { overflow: hidden }` clips content beyond the viewport, hiding the save/cancel buttons at the bottom of the form.

2. **Poor visual design**: The inline edit form has no visual separation from the template preview — no border, no background, no shadow — making the UI look flat and unpolished.

## Solution

Replace the inline edit form with an `el-dialog` modal:

- Clicking "Edit" opens a dialog containing the `TemplateForm`
- Dialog width: `800px`, content scrolls internally when editors overflow
- Save/cancel buttons always visible within the scrollable dialog
- Inline "Create Template" form remains unchanged (stays as card)

## Scope

- `PromptMaintenanceView.vue`: Remove inline edit form, add `el-dialog`
- `i18n/locales/zh-CN.json`: Add `prompt.editTemplate` key
- `i18n/locales/en.json`: Add `prompt.editTemplate` key
- `TemplateForm.vue`: No changes needed
