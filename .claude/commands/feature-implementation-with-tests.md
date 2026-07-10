---
name: feature-implementation-with-tests
description: Workflow command scaffold for feature-implementation-with-tests in skills.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-implementation-with-tests

Use this workflow when working on **feature-implementation-with-tests** in `skills`.

## Goal

Implements a new backend or frontend feature with corresponding test coverage.

## Common Files

- `src/server/services/agent/*.ts`
- `src/server/routes/*.ts`
- `tests/server/services/agent/*.test.ts`
- `tests/server/routes/*.test.ts`
- `package.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update implementation file(s) in src/server/services/agent/ or src/server/routes/
- Create or update corresponding test file(s) in tests/server/services/agent/ or tests/server/routes/
- Update or add type definitions if needed
- Update package.json if new dependencies are required

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.