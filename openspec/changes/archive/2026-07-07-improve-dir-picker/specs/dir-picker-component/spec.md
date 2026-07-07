## ADDED Requirements

### Requirement: Drive Selector
The DirPicker component SHALL display a dropdown (`el-select`) at the top of the directory picker showing all available drives. When a drive is selected, the component SHALL load and display the root contents of that drive. The default selected drive SHALL be determined by the current path being browsed, or the first available drive if no path is provided.

#### Scenario: Drive selector renders with available drives
- **WHEN** the DirPicker component is mounted
- **THEN** it fetches the drive list via `window.api.listDrives()` and populates the dropdown

#### Scenario: User selects a different drive
- **WHEN** the user selects a drive from the dropdown
- **THEN** the current path is set to the selected drive root and its directory contents are loaded

#### Scenario: Current path determines default drive
- **WHEN** the DirPicker is initialized with a current path (e.g., `D:\github.io\skills`)
- **THEN** the drive selector defaults to `D:\`

### Requirement: Breadcrumb Navigation
The DirPicker component SHALL display a clickable breadcrumb bar showing the path from the drive root to the current directory. Each segment of the breadcrumb SHALL be clickable to navigate directly to that level. The breadcrumb SHALL be positioned below the drive selector and above the directory listing.

#### Scenario: Breadcrumb displays current path segments
- **WHEN** the current path is `D:\github.io\skills\.claude`
- **THEN** the breadcrumb shows: `github.io > skills > .claude` with each segment clickable

#### Scenario: User clicks a breadcrumb segment
- **WHEN** the user clicks the `skills` segment in `github.io > skills > .claude`
- **THEN** the current path changes to `D:\github.io\skills` and its contents are loaded

### Requirement: Parent Directory Button
The DirPicker component SHALL display an "Up" button (labeled `上级`) that navigates to the parent directory of the current path. When at a drive root, the button SHALL be disabled.

#### Scenario: User clicks the Up button
- **WHEN** the current path is `D:\github.io\skills` and the user clicks the Up button
- **THEN** the current path changes to `D:\github.io` and its contents are loaded

#### Scenario: Up button disabled at drive root
- **WHEN** the current path is `D:\`
- **THEN** the Up button is disabled and not clickable

### Requirement: Flat Directory Listing
The DirPicker component SHALL display a flat list of directories at the current path level. Each directory SHALL be displayed with a folder icon and be clickable to navigate into it. The list SHALL be sorted alphabetically by name. Directories starting with `.` SHALL be included.

#### Scenario: Directory listing loads at current path
- **WHEN** the DirPicker navigates to a path
- **THEN** it fetches directory children via `window.api.listDirs()` and displays them as a flat list

#### Scenario: User clicks a directory in the listing
- **WHEN** the user clicks a directory entry
- **THEN** the current path changes to that directory and its contents are loaded

#### Scenario: Directory listing is empty
- **WHEN** the current path has no subdirectories
- **THEN** a message "Empty directory" is displayed

### Requirement: Confirm Selection
The DirPicker component SHALL display a "Load Skills" (加载技能) button that emits the current path for confirmation. The button SHALL be disabled if no path is selected. The component SHALL also emit a cancel event when the user clicks "Cancel".

#### Scenario: User confirms path selection
- **WHEN** the user clicks the "Load Skills" button
- **THEN** the component emits a `confirm` event with the current path

#### Scenario: User cancels selection
- **WHEN** the user clicks the "Cancel" button
- **THEN** the component emits a `cancel` event
