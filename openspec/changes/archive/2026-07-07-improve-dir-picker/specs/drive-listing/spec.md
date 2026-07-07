## ADDED Requirements

### Requirement: List Available Drives
The system SHALL provide an API endpoint that returns all available filesystem drives/volumes. On Windows, the endpoint SHALL return drive letters (e.g., `C:\`, `D:\`). On Unix-like systems (Linux, macOS), the endpoint SHALL return the root mount point `/` as the single root drive. The response SHALL include a label (display name) and value (absolute path) for each drive.

#### Scenario: List drives on Windows
- **WHEN** the API is called on a Windows system with drives C:\, D:\, and E:\
- **THEN** the response includes three entries with labels `C:\`, `D:\`, `E:\` and corresponding values `C:\`, `D:\`, `E:\`

#### Scenario: List drives on Unix
- **WHEN** the API is called on a Linux or macOS system
- **THEN** the response includes a single entry with label `/` and value `/`

#### Scenario: Drive list API error handling
- **WHEN** the system cannot enumerate drives (e.g., permission denied)
- **THEN** the response includes `success: false` with an error message
