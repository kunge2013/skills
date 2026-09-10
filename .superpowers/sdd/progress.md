# SDD Progress Ledger

## Task 1: Add Avatar Icons to ChatMessageBubble
- **Status:** complete (commits e27d561..065eb26, review clean after fixes)
- **Initial review findings:**
  - Important: Undocumented `width: 100%` on `.chat-bubble` (fixed)
  - Important: Undocumented `width: 100%` on `.chat-message` (fixed)
  - Important: Report inaccuracy (fixed)
- **Final review findings:**
  - Critical: Avatar stacked vertically not horizontally (fixed: added `.chat-row` wrapper with `flex-direction: row` and `gap: 8px`)
  - Important: Missing `aria-hidden` on SVGs (fixed)
  - Important: Dead margin CSS (fixed: removed margin rules, replaced with gap)
- **Minor notes:** `.chat-message--tool_call` margin selector (resolved by gap approach), SVG size clarification (no code change needed)

---

## Plan: model-api-tester (2026-09-10)

Branch: feat/model-api-tester | Base: a26a7f2
Plan file: docs/superpowers/plans/2026-09-10-model-api-tester.md

### Task 1: adapter sendRaw
- Status: complete (commit 0baa8aa, review clean, tsc verified)
- Minor: body `as any` inherited from brief; anthropic max_tokens passthrough behavior noted for Task 2/8.
### Task 2: LLMService.sendRaw + route
- Status: complete (commit 5acde0f, review clean, tsc verified, mount prefix confirmed /api/v1)
- Minor: truthiness validation passes payload:{} ; catch-all 400 conflates client/server errors (brief-mandated, consistent with siblings).
### Task 3: /llm/raw route tests
- Status: complete (commit ca694ac, review clean, 4/4 tests passing verified independently)
- Minor: upstream-throw test rebuilds app over beforeEach one (brief-verbatim); mock params typed any (brief-verbatim, mock layer).
### Task 4: prompt store API tester state
- Status: complete (commit 6cd79b4d, review clean)
- Minor: duration not reset before request (Task 5 must render duration only when status===200); status hardcoded 200; payloadObj any (all brief-verbatim).
### Task 5: ApiTester.vue component
- Status: complete (commit 9b21b21, review clean, vue-tsc clean)
- Minor: `let parsed: any` brief-verbatim; HTTP danger tag effectively dead code (status 0 on error hides it); clearPayload doesn't reset loading (correct, store finally handles). OnModelChange/edit-preservation logic verified correct.
### Task 6: navigation integration
- Status: complete (commit 0a7bc81, review clean, vue-tsc clean)
- No issues. Note: web/tsconfig.app.tsbuildinfo left modified (unstaged) by typecheck — restore before final commit.
### Task 7: i18n strings
- Status: complete (commit 2e2d828, review clean)
- No issues. Both locales valid JSON, key parity verified against ApiTester.vue usage.
