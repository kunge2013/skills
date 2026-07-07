## Context

The current app has a left sidebar (NavSidebar) with 3 menu items: 全部技能, 提示词优化器, 技能管理. The "提示词维护" feature was recently added as a tab inside PromptView, but the user wants it as a standalone menu item at the same level as the others. The skills store uses `currentView` state (`'list' | 'detail' | 'editor' | 'manage' | 'prompt'`) to control which page is displayed in the main content area.

## Goals / Non-Goals

**Goals:**
- Move "提示词维护" from a PromptView tab to a top-level navigation menu item
- Reuse the existing `PromptMaintenanceView` component — no UI changes to the maintenance page itself
- Keep the prompt optimizer tabs clean (optimize, iterate, test, models, history, settings)

**Non-Goals:**
- No changes to the PromptMaintenanceView component itself
- No changes to backend APIs or store CRUD logic
- No reorganization of other prompt optimizer tabs

## Decisions

### 1. View vs. tab
**Decision**: Add `'promptMaintenance'` as a new `currentView` type in the skills store, similar to how `'prompt'` and `'manage'` work.
**Rationale**: The existing navigation pattern uses `currentView` to switch between pages. Adding a new view type is the cleanest approach — it reuses the same pattern as all other menu items.
**Alternatives considered**: Using Vue Router would be more complex for this single-page app. A sub-tab within prompt would defeat the purpose.

### 2. PromptView maintenance tab removal
**Decision**: Remove the "维护" tab from PromptView entirely. The `activePromptTab` state in the prompt store can be simplified since it no longer needs to support `'maintenance'`.
**Rationale**: Eliminates redundancy and keeps the prompt optimizer focused on its core functions.

### 3. Data loading
**Decision**: The PromptMaintenanceView component already calls `store.loadTemplates()` on mount. No additional data preloading is needed in App.vue.
**Rationale**: The prompt store's `loadAll()` is already called on app mount, which includes templates.

## Risks / Trade-offs

- [activePromptTab state becomes partially unused] → The `activePromptTab` store state was introduced to support cross-tab navigation from maintenance to optimize. After this change, maintenance is no longer a tab, so the tab-switching logic is no longer needed for that purpose. However, it may still be useful for programmatic tab navigation (e.g., after creating a template, switching to optimize). We'll keep it but remove the maintenance-related parts.
