## 1. Skills Store — Add promptMaintenance View

- [x] 1.1 Add `'promptMaintenance'` to `currentView` type in `web/src/stores/skills.ts`
- [x] 1.2 Add `setView('promptMaintenance')` support (already exists via generic `setView`)

## 2. NavSidebar — Add Maintenance Menu Item

- [x] 2.1 Add "提示词维护" menu item to `web/src/components/NavSidebar.vue` with appropriate icon
- [x] 2.2 Wire menu selection to `store.setView('promptMaintenance')`
- [x] 2.3 Add active state highlighting for the new menu item

## 3. App.vue — Render PromptMaintenanceView

- [x] 3.1 Add `v-else-if="store.currentView === 'promptMaintenance'"` branch in `web/src/App.vue` rendering `PromptMaintenanceView`

## 4. PromptView — Remove Maintenance Tab

- [x] 4.1 Remove "维护" tab from `web/src/components/prompt/PromptView.vue`
- [x] 4.2 Remove `PromptMaintenanceView` import from PromptView
- [x] 4.3 Clean up `activePromptTab` state if no longer needed for maintenance navigation

## 5. i18n — Add Menu Translation

- [x] 5.1 Add `nav.promptMaintenance` key to `web/src/i18n/locales/zh-CN.json`
- [x] 5.2 Add corresponding key to `web/src/i18n/locales/en.json`

## 6. Verification

- [x] 6.1 Verify maintenance menu item appears in sidebar and is clickable
- [x] 6.2 Verify maintenance page loads correctly from menu
- [x] 6.3 Verify maintenance tab is no longer visible in PromptView
- [x] 6.4 Verify all other PromptView tabs still work
