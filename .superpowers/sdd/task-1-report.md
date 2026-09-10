# Task 1 Report: adapter sendRaw

## Status: DONE

## What Was Implemented

All 5 steps from the brief (D:/github.io/skills/.superpowers/sdd/task-1-brief.md), transcribed verbatim:

1. **`src/server/services/llm/types.ts`** — Added optional `sendRaw?` method to the `ITextProviderAdapter` interface, inserted after `buildDefaultModel` and before the interface's closing brace. Optional method, so gemini/deepseek adapters require no changes (confirmed: no other adapter files were touched and the type check passes).

2. **`src/server/services/llm/adapters/openai-adapter.ts`** — Added `sendRaw` method to the adapter object literal, between `sendImageUnderstandingStream` and `buildDefaultModel`. Uses `getClient(config)`, merges `payload.model || config.modelId || config.modelMeta.id` as the model fallback, calls `client.chat.completions.create(body as any)`, and returns the raw response cast to `Record<string, any>`.

3. **`src/server/services/llm/adapters/anthropic-adapter.ts`** — Same insertion point and structure as the openai adapter, but calls `client.messages.create(body as any)`.

4. **Type check** — Passed cleanly.

5. **Commit** — Created with the exact message from the brief.

All AGC comment tags (`// [AGC:START] tool=Cc author=fangkun` / `// [AGC:END]`, plus the Chinese doc comment in types.ts) were preserved exactly as specified in the brief.

## Type Check

Command: `cd "D:/github.io/skills" && npx tsc -p tsconfig.server.json --noEmit`
Result: Passed (exit code 0, no output — no type errors).

## Files Changed

- `src/server/services/llm/types.ts` (+7 lines)
- `src/server/services/llm/adapters/openai-adapter.ts` (+9 lines)
- `src/server/services/llm/adapters/anthropic-adapter.ts` (+9 lines)

Commit: `0baa8aa` — "feat: add sendRaw passthrough to openai/anthropic adapters" (3 files changed, 25 insertions, 0 deletions). Only the three files specified in the brief were staged; unrelated working-tree changes (SDD progress files, untracked images/docs) were left out.

## Self-Review Findings

- **Completeness:** All brief steps implemented; code verified against the commit diff — byte-for-byte match with the brief's code blocks.
- **Consistency:** The new methods follow existing adapter patterns — `getClient(config)` reuse, `as any` body casts (same as `sendMessage`/`sendImageUnderstanding`), and the model fallback chain mirrors `buildParams`'s `config.modelId || model.id` precedence.
- **Discipline:** No scope creep — no changes to gemini/deepseek adapters, no refactoring of surrounding code.
- **Testing:** The brief specifies only the type check for this task (route tests arrive in Task 3); it passed. No unit-test framework wiring exists for these adapters in the repo, so no additional tests were added per the brief's explicit scope.
- **Behavioral note (not a defect):** `sendRaw` does not enforce a default `max_tokens` for anthropic (unlike `buildParams`, which sets 8192). This is intentional per the brief — sendRaw is a raw passthrough, and the anthropic API will reject requests lacking `max_tokens`, surfacing the provider's own error to the caller. Task 2's service/route layer is where payload validation belongs.

## Issues or Concerns

None blocking. The behavioral note above is informational for the Task 2 implementer.

(Note: this file previously contained a stale report from an unrelated earlier task — avatar icons in ChatMessageBubble — and was overwritten with the current Task 1 report.)
