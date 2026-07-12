## ADDED Requirements

### Requirement: Agent response renders token-by-token via SSE streaming

The frontend SHALL create an agent message bubble immediately when a plan generation starts, and append each SSE `plan_token` event's content to the message in real-time, creating a character-by-character streaming effect visible to the user.

#### Scenario: Streaming tokens appear as typed
- **WHEN** user sends a message and plan generation begins
- **THEN** an empty agent message bubble appears immediately, and each token appends to it in real-time

#### Scenario: Streaming reasoning appears in collapsible section
- **WHEN** SSE `plan_reasoning` events are received during plan generation
- **THEN** the reasoning content accumulates in the collapsible reasoning section of the agent message

#### Scenario: Plan completion finalizes the message
- **WHEN** SSE `plan_complete` event is received
- **THEN** the streaming agent message is marked as complete (isStreaming: false), loading indicator is removed

#### Scenario: Plan error converts streaming message to error
- **WHEN** SSE `plan_error` event is received during streaming
- **THEN** the current streaming message is converted to an error message showing the error text

### Requirement: Tool calls render as real-time inline cards

When SSE `step_tool_use`, `step_tool_result`, and `step_error` events arrive during agent execution, the frontend SHALL display tool call cards inline within the message flow, showing real-time status transitions from pending → running → complete/error.

#### Scenario: Tool call card appears during streaming
- **WHEN** an SSE `step_tool_use` event is received
- **THEN** a new tool call card appears showing the tool name and arguments with a running indicator

#### Scenario: Tool call result updates card
- **WHEN** an SSE `step_tool_result` event is received
- **THEN** the corresponding tool call card updates to show the result text and changes to complete status

#### Scenario: Tool call error shows error state
- **WHEN** an SSE `step_error` event is received for a running tool call
- **THEN** the tool call card shows the error message and changes to error status with a red accent

### Requirement: Agent can ask user questions during execution

When SSE `step_ask_user` events are received, the frontend SHALL display a dialog with the agent's question, accept a text answer from the user, and send the answer back to continue execution.

#### Scenario: User question dialog appears
- **WHEN** an SSE `step_ask_user` event is received during step execution
- **THEN** a dialog/modal appears showing the agent's question with a text input and submit button

#### Scenario: User answers and execution continues
- **WHEN** the user types an answer and clicks submit
- **THEN** the answer is sent to the step run endpoint with userAnswers, the dialog closes, and execution continues

#### Scenario: User cancels the question
- **WHEN** the user clicks cancel on the question dialog
- **THEN** the current step is marked as failed with a "user cancelled" message

### Requirement: Auto-scroll follows streaming output with pause-on-scroll

The chat message list SHALL automatically scroll to the bottom as new streaming tokens arrive, but SHALL pause auto-scrolling when the user has scrolled up to view history. Auto-scroll SHALL resume when the user scrolls back to the bottom.

#### Scenario: Auto-scroll during streaming
- **WHEN** new tokens arrive via SSE and the user is at the bottom of the chat
- **THEN** the view smoothly scrolls to show the latest content

#### Scenario: Pause auto-scroll on scroll-up
- **WHEN** the user scrolls up to read previous messages during streaming
- **THEN** auto-scroll pauses and the user can read without being forced back to the bottom

#### Scenario: Resume auto-scroll on scroll-to-bottom
- **WHEN** the user scrolls back to the bottom of the chat during streaming
- **THEN** auto-scroll resumes for subsequent tokens

