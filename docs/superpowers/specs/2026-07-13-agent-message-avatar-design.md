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
| AI (agent, plan, tool_call, user_question) | Robot outline | `#e0f2fe` | `#0284c7` |
| User | Person outline | `#f3f4f6` | `#6b7280` |

No external dependencies. No image assets. Pure inline SVG + CSS.

### CSS Classes

New classes added to `ChatMessageBubble.vue` `<style scoped>`:

- `.chat-avatar` — base: 40x40 circle, flex center, `flex-shrink: 0`
- `.chat-avatar--agent` — AI avatar colors
- `.chat-avatar--user` — user avatar colors

Gap of `8px` between avatar and bubble via `margin` on the avatar element.

### Implementation Details

1. Use the existing `isAgentType` computed to determine which avatar to show
2. For agent-type messages: render robot SVG before the bubble
3. For user messages: render person SVG after the bubble
4. No changes to data model, props, or other components

### SVG Icons

**Robot icon (AI):** Simple robot head outline — square head, two dot eyes, antenna, body outline.

**Person icon (User):** Simple person silhouette — circle head, curved body.

Both icons use `stroke="currentColor"` for easy color control via CSS.

## Not In Scope

- User profile images or custom avatars
- Animated avatars
- Avatar click interactions
- Changes to other components (AgentMessageContent, ChatMessageList, etc.)
