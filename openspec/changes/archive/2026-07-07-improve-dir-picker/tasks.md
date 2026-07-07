## 1. Backend API Changes

- [x] 1.1 Add `listDrives()` function in `src/commands/web.js` — cross-platform drive enumeration (Windows: `fsutil fsinfo drives`, Unix: return `/`)
- [x] 1.2 Add `POST /api/fs/drives` route handler calling `listDrives()`
- [x] 1.3 Add `listDrives` method to the `window.api` bridge script injected into `index.html`
- [x] 1.4 Add `listDrives` type declaration in `web/src/types/global.d.ts`

## 2. Create DirPicker Reusable Component

- [x] 2.1 Create `web/src/components/DirPicker.vue` with props (`modelValue`, `initialPath`, `confirmText`, `cancelText`) and events (`confirm`, `update:modelValue`)
- [x] 2.2 Implement drive selector dropdown (`el-select`) populated via `window.api.listDrives()`
- [x] 2.3 Implement breadcrumb navigation bar with clickable path segments
- [x] 2.4 Implement "Up" button (disabled at drive root)
- [x] 2.5 Implement flat directory listing via `window.api.listDirs()`, sorted alphabetically, with folder icons
- [x] 2.6 Add loading state, empty directory message, and error handling
- [x] 2.7 Add confirm/cancel buttons with proper event emission

## 3. Refactor SkillManage.vue

- [x] 3.1 Remove existing browse dialog (el-tree based, lines 127-155) and related state/functions
- [x] 3.2 Import and integrate `DirPicker.vue` component
- [x] 3.3 Wire DirPicker `confirm` event to `loadDirectory(path)` and close dialog
- [x] 3.4 Set DirPicker `initialPath` to default skills directory on open

## 4. Refactor InstallDialog.vue

- [x] 4.1 Remove existing directory tree picker (lines 50-67) and related state/functions (`browseDir`, `loadNode`, `onDirSelect`)
- [x] 4.2 Import and integrate `DirPicker.vue` component
- [x] 4.3 Wire DirPicker `confirm` event to set `form.targetDir`
- [x] 4.4 Set DirPicker `initialPath` to `form.targetDir` or `/`

## 5. Verification

- [x] 5.1 Run `cd web && npm run build` — verify no TypeScript errors
- [x] 5.2 Run `npm run web` — manually verify drive selector, breadcrumb, Up button, and directory listing in both SkillManage and InstallDialog
