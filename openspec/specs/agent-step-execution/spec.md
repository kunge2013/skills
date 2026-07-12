# agent-step-execution Specification

## Purpose
TBD - created by archiving change deepagents-integration. Update Purpose after archive.
## Requirements
### Requirement: User can trigger a single plan step for execution

The system SHALL provide an endpoint to manually trigger execution of a single step within a plan. The step SHALL execute with its associated SKILL.md content as system prompt, combined with the original user request and outputs from all preceding completed steps.

#### Scenario: Trigger pending step
- **WHEN** user calls POST /agent/step/:stepId/run for a step with status "pending"
- **THEN** the step status changes to "running" and execution begins

#### Scenario: Trigger already-running step
- **WHEN** user calls POST /agent/step/:stepId/run for a step with status "running"
- **THEN** the system returns a 409 Conflict error

#### Scenario: Trigger completed step
- **WHEN** user calls POST /agent/step/:stepId/run for a step with status "done"
- **THEN** the system returns a 409 Conflict error

### Requirement: Step execution streams output via SSE

Each step execution SHALL stream tokens, reasoning content, tool calls, and completion/error events via SSE to the client. The frontend SHALL render these events in real-time as they arrive, not just accumulate them for post-completion display.

#### Scenario: Streaming step tokens renders in real-time
- **WHEN** a step is executing and SSE `step_token` events arrive
- **THEN** each token is immediately appended to the step output display with a streaming cursor animation

#### Scenario: Streaming reasoning tokens renders in real-time
- **WHEN** the model produces reasoning/thinking output via SSE `step_reasoning` events
- **THEN** the reasoning content accumulates in real-time in the collapsible section

### Requirement: Context is passed between sequential steps

When executing a step, the system SHALL assemble context from: (a) the SKILL.md content for the step's referenced skill, (b) the original user message from the plan, (c) the output text from all preceding steps with status "done".

#### Scenario: First step has no prior context
- **WHEN** the first step in a plan is executed
- **THEN** the system prompt includes only SKILL.md content and the original user message

#### Scenario: Second step receives first step output
- **WHEN** the second step is executed after the first step completed
- **THEN** the system prompt includes SKILL.md content, original user message, and the first step's output labeled as "Step 1 output"

#### Scenario: Skipped step context handling
- **WHEN** step 2 failed and step 3 is executed
- **THEN** the system prompt includes only outputs from steps with status "done" (skipping the failed step 2)

### Requirement: Step execution uses the provider selected for the plan

The step SHALL execute using the same provider and model that were specified when the plan was created.

#### Scenario: Step uses plan's provider
- **WHEN** a step executes for a plan created with provider "openai"
- **THEN** the step executes against the OpenAI-compatible adapter with the configured model

