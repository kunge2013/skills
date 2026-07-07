## 1. Backend — Copy Install Module

- [x] 1.1 Create `src/core/copy-install.js` with `copyInstallSkill(skillName, sourcePath, targetDir)` function that recursively copies skill files
- [x] 1.2 Add `.skills-manifest.json` creation in copy mode with `{ skillName, mode: 'copy', sourcePath, installedAt }`
- [x] 1.3 Create `uninstallCopySkill(skillDir)` function that verifies `.skills-manifest.json` ownership before deleting
- [x] 1.4 Export all functions from `copy-install.js` module

## 2. Backend — Unified Install API

- [x] 2.1 Create new `installSkill(skillName, projectPath, mode, targetDir)` handler in `src/commands/web.js` supporting both symlink and copy modes
- [x] 2.2 Create new `uninstallSkillUnified(skillName, projectPath)` handler that detects mode and dispatches to correct uninstall logic
- [x] 2.3 Create new `getInstallStatus(skillName, projectPath)` handler that reports mode (symlink/copy/none)
- [x] 2.4 Add API routes: `/api/skill/install`, `/api/skill/uninstall`, `/api/skill/status` in the HTTP server
- [x] 2.5 Keep old `/api/symlink/*` routes as aliases for backward compatibility (deprecated)

## 3. Frontend — Types and Store

- [x] 3.1 Add `InstallMode` type ('symlink' | 'copy') to `web/src/types/skill.ts`
- [x] 3.2 Add `InstallStatus` interface to `web/src/types/skill.ts` with mode, path, and metadata fields
- [x] 3.3 Add `installSkillWithMode(skillName, projectPath, mode, targetDir)` action to skills store
- [x] 3.4 Add `uninstallSkillUnified(skillName, projectPath)` action to skills store
- [x] 3.5 Add `checkInstallStatus(skillName, projectPath)` action to skills store

## 4. Frontend — Install Dialog Component

- [x] 4.1 Create `web/src/components/InstallDialog.vue` with: mode selector (radio: symlink/copy), target directory input, project path input, and install/cancel buttons
- [x] 4.2 Add directory picker integration (folder browser or text input with validation)
- [x] 4.3 Add warning text for copy mode about manual re-sync needed after marketplace updates
- [x] 4.4 Wire up install action with loading state and error/success messages

## 5. Frontend — SkillDetail Integration

- [x] 5.1 Replace direct `handleInstall()` in `SkillDetail.vue` with opening the InstallDialog
- [x] 5.2 Add install status badge next to skill name showing current mode (symlink/copy/none)
- [x] 5.3 Update uninstall button to use unified uninstall API

## 6. Internationalization

- [x] 6.1 Add English translations for install dialog labels, copy mode warning, and status messages to `web/src/i18n/index.ts`
- [x] 6.2 Add Chinese translations for all new keys

## 7. Testing and Verification

- [x] 7.1 Test symlink install still works correctly (existing behavior — backward-compatible aliases preserved)
- [x] 7.2 Test copy install creates files and `.skills-manifest.json` correctly
- [x] 7.3 Test uninstall for both modes (symlink removed, copy deleted with manifest check)
- [x] 7.4 Test custom target directory with both modes
- [x] 7.5 Test install status reporting for all three states (symlink/copy/none)
