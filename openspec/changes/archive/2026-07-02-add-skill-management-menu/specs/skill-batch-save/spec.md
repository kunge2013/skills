## ADDED Requirements

### Requirement: Batch Save Modified Files
The system SHALL provide a "Save All" action that saves all files modified during the current editing session. The save operation SHALL process files sequentially, validating each file before saving. On success, the system SHALL confirm the number of files saved and clear the modified state.

#### Scenario: User saves all modified files successfully
- **WHEN** user clicks "Save All" and all modified files pass validation
- **THEN** all files are saved, a success message shows the count of saved files, and modified indicators are cleared

#### Scenario: User saves with no modified files
- **WHEN** user clicks "Save All" with no modified files
- **THEN** a message indicates there are no changes to save

#### Scenario: User saves a single modified file
- **WHEN** user clicks "Save All" with exactly one modified file
- **THEN** that file is saved and marked as unmodified

### Requirement: Save Conflict Handling
If a file has been modified on disk since it was loaded (mtime mismatch), the system SHALL present a conflict resolution dialog offering to: (a) overwrite the disk version, (b) reload from disk and discard local changes, or (c) skip this file and continue saving others.

#### Scenario: Conflict detected during batch save
- **WHEN** batch save detects an mtime mismatch on one file
- **THEN** a conflict dialog appears with overwrite, reload, and skip options

#### Scenario: User chooses to skip conflicting file
- **WHEN** user selects "skip" for a conflicting file during batch save
- **THEN** the remaining non-conflicting files are saved and the skipped file retains its modified state

### Requirement: Partial Save Failure Recovery
If any file fails to save during batch save (due to permissions, disk full, etc.), the system SHALL display an error message identifying the failed file(s), preserve the modified state of failed files, and allow the user to retry saving them individually.

#### Scenario: One file fails during batch save
- **WHEN** file A saves successfully but file B fails with an error
- **THEN** file A's modified state is cleared, file B remains marked as modified with an error indicator, and an error message identifies file B

#### Scenario: User retries saving a failed file
- **WHEN** user clicks retry on a failed file
- **THEN** the save operation is attempted again for that single file
