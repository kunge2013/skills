## ADDED Requirements

### Requirement: Directory Tree Browsing
The system SHALL display a file tree for a selected skill's directory using a hierarchical tree component. The tree SHALL show all files and subdirectories under the skill's root directory, with file type icons distinguishing markdown, code, image, and other file types.

**MODIFIED**: The browse directory dialog in SkillManage.vue SHALL use a new navigation model consisting of:
1. A drive selector dropdown at the top for switching between filesystem drives
2. A breadcrumb navigation bar showing the current path with clickable segments
3. An "Up" button for navigating to the parent directory
4. A flat directory listing at the current level (replacing the previous el-tree lazy-load approach)

The default path SHALL be the project's `.claude/skills` directory, but users SHALL be able to navigate to any location via the drive selector, breadcrumb, or directory listing.

#### Scenario: User selects a skill to browse files
- **WHEN** user selects a skill from search results or skill list
- **THEN** a file tree is displayed showing all files and directories under the skill's root path

#### Scenario: User expands a subdirectory
- **WHEN** user clicks to expand a subdirectory in the tree
- **THEN** the subdirectory's contents are revealed inline

#### Scenario: User opens the browse directory dialog
- **WHEN** user clicks "Browse Directory" in SkillManage
- **THEN** the dialog opens with the drive selector set to the current drive, breadcrumb showing the default path, and directory listing displayed

#### Scenario: User switches drives in the browse dialog
- **WHEN** the user selects a different drive from the dropdown
- **THEN** the breadcrumb resets to show the new drive root and the directory listing updates to show its contents

#### Scenario: User navigates via breadcrumb
- **WHEN** the user clicks a breadcrumb segment
- **THEN** the current path changes to that level and the directory listing updates

#### Scenario: User navigates via Up button
- **WHEN** the user clicks the Up button
- **THEN** the current path changes to the parent directory and the directory listing updates

#### Scenario: User clicks a directory in the listing
- **WHEN** the user clicks a directory entry in the flat listing
- **THEN** the current path changes to that directory and the listing updates to show its contents

#### Scenario: User confirms path selection
- **WHEN** the user clicks "Load Skills"
- **THEN** the dialog closes and the selected directory's files are loaded in the left panel

#### Scenario: Skill directory is empty or inaccessible
- **WHEN** the selected skill's directory has no files or cannot be read
- **THEN** a message is displayed indicating the directory is empty or inaccessible

### Requirement: File Selection from Tree
Users SHALL be able to click any file node in the directory tree to open that file in the editor panel. Only editable file types (`.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.js`, `.ts`, `.py`, `.go`, `.rs`, `.css`, `.html`, `.vue`, `.tsx`, `.jsx`) SHALL be openable in the editor.

#### Scenario: User clicks an editable file
- **WHEN** user clicks a file node with an editable extension
- **THEN** the file content is loaded into the editor panel

#### Scenario: User clicks a non-editable file
- **WHEN** user clicks a file node with a non-editable extension (e.g., `.png`, `.exe`)
- **THEN** no editor is opened and a tooltip indicates the file is not editable
