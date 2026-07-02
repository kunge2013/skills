## ADDED Requirements

### Requirement: Global Skill Search
The system SHALL provide a search input that allows users to search across all available skills by keyword. The search SHALL filter skills by name, description, and category. Results SHALL update in real-time as the user types, with a minimum debounce of 300ms.

#### Scenario: User enters search keyword
- **WHEN** user types a keyword into the search input
- **THEN** the skill list filters to show only matching skills within 500ms

#### Scenario: User clears search input
- **WHEN** user clears the search input
- **THEN** all skills are displayed without filtering

#### Scenario: Search with active category filter
- **WHEN** user has a category filter selected and enters a search keyword
- **THEN** results are filtered by both keyword and category

### Requirement: Search Result Display
Search results SHALL display each matching skill with its name, plugin source, category, and a brief description. Each result SHALL be clickable to navigate to the skill's detail or directory view.

#### Scenario: Search returns matches
- **WHEN** search finds matching skills
- **THEN** each result shows skill name, plugin name, category tag, and description snippet

#### Scenario: Search returns no matches
- **WHEN** search finds no matching skills
- **THEN** an empty state message is displayed indicating no results found
