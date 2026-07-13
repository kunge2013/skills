# Task 1: Add Avatar Icons to ChatMessageBubble

**Files:**
- Modify: `web/src/components/agent/ChatMessageBubble.vue`

**Interfaces:**
- Consumes: `isAgentType` computed (already exists, line 40-42)
- Produces: `.chat-avatar`, `.chat-avatar--agent`, `.chat-avatar--user` CSS classes

- [ ] **Step 1: Add avatar markup to template**

Add the following avatar element BEFORE the `.chat-bubble` div (for AI messages) and AFTER (for user messages). Replace the current template structure:

```vue
<template>
  <div class="chat-message" :class="`chat-message--${message.type}`">
    <div v-if="isAgentType" class="chat-avatar chat-avatar--agent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="8" width="18" height="12" rx="2"/>
        <circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none"/>
        <path d="M12 8V4"/>
        <path d="M8 4h8"/>
      </svg>
    </div>
    <div class="chat-bubble" :class="bubbleClasses">
      <AgentMessageContent v-if="isAgentType" :message="message" />
      <p v-else class="user-text">{{ message.content }}</p>
      <div class="message-actions">
        <button class="action-btn" @click="copyMessage" :title="$t('agent.copy')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button v-if="isAgentType" class="action-btn" @click="handleRegenerate" :title="$t('agent.regenerate')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <button v-else class="action-btn" @click="startEdit" :title="$t('agent.edit')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    </div>
    <div v-if="!isAgentType" class="chat-avatar chat-avatar--user">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 4-7 8-7s8 3 8 7"/>
      </svg>
    </div>
    <div class="chat-timestamp">{{ formatTime(message.timestamp) }}</div>
  </div>
</template>
```

Key changes:
- AI avatar (`v-if="isAgentType"`) renders BEFORE the bubble
- User avatar (`v-if="!isAgentType"`) renders AFTER the bubble
- Robot SVG: square head with two dot eyes and antenna
- Person SVG: circle head with curved body

- [ ] **Step 2: Add avatar CSS to `<style scoped>`**

Add these styles before the closing `</style>` tag (after line 143):

```css
.chat-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-avatar--agent {
  background: #e0f2fe;
  color: #0284c7;
}

.chat-avatar--user {
  background: #f3f4f6;
  color: #6b7280;
}

.chat-message--agent > .chat-avatar,
.chat-message--plan > .chat-avatar,
.chat-message--error > .chat-avatar {
  margin-right: 8px;
}

.chat-message--user > .chat-avatar {
  margin-left: 8px;
}
```

- [ ] **Step 3: Verify the dev server runs**

Run: `cd web && npm run dev` (on port 3010 per dev server config)
Expected: No compilation errors

- [ ] **Step 4: Visual verification**

Open the agent panel in the browser and verify:
- AI messages show a robot icon on the LEFT side of the bubble
- User messages show a person icon on the RIGHT side of the bubble
- Icons are 40px circles with correct colors
- 8px gap between avatar and bubble
- Layout looks correct for all message types (agent, plan, tool_call, error, user, user_question)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/agent/ChatMessageBubble.vue
git commit -m "feat: add avatar icons to distinguish AI and user messages"
```
