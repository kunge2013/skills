# agent-chat-ui-polish Specification

## Purpose
TBD - created by archiving change agent-ui-streaming-optimization. Update Purpose after archive.
## Requirements
### Requirement: Chat bubbles have enhanced visual design

Chat message bubbles SHALL use subtle shadows, refined border radii, and smooth transitions to create a modern, polished appearance consistent with Element Plus design tokens. Layout follows the LangChain Agent Chat UI style: spacious, minimal, with clear visual hierarchy between user and agent messages.

#### Scenario: User message bubble appearance
- **WHEN** a user message is rendered
- **THEN** the bubble shows a solid primary color background with rounded corners, aligned to the right

#### Scenario: Agent message bubble appearance
- **WHEN** an agent message is rendered
- **THEN** the bubble shows a refined light background with subtle border, aligned to the left, with hover shadow effect

#### Scenario: Error message bubble appearance
- **WHEN** an error message is rendered
- **THEN** the bubble shows a danger-tinted background with clear error styling and icon

### Requirement: Input bar has modern design with integrated controls

The chat input bar SHALL feature an integrated model selector dropdown, send button with loading animation, and clean visual design matching the LangChain Agent Chat UI aesthetic.

#### Scenario: Input bar visual appearance
- **WHEN** the chat input bar is displayed
- **THEN** it shows a clean layout with rounded corners, subtle border, and integrated model selector on the same row

#### Scenario: Send button loading state
- **WHEN** a message is being processed
- **THEN** the send button shows a loading spinner and is disabled with visual feedback

### Requirement: Thinking indicator has animated placeholder

During LLM processing (before the first token arrives), the chat SHALL display an animated thinking indicator with subtle pulsing animation and localized text ("思考中...").

#### Scenario: Thinking indicator appears during loading
- **WHEN** a message is sent and the LLM has not yet returned the first token
- **THEN** an animated thinking indicator with pulsing dots appears in an agent-style bubble

#### Scenario: Thinking indicator transitions to streaming
- **WHEN** the first token arrives via SSE
- **THEN** the thinking indicator is replaced by the streaming message bubble with the first character

### Requirement: Tool call cards have polished design

Tool call cards SHALL display tool name as a header, arguments in a collapsed/code-formatted section, and result in an expandable area with status-colored indicators (green=complete, red=error, blue=running).

#### Scenario: Tool call running state
- **WHEN** a tool call is in running state
- **THEN** the card shows a blue loading spinner next to the tool name

#### Scenario: Tool call complete state
- **WHEN** a tool call completes
- **THEN** the card shows a green check icon and the result is visible in an expandable section

#### Scenario: Tool call error state
- **WHEN** a tool call encounters an error
- **THEN** the card shows a red error icon and the error message

### Requirement: User question dialog has clean design

The user question dialog SHALL display the agent's question clearly, provide a text input for the answer, and include submit/cancel buttons with appropriate labels.

#### Scenario: Question dialog appearance
- **WHEN** the agent asks a question
- **THEN** a centered dialog appears with the question text, input field, and Submit/Cancel buttons

#### Scenario: Answer submission
- **WHEN** the user types an answer and clicks Submit
- **THEN** the dialog closes and the answer is sent to the backend

