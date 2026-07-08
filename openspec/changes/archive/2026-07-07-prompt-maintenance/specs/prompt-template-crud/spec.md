## ADDED Requirements

### Requirement: User can view all prompt templates in a list
The system SHALL display all prompt templates (both built-in and custom) in a list showing the template name, type, and a truncated preview of the system prompt content. Built-in templates SHALL be marked as read-only.

#### Scenario: User opens the maintenance tab
- **WHEN** user navigates to the "Prompt Maintenance" tab
- **THEN** the system loads and displays all templates from the server
- **THEN** each template card shows name, type, truncated preview, and a "built-in" badge if applicable

#### Scenario: Template list is empty
- **WHEN** no templates exist (neither built-in nor custom)
- **THEN** an empty state message is displayed with a prompt to create the first template

### Requirement: User can create a new prompt template
The system SHALL allow users to create a new prompt template by providing a name, type, system prompt content, and optional user prompt content. The template ID SHALL be auto-generated from the name (kebab-case).

#### Scenario: User creates a new template
- **WHEN** user fills in the create form (name, type, system prompt) and clicks "Save"
- **THEN** the system sends a POST request to `/api/v1/templates` with the template data
- **THEN** the template list is refreshed and the new template appears
- **THEN** the create form collapses

#### Scenario: User creates a template with missing required fields
- **WHEN** user attempts to save without a name or system prompt content
- **THEN** a validation error is displayed and the template is not created

### Requirement: User can edit custom prompt templates
The system SHALL allow users to edit custom (non-built-in) templates inline. The edit form SHALL be pre-filled with the template's current name, type, system prompt, and user prompt. Built-in templates SHALL NOT be editable.

#### Scenario: User edits a custom template
- **WHEN** user clicks "Edit" on a custom template card
- **THEN** an edit form expands with the template's current content pre-filled
- **WHEN** user clicks "Save"
- **THEN** the system sends a PUT request to `/api/v1/templates/:id`
- **THEN** the template list is refreshed

#### Scenario: User attempts to edit a built-in template
- **WHEN** user views a built-in template card
- **THEN** no "Edit" button is displayed
- **THEN** the template content is displayed as read-only

### Requirement: User can delete custom prompt templates
The system SHALL allow users to delete custom (non-built-in) templates with a confirmation prompt. Built-in templates SHALL NOT be deletable.

#### Scenario: User deletes a custom template
- **WHEN** user clicks "Delete" on a custom template and confirms
- **THEN** the system sends a DELETE request to `/api/v1/templates/:id`
- **THEN** the template is removed from the list

### Requirement: User can optimize a template's content
The system SHALL provide an "Optimize" button on each template card. Clicking it SHALL switch to the Optimize tab and pre-fill the optimization input with the template's system prompt content.

#### Scenario: User clicks "Optimize" on a template
- **WHEN** user clicks the "Optimize" button on any template (built-in or custom)
- **THEN** the system switches to the Optimize tab
- **THEN** the optimization input field is pre-filled with the template's system prompt content
- **THEN** the user can proceed to run optimization
