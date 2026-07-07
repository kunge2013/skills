## Context

The current ModelsView component (`web/src/components/prompt/ModelsView.vue`) provides a basic add/delete/enable-toggle interface for model management. The backend already has a fully functional `PUT /models/:id` endpoint and `ModelManager.updateModel()` method that accepts partial updates. The frontend has `apiPut` available in the prompt store but no action method to call it for model updates.

Users currently must delete and recreate a model to change any configuration (API Key, Base URL, Model ID, display name), which is error-prone and loses the model ID if not carefully noted.

## Goals / Non-Goals

**Goals:**
- Enable inline editing of all model configuration fields from the ModelsView UI
- Reuse the existing `PUT /models/:id` backend API
- Maintain a consistent UX with the existing add-model form pattern
- Support editing without losing model identity (the `id` key must remain immutable during edits)

**Non-Goals:**
- No backend API changes — the existing `PUT /models/:id` handles partial updates
- No new provider discovery or validation logic — provider list remains static
- No model testing/verification during edit (that's a separate feature)
- No bulk edit or reorder capabilities

## Decisions

### 1. Inline edit vs. separate dialog
**Decision**: Use inline expandable edit form within each model card, matching the pattern of the existing `showAddModel` form.
**Rationale**: Keeps context visible (user sees which model they're editing), avoids modal overlay complexity, and is consistent with the existing add-model UI pattern.
**Alternatives considered**: A dialog/modal approach would work but adds overlay state management and could feel disconnected from the model list.

### 2. Store method vs. component-local API call
**Decision**: Add an `updateModel(key, updates)` action to the prompt store (`web/src/stores/prompt.ts`).
**Rationale**: The store already has `apiPut` imported, and model actions (`addModelEntry`, `toggleModel`, `deleteModel`) all live there. This keeps the API layer centralized.
**Alternatives considered**: Calling `apiPut` directly from the component would work but would break the existing pattern where all model operations go through the store.

### 3. Edit form field set
**Decision**: The edit form includes all fields from the add form: display name, protocol/provider, Model ID, API Key, Base URL. The model `id` itself is displayed but read-only.
**Rationale**: Matches user expectations — if you can set it on create, you should be able to change it. The `id` is immutable because it's the storage key.

### 4. Edit state management
**Decision**: Use component-local reactive state (`editingModelId` + `editForm`) rather than store state for edit mode tracking.
**Rationale**: Edit state is purely UI concern, doesn't need to be shared across components. Only one model can be edited at a time.

## Risks / Trade-offs

- [Model ID changes may break references] → The model `id` is kept read-only in the edit form, preventing accidental key changes that could orphan history records or template references.
- [Inline form may feel cramped on small screens] → The model card already uses a compact layout; the edit form will use `el-form` with `label-position="top"` for vertical stacking, which is space-efficient.
- [apiPut already exists in store but no updateModel action] → Adding a store action is a small change (~5 lines) but introduces a new public API. This is acceptable as it aligns with the existing CRUD pattern.
