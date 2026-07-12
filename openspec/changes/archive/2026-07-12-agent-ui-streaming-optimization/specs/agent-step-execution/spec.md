## MODIFIED Requirements

### Requirement: Step execution streams output via SSE

Each step execution SHALL stream tokens, reasoning content, tool calls, and completion/error events via SSE to the client. The frontend SHALL render these events in real-time as they arrive, not just accumulate them for post-completion display.

#### Scenario: Streaming step tokens renders in real-time
- **WHEN** a step is executing and SSE `step_token` events arrive
- **THEN** each token is immediately appended to the step output display with a streaming cursor animation

#### Scenario: Streaming reasoning tokens renders in real-time
- **WHEN** the model produces reasoning/thinking output via SSE `step_reasoning` events
- **THEN** the reasoning content accumulates in real-time in the collapsible section
