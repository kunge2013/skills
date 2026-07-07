## Why

The current "Browse Directory" dialog in SkillManage.vue and the directory picker in InstallDialog.vue have significant usability issues on Windows:

1. **No drive selector** — Users cannot easily switch between disk drives (C:\, D:\, etc.). The only way to navigate to a different drive is to manually type the full path.
2. **No parent/breadcrumb navigation** — The tree shows expandable children but offers no "go up" or breadcrumb to navigate to parent directories.
3. **Deep default path** — The dialog starts at the project's `.claude/skills` directory, making it tedious to browse to a completely different location.

These issues make it impractical to browse skills installed in arbitrary locations across the filesystem.

## What Changes

- **Add a cross-platform drive/volume listing API** (`GET /api/fs/drives`) that returns available drives on Windows (C:\, D:\, etc.) and mount roots on Unix (`/`).
- **Add a drive selector dropdown** to both the SkillManage browse dialog and InstallDialog directory picker.
- **Add breadcrumb navigation + "Up" button** to allow navigating to parent directories.
- **Replace the `el-tree` lazy-load approach** with a flat directory list at the current level, driven by the drive selector and breadcrumb navigation.
- **Extract a reusable `DirPicker.vue` component** shared by both SkillManage.vue and InstallDialog.vue.

## Capabilities

### New Capabilities
- `drive-listing`: Backend API to enumerate available filesystem drives/volumes cross-platform, consumed by frontend drive selector.
- `dir-picker-component`: Reusable directory picker UI component with drive selector, breadcrumb navigation, parent button, and flat directory listing.

### Modified Capabilities
- `skill-directory-browsing`: The browse directory dialog gains drive selector and breadcrumb navigation, changing how users navigate the filesystem (requirement change: navigation model shifts from tree-expand to drive-select + flat-list + breadcrumb).

## Impact

- **Backend**: `src/commands/web.js` — new `listDrives()` function and `/api/fs/drives` route handler; bridge script injection updated with `listDrives` method.
- **Frontend types**: `web/src/types/global.d.ts` — add `listDrives` to `window.api` interface.
- **Frontend components**:
  - New: `web/src/components/DirPicker.vue` — reusable directory picker.
  - Modified: `web/src/components/SkillManage.vue` — replace inline browse dialog with `DirPicker`.
  - Modified: `web/src/components/InstallDialog.vue` — replace inline tree picker with `DirPicker`.
- **i18n**: May need new translation keys for drive selector and breadcrumb labels.
