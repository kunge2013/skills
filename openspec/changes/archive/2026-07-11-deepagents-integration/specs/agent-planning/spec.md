## ADDED Requirements

### Requirement: User can request a plan for a natural language task

The system SHALL accept a natural language request along with a selected provider/model and return a structured execution plan containing sequential steps, each associated with a registered SKILL skill.

#### Scenario: Successful plan generation
- **WHEN** user submits a request "优化我的项目的 README 文档" with provider "anthropic"
- **THEN** the system returns a plan with steps, each step referencing a registered skill by name

#### Scenario: Plan generation with no matching skills
- **WHEN** user submits a request that does not match any registered skills
- **THEN** the system returns a plan with generic steps or indicates no applicable skills are available

#### Scenario: Plan generation with invalid provider
- **WHEN** user submits a request with a provider that is not configured
- **THEN** the system returns a 400 error with a message indicating the provider is not available

### Requirement: Plan includes metadata and step ordering

Each plan SHALL include a unique identifier, creation timestamp, status, an ordered list of steps, and the original user message. Each step SHALL include a step ID, skill reference, status, and optional output field.

#### Scenario: Plan structure validation
- **WHEN** a plan is generated
- **THEN** it contains fields: id (string), status (planning|pending|done), steps (array), userMessage (string), createdAt (ISO timestamp)

#### Scenario: Step structure validation
- **WHEN** a plan step is created
- **THEN** it contains fields: id (string), skill (string), status (pending|running|done|failed), output (string|null)

### Requirement: User can query plan status and details

The system SHALL provide an endpoint to retrieve a plan by its ID, returning the full plan structure including current step statuses and any completed outputs.

#### Scenario: Query existing plan
- **WHEN** user requests GET /agent/plan/:id with a valid plan ID
- **THEN** the system returns the plan with all step statuses and outputs

#### Scenario: Query non-existent plan
- **WHEN** user requests GET /agent/plan/:id with an invalid ID
- **THEN** the system returns a 404 error

### Requirement: Plan generation uses SSE streaming

The plan generation endpoint SHALL stream tokens via SSE so the user can see the plan being constructed in real-time.

#### Scenario: SSE stream for plan generation
- **WHEN** user calls POST /agent/plan
- **THEN** the response is Content-Type: text/event-stream with token events

#### Scenario: Plan complete event
- **WHEN** plan generation finishes
- **THEN** the SSE stream sends a final event with type "plan_complete" containing the full plan JSON
