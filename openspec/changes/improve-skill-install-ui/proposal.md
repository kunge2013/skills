## Why

The current web UI only supports installing skills via symlinks into the default `.claude/skills/` directory. Users need the flexibility to:

1. **Choose a custom target directory** — skills may need to be installed into non-standard locations (e.g., monorepo sub-projects, shared team directories).
2. **Choose copy mode** — symlinks don't work well in some scenarios: cross-drive Windows, distributed teams sharing a repo, or when skills must be self-contained in the project without external dependencies.

This change improves the "skill query → install" flow in the web UI to support both modes and explicit target directory selection.

## What Changes

- **Install dialog**: When clicking "Install" on a skill, a dialog appears allowing the user to select the target directory and install mode (symlink or copy).
- **Copy mode support**: New backend API to recursively copy skill files into the chosen directory, independent of the source.
- **Uninstall for copy mode**: Deleting copied files (vs. removing symlinks) when uninstalling.
- **Install status indicator**: The UI shows whether a skill is installed as a symlink or a copy in the current project.

## Capabilities

### New Capabilities

- `skill-install-modes`: Supports both symlink and copy installation modes with user-selectable target directory. Covers the install dialog UI, backend copy logic, and install status reporting.

### Modified Capabilities

*(none — this is a new capability)*

## Impact

- **Backend**: `src/commands/web.js` — new API endpoint `/api/skill/install` replacing `/api/symlink/install`, `src/core/symlink.js` — expose existing `copyDirRecursive` for use, new `src/core/copy-install.js` for copy-mode logic.
- **Frontend**: `web/src/components/SkillDetail.vue` — install button triggers a dialog instead of direct install, `web/src/stores/skills.ts` — new store actions for install mode selection, `web/src/i18n/` — new translation keys for dialog text.
- **Types**: `web/src/types/skill.ts` — new `InstallMode` type and extended `SkillValidation`.
- **No breaking changes** — existing CLI commands (`skills install`) remain unchanged.
