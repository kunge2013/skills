## Context

The web UI currently installs skills via a single `installSkill(skillName, projectPath)` API that always creates symlinks in `.claude/skills/`. The backend has `copyDirRecursive` already available in `symlink.js` but it's unused. The install button in `SkillDetail.vue` triggers an immediate install with no user choice.

## Goals / Non-Goals

**Goals:**
- Users can choose between symlink and copy install modes via a dialog
- Users can specify a custom target directory (defaults to `.claude/skills/`)
- Backend correctly handles both modes with proper error handling
- Uninstall works correctly for both modes
- Install status is visible in the UI (shows mode: symlink vs copy)

**Non-Goals:**
- CLI commands remain unchanged — this is a web-UI-only change
- No migration of existing symlink-installed skills to copy mode
- No support for installing multiple skills at once (batch install)
- No validation of target directory writability before install attempt

## Decisions

### 1. Unified install API endpoint

**Decision:** Replace `/api/symlink/install` with `/api/skill/install` that accepts `{ skillName, projectPath, mode: 'symlink' | 'copy', targetDir? }`.

**Rationale:** Keeps the API surface clean while supporting both modes. The `mode` field defaults to `'symlink'` for backward compatibility.

**Alternatives considered:**
- Separate endpoints (`/api/symlink/install` + `/api/copy/install`) — more explicit but duplicates routing logic
- Adding a new endpoint and deprecating the old — unnecessary churn since we control both client and server

### 2. Target directory resolution

**Decision:** If `targetDir` is not provided or empty, resolve to `findProjectSkillsDir(projectPath)`. If provided, validate it exists and is writable before installing.

**Rationale:** Preserves existing default behavior while allowing override. Validation prevents confusing errors mid-install.

### 3. Copy mode implementation

**Decision:** Extract `copyDirRecursive` from `symlink.js` into a new `copyInstall.js` module. The copy installs all files from the skill source into `targetDir/skillName/`, preserving the `SKILL.md` structure.

**Rationale:** Separates concerns — symlink.js stays focused on symlink operations. Copy logic needs additional behavior (tracking what was copied for uninstall) that doesn't belong in symlink.js.

### 4. Install tracking

**Decision:** Create a `.skills-manifest.json` file in the target directory for copy-mode installs, recording `{ skillName, mode: 'copy', sourcePath, installedAt }`. Symlink installs remain detectable via `lstat`.

**Rationale:** Copy-mode skills are indistinguishable from regular directories without metadata. The manifest enables correct uninstall and status reporting.

### 5. Uninstall for copy mode

**Decision:** For copy mode, read `.skills-manifest.json` to verify the directory was installed by us, then `fs.rmSync` the skill directory. If no manifest exists and it's not a symlink, refuse to delete with an error.

**Rationale:** Prevents accidental deletion of user-created or manually-copied skill directories.

## Risks / Trade-offs

- **[Risk]** Copy mode duplicates files, so skills won't auto-update when the marketplace updates. → **Mitigation:** UI shows a warning in copy mode suggesting periodic re-install.
- **[Risk]** `.skills-manifest.json` could be edited or removed by users, breaking uninstall detection. → **Mitigation:** Fallback to checking directory contents (presence of `SKILL.md` with matching name).
- **[Risk]** Large skills with many files take longer to copy than symlink. → **Mitigation:** Acceptable trade-off; skills are typically small text files. Show loading indicator during copy.
- **[Trade-off]** Symlink vs copy is a per-install decision, not a global setting. Users must choose each time. → **Acceptable:** A global default could be added later if users request it.
