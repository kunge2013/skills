## ADDED Requirements

### Requirement: Directory Tree Browsing
The system SHALL display a file tree for a selected skill's directory using a hierarchical tree component. The tree SHALL show all files and subdirectories under the skill's root directory, with file type icons distinguishing markdown, code, image, and other file types.

#### Scenario: User selects a skill to browse files
- **WHEN** user selects a skill from search results or skill list
- **THEN** a file tree is displayed showing all files and directories under the skill's root path

#### Scenario: User expands a subdirectory
- **WHEN** user clicks to expand a subdirectory in the tree
- **THEN** the subdirectory's contents are revealed inline

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
