## Context

The Prompt Optimizer currently has tabs for Optimize, Iterate, Test, Models, History, and Settings, but no dedicated interface for managing custom prompt templates. The backend already has full CRUD APIs for templates (`POST/PUT/DELETE /templates`) and the `TemplateManager` class supports `createTemplate`, `updateTemplate`, and `deleteTemplate`. The missing piece is the frontend UI for template management.

Additionally, users currently have to manually copy-paste prompts from templates into the Optimize tab. A direct "Optimize" action from the maintenance list would streamline this workflow.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated "Prompt Maintenance" tab with full CRUD for prompt templates
- Allow users to select any template and jump to the Optimize tab with its content pre-filled
- Reuse existing backend CRUD APIs (no backend API changes needed)
- Support both system prompt and user prompt editing

**Non-Goals:**
- No template versioning or history tracking
- No template sharing/export/import (the Settings tab already has data export/import)
- No template preview or testing from the maintenance view (use the Test tab for that)
- No modification of built-in templates (only custom templates are editable/deletable)

## Decisions

### 1. Tab placement
**Decision**: Add a new "维护" (Maintenance) tab in PromptView, positioned between "测试" (Test) and "模型" (Models).
**Rationale**: Follows the existing tab pattern. The maintenance tab is a peer to the other functional tabs.
**Alternatives considered**: A separate page outside PromptView would break the single-page flow. Placing it as a tab keeps everything in one place.

### 2. Built-in vs. custom template handling
**Decision**: Built-in templates (loaded from `createDefaultTemplates()`) are displayed as read-only. Only custom templates (stored via API) can be edited or deleted. The "Optimize" button is available for all templates.
**Rationale**: Protects system defaults from accidental modification while still allowing users to use them as optimization sources. The backend already distinguishes built-in from custom templates (built-ins are not in storage).

### 3. "Optimize from maintenance" flow
**Decision**: Clicking "Optimize" on a template sets the store's `optimizeInput` to the template's system content, switches the active tab to "optimize", and triggers no API call. The user can then click the optimize button to run the actual optimization.
**Rationale**: Uses existing store state (`optimizeInput`, `selectedModelKey`) rather than creating a new API endpoint. The tab switch requires the parent `PromptView` to expose a way to change the active tab — this can be done via a store state or an event.

### 4. Store vs. component-local state for templates
**Decision**: Add template CRUD actions (`createTemplate`, `updateTemplate`, `deleteTemplate`) to the prompt store, following the existing pattern for models. The template list is already loaded via `loadTemplates()`.
**Rationale**: Keeps all API interactions centralized in the store. The component just calls store actions and reacts to state changes.

### 5. Rich text editor for prompt content
**Decision**: Use `md-editor-v3` (already in project dependencies) as the rich text editor for system prompt and user prompt fields in the create/edit forms.
**Rationale**: The project already has `md-editor-v3` and `marked` in `web/package.json`, indicating markdown editing is a known requirement. Prompt templates benefit from markdown formatting (code blocks, lists, headers). Using a rich editor provides syntax highlighting, preview, and formatting toolbar.
**Alternatives considered**: Plain `<textarea>` is simpler but lacks formatting support. A separate markdown editor library would add duplicate dependencies.

### 6. Form design
**Decision**: Use an inline expandable form (similar to the model edit pattern from the previous change) rather than a dialog. The form includes: name, type selector, system prompt (md-editor-v3), user prompt (md-editor-v3, optional).
**Rationale**: Consistent UX with the existing model management. Dialogs add overlay complexity and break the flow.

## Risks / Trade-offs

- [Built-in template identification] → The backend returns all templates (builtin + custom) merged. The frontend needs to distinguish them. Mitigation: compare template IDs against the known built-in list, or add an `isBuiltin` flag to the API response.
- [Tab switching from child component] → The `PromptView` manages `activeTab` as local ref. To switch from a child, we'll move it to the store or use an event emitter. Moving to store is cleaner.
- [Long template content in list view] → Template system prompts can be very long. The list view will show truncated content (first 100 chars) with the full content visible only in edit mode.
