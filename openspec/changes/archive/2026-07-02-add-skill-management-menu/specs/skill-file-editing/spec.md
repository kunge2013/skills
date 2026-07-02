## ADDED Requirements

### Requirement: Skill.md Reference Parsing
When a user opens a skill.md file for editing, the system SHALL parse the content to identify relative file references. References SHALL include markdown image syntax (`![alt](./path/file)`), markdown link syntax (`[text](./path/file)` where path is relative), and include syntax (`{{include:./path/file}}`). Identified references SHALL be displayed as a list of linked files in the UI.

#### Scenario: skill.md contains image references
- **WHEN** a skill.md file contains `![diagram](./images/architecture.png)`
- **THEN** the reference `./images/architecture.png` is extracted and displayed in the linked files list

#### Scenario: skill.md contains include references
- **WHEN** a skill.md file contains `{{include:./examples/code.py}}`
- **THEN** the reference `./examples/code.py` is extracted and displayed in the linked files list

#### Scenario: skill.md has no references
- **WHEN** a skill.md file contains no relative file references
- **THEN** the linked files section is hidden or shows "no references"

### Requirement: Edit Referenced Files
Users SHALL be able to click any file in the linked files list to load that file into the editor. The system SHALL resolve the full path relative to the skill.md location and load the content. If the referenced file is not editable (per the editable extension list), a preview SHALL be shown instead.

#### Scenario: User clicks a referenced editable file
- **WHEN** user clicks a referenced file with an editable extension
- **THEN** the file content is loaded into the editor with the current skill.md content preserved

#### Scenario: User clicks a referenced non-editable file
- **WHEN** user clicks a referenced file with a non-editable extension
- **THEN** a preview of the file is shown (image rendered, binary file shows metadata)

### Requirement: Multi-File Edit Tracking
The system SHALL track which files have been modified during the current editing session. Modified files SHALL be visually marked in both the file tree and the linked files list. The system SHALL allow switching between edited files without losing unsaved changes.

#### Scenario: User modifies multiple files
- **WHEN** user edits file A then switches to edit file B
- **THEN** file A's unsaved changes are preserved in memory and marked as modified

#### Scenario: User switches back to a modified file
- **WHEN** user switches from file B back to modified file A
- **THEN** the editor displays the unsaved version of file A's content
