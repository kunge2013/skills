## ADDED Requirements

### Requirement: Install skill with selectable mode
The system SHALL allow users to install a skill via the web UI by choosing between two modes: `symlink` (creates a symbolic link from the target directory to the source) and `copy` (recursively copies all files from the source into the target directory). The install endpoint SHALL accept `skillName`, `projectPath`, `mode` ('symlink' or 'copy'), and an optional `targetDir`.

#### Scenario: Install via symlink mode (default)
- **WHEN** user requests install with `mode: 'symlink'` or no mode specified
- **THEN** the system creates a symlink in `targetDir/skillName` pointing to the skill source directory

#### Scenario: Install via copy mode
- **WHEN** user requests install with `mode: 'copy'`
- **THEN** the system recursively copies all files from the skill source into `targetDir/skillName/` and creates a `.skills-manifest.json` file recording the installation metadata

#### Scenario: Install with custom target directory
- **WHEN** user provides a non-empty `targetDir` path
- **THEN** the system validates the directory exists and is writable, then installs the skill into that directory instead of the default `.claude/skills/`

#### Scenario: Install with empty or missing target directory
- **WHEN** `targetDir` is empty or not provided
- **THEN** the system resolves the target to `.claude/skills/` under the project root via `findProjectSkillsDir(projectPath)`

### Requirement: Uninstall skill for both modes
The system SHALL correctly uninstall a skill regardless of whether it was installed via symlink or copy mode. For symlink mode, the symlink is removed. For copy mode, the copied directory is removed after verifying ownership via `.skills-manifest.json`.

#### Scenario: Uninstall symlink-mode skill
- **WHEN** user requests uninstall of a skill installed via symlink
- **THEN** the system removes only the symlink, leaving the source files intact

#### Scenario: Uninstall copy-mode skill
- **WHEN** user requests uninstall of a skill installed via copy mode with a valid `.skills-manifest.json`
- **THEN** the system removes the skill directory and all copied files

#### Scenario: Refuse to uninstall unknown directory
- **WHEN** user requests uninstall of a directory that is neither a symlink nor has a `.skills-manifest.json`
- **THEN** the system returns an error and does not delete the directory

### Requirement: Report install status and mode
The system SHALL report the install status of a skill, including whether it is installed, the installation mode (symlink or copy), and the target path.

#### Scenario: Check status of symlink-installed skill
- **WHEN** status is checked for a skill installed via symlink
- **THEN** the response includes `installed: true`, `mode: 'symlink'`, `linkPath`, and `targetPath`

#### Scenario: Check status of copy-installed skill
- **WHEN** status is checked for a skill installed via copy mode with a valid `.skills-manifest.json`
- **THEN** the response includes `installed: true`, `mode: 'copy'`, `installPath`, and `installedAt` timestamp

#### Scenario: Check status of uninstalled skill
- **WHEN** status is checked for a skill not present in the target directory
- **THEN** the response includes `installed: false`
