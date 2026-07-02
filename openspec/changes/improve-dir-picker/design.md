## Context

The project is a skill management web UI (Vue 3 + Element Plus + TypeScript) served by a lightweight Node.js HTTP server. Two components currently implement directory picking:

1. **SkillManage.vue** (line 127-155): "Browse Directory" dialog with `el-tree` lazy-loading. Starts at the project's `.claude/skills` directory. No drive switching, no breadcrumb.
2. **InstallDialog.vue** (line 50-67): Directory tree for install target selection. Hardcoded `browseDir('/')` as root. Uses `el-tree` with lazy loading.

Both use `window.api.listDirs(path)` which calls `POST /api/fs/dirs` → `listDirectories()` in `web.js`. The backend returns children with a `parent` field that is never used in the UI.

The backend has no mechanism to enumerate available drives/volumes.

## Goals / Non-Goals

**Goals:**
- Add cross-platform drive listing API (Windows: drive letters, Unix: `/`)
- Replace tree-based navigation with drive selector + breadcrumb + flat listing
- Extract a reusable `DirPicker.vue` component shared by both SkillManage and InstallDialog
- Improve UX: quick drive switching, easy parent navigation, clear current path

**Non-Goals:**
- No changes to file editing, save logic, or linked files parsing
- No changes to the skill installation/uninstallation backend logic
- No file tree view inside subdirectories (flat listing at each level, click to enter)
- No persistent bookmarks or favorites for paths

## Decisions

### Decision 1: Drive enumeration approach
**Choice**: Use `child_process.execSync` with platform-specific commands.
- **Windows**: `fsutil fsinfo drives` — parse output like `Drives: C:\ D:\ E:\`
- **Linux/Mac**: Return `["/"]` as single root. Alternative would be parsing `/proc/mounts` or `df`, but that produces too many entries (tmpfs, proc, sys, etc.). The root `/` is sufficient for Unix navigation.

**Alternative considered**: Using `os` module's `homedir()` — insufficient, it only returns one path. `fs.readdirSync('/')` — only works on Unix and doesn't enumerate drives on Windows.

### Decision 2: Flat listing vs. tree
**Choice**: Flat directory listing at the current level. Click a subdirectory to "enter" it. The drive selector + breadcrumb + Up button provide navigation. This replaces the `el-tree` lazy-load approach entirely.

**Rationale**: The tree approach conflates navigation with expansion. Users can't easily see "where they are" in a deep tree. Flat listing with explicit path navigation is clearer and simpler.

**Alternative considered**: Keep `el-tree` but add drive selector and breadcrumb above it. This would be more complex (two navigation models simultaneously) and the tree's lazy loading doesn't map well to the "current path" concept.

### Decision 3: Reusable component as separate file
**Choice**: Create `web/src/components/DirPicker.vue` as a standalone component. Both SkillManage and InstallDialog import it. The component uses `v-model` for the selected path and emits `confirm`/`cancel` events.

**Rationale**: Both consumers need identical navigation logic (drive list, breadcrumb, flat listing). Duplicating this in two places would create maintenance burden.

### Decision 4: Backend route method
**Choice**: `POST /api/fs/drives` (not GET) to be consistent with existing API patterns in web.js. All current endpoints use POST with JSON bodies.

### Decision 5: DirPicker component props/events interface
```
Props:
  modelValue: boolean (visibility control)
  initialPath: string (default starting path)
  confirmText: string (default "加载技能")
  cancelText: string (default "取消")

Events:
  confirm: (path: string) => void
  update:modelValue: (visible: boolean) => void
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `fsutil` not available on some Windows editions (e.g., Home) | Fallback to `wmic logicaldisk get name` |
| Permission errors when listing drive root on Windows | Catch error, show "Access denied" message, don't crash |
| Very deep paths cause breadcrumb overflow | CSS `overflow-x: auto` with horizontal scroll |
| Large directories (hundreds of subdirs) cause slow rendering | Virtual scrolling not needed initially; if directories exceed ~200 items, add pagination or search filter |
| InstallDialog's tree picker behavior changes (users may expect inline expansion) | Document the change in release notes; flat navigation is clearer for install target selection too |
