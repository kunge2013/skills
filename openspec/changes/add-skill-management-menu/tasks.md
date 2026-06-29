## 1. Type Definitions and API Layer

- [ ] 1.1 Add new types in `types/skill.ts`: `DirectoryNode`, `FileInfo`, `LinkedFileReference`, `BatchSaveResult`
- [ ] 1.2 Extend `types/global.d.ts` with new IPC methods: `listSkillDirectory`, `listSkillFiles`, `parseReferences`, `batchSaveFiles`
- [ ] 1.3 Implement IPC handlers in main process for directory listing and file operations *(types added; handlers need implementation in kungeskill main process)*

## 2. Store Actions

- [ ] 2.1 Add state fields in `skills.ts`: `manageView` flag, `directoryTree`, `linkedFiles`, `modifiedFiles` map
- [ ] 2.2 Add actions: `fetchSkillDirectory(path)`, `parseSkillReferences(content)`, `loadSkillFile(path)`, `trackFileChange(path, content)`, `saveModifiedFiles()`, `handleSaveConflict(path)`
- [ ] 2.3 Add `setView('manage')` support alongside existing view types

## 3. SkillManage Component

- [ ] 3.1 Create `web/src/components/SkillManage.vue` with three-panel layout: search | file tree | editor
- [ ] 3.2 Implement search panel with debounce, keyword input, and result list
- [ ] 3.3 Implement file tree using `el-tree` with file type icons and lazy loading
- [ ] 3.4 Implement editor area (reuse `MdEditor` from SkillEditor) with multi-file tab/switch support
- [ ] 3.5 Add linked files list panel that appears when skill.md is open
- [ ] 3.6 Add modified file indicators in tree and linked files list
- [ ] 3.7 Add "Save All" button with batch save progress and error handling

## 4. Navigation Integration

- [ ] 4.1 Add "Skill Management" menu item to `NavSidebar.vue`
- [ ] 4.2 Update `App.vue` to route `'manage'` view to `SkillManage` component
- [ ] 4.3 Add i18n keys for all new UI strings (en + zh-CN)

## 5. Reference Parser Utility

- [ ] 5.1 Create `web/src/utils/referenceParser.ts` with `parseReferences(markdown: string, basePath: string): LinkedFileReference[]`
- [ ] 5.2 Support markdown image syntax: `![alt](./path/file)`
- [ ] 5.3 Support markdown link syntax: `[text](./path/file)` (relative paths only)
- [ ] 5.4 Support include syntax: `{{include:./path/file}}`
- [ ] 5.5 Add unit tests for parser

## 6. Conflict Resolution Dialog

- [ ] 6.1 Create `web/src/components/SaveConflictDialog.vue` with overwrite/reload/skip options
- [ ] 6.2 Wire dialog into batch save flow in store

## 7. Verification

- [ ] 7.1 Run `npm run build` and verify no TypeScript errors
- [ ] 7.2 Manually test: search skills, browse directory, edit skill.md, edit referenced files, save all
- [ ] 7.3 Test conflict resolution flow by modifying a file on disk during editing session
