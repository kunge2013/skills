# Agent Message Avatar Design

**Date:** 2026-07-13
**Author:** fangkun

## Problem

The current agent UI has no visual avatars for messages. User and AI messages are only differentiated by alignment (user right, AI left) but share identical bubble styling (`#f5f5f5` background). This makes it harder to quickly identify message source at a glance.

## Scope

Single-file change: `web/src/components/agent/ChatMessageBubble.vue`

## Design

### Layout

Add avatar icons next to each message bubble within the existing `.chat-message` flex container:

```
AI messages:  [avatar] [message bubble]          (left-aligned)
User messages:                          [bubble] [avatar]  (right-aligned)
```

### Icons

Inline SVG icons, 40x40px circular containers:

| Role | Icon | Background | Icon Color |
|------|------|------------|------------|
| AI (agent, plan, tool_call, error, user_question) | Robot outline | `#e0f2fe` | `#0284c7` |
| User | Person outline | `#f3f4f6` | `#6b7280` |

No external dependencies. No image assets. Pure inline SVG + CSS.

SVG icons include `aria-hidden="true"` for accessibility.

### CSS Classes

New classes added to `ChatMessageBubble.vue` `<style scoped>`:

- `.chat-row` — flex row container with `gap: 8px`
- `.chat-message--user > .chat-row` — `flex-direction: row-reverse` for right-alignment
- `.chat-avatar` — base: 40x40 circle, flex center, `flex-shrink: 0`
- `.chat-avatar--agent` — AI avatar colors
- `.chat-avatar--user` — user avatar colors

Gap of `8px` between avatar and bubble via `.chat-row` flex container's `gap` property.

### Implementation Details

1. Wrap avatar + bubble in a `.chat-row` flex container (row direction)
2. AI avatar (`v-if="isAgentType"`) renders before the bubble in the row
3. User avatar (`v-if="!isAgentType"`) renders after the bubble in the row
4. User message row uses `flex-direction: row-reverse` for right-alignment
5. Timestamp remains outside `.chat-row`, stacked below via parent column flex
6. No changes to data model, props, or other components

### SVG Icons

**Robot icon (AI):** Simple robot head outline — square head, two dot eyes, antenna, body outline.

**Person icon (User):** Simple person silhouette — circle head, curved body.

Both icons use `stroke="currentColor"` for easy color control via CSS.

## Not In Scope

- User profile images or custom avatars
- Animated avatars
- Avatar click interactions
- Changes to other components (AgentMessageContent, ChatMessageList, etc.)
