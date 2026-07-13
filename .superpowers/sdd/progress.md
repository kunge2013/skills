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
