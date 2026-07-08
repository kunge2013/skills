## ADDED Requirements

### Requirement: User can edit an existing model's configuration inline
The system SHALL allow users to click an "Edit" button on any model card, which expands an edit form pre-filled with the model's current configuration. The form SHALL include editable fields for display name, protocol (provider), Model ID, API Key, and Base URL. The model ID key SHALL be displayed as read-only.

#### Scenario: User clicks edit on a model card
- **WHEN** user clicks the "Edit" button on a model card
- **THEN** the card expands to show a form pre-filled with the model's current configuration (name, providerId, modelId, baseURL)
- **THEN** the model ID is displayed as read-only text
- **THEN** the API Key field is empty (for security, keys are not returned by the server)

#### Scenario: User saves edited model
- **WHEN** user modifies one or more fields and clicks "Save"
- **THEN** the system sends a PUT request to `/api/v1/models/:id` with the updated fields
- **THEN** the model list is refreshed to reflect the changes
- **THEN** the edit form collapses back to the compact view

#### Scenario: User cancels editing
- **WHEN** user clicks "Cancel" while editing a model
- **THEN** the edit form collapses without saving changes
- **THEN** no API request is sent

#### Scenario: User edits a model with validation errors
- **WHEN** user attempts to save with required fields missing (e.g., empty display name or Model ID)
- **THEN** the system displays a validation error message
- **THEN** the model is not saved and the edit form remains open

### Requirement: Only one model can be edited at a time
The system SHALL allow editing only one model at a time. When a user starts editing a different model, any unsaved edits to the current model SHALL be discarded.

#### Scenario: User switches edit target
- **WHEN** user is editing Model A and clicks "Edit" on Model B
- **THEN** Model A's edit form collapses without saving
- **THEN** Model B's edit form expands with its current configuration

#### Scenario: User adds and edits simultaneously
- **WHEN** user has the "Add Model" form open and clicks "Edit" on an existing model
- **THEN** the "Add Model" form collapses
- **THEN** the selected model's edit form expands
