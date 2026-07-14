---
name: test-coverage-and-bugfix-cycle
description: Workflow command scaffold for test-coverage-and-bugfix-cycle in skills.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /test-coverage-and-bugfix-cycle

Use this workflow when working on **test-coverage-and-bugfix-cycle** in `skills`.

## Goal

Adds missing test coverage and addresses bugs or review findings, often after initial implementation.

## Common Files

- `tests/server/services/agent/*.test.ts`
- `src/server/services/agent/*.ts`
- `web/src/components/agent/*.vue`
- `web/src/composables/useAgent.ts`
- `web/src/types/agent.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update test files to cover missing scenarios or edge cases
- Fix bugs or refactor code in implementation files based on findings
- Update related type definitions or configuration if necessary

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.