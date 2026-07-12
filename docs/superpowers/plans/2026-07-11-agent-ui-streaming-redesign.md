# Agent UI Streaming Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Agent chat UI with real-time token-by-token streaming, inline tool call cards, polished visual design, and smart auto-scroll.

**Architecture:** "Live Message" pattern — create an empty agent message bubble on send, stream tokens into it in real-time via SSE callbacks, insert tool call cards inline, and finalize on plan_complete.

**Tech Stack:** Vue 3 Composition API, Element Plus v2.9.0, Pinia, vue-i18n, TypeScript, markdown-it

## Global Constraints

- scoped CSS only (no Tailwind)
- Use vue-i18n for all user-facing text (en + zh-CN)
- Keep backend agent service logic unchanged
- Use Element Plus v2.9.0 components (el-dialog, el-select, el-button, el-input, el-collapse)
- New dependency: `markdown-it` + `@types/markdown-it` only
- Do NOT modify PlanView.vue, StepCard.vue, StepOutput.vue (keep but unused)

---

### Task 1: Add markdown-it dependency and update ChatMessage type

**Files:**
- Modify: `web/src/types/chat.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Install markdown-it**

Run in `web/` directory:
```bash
npm install markdown-it
npm install -D @types/markdown-it
```

- [ ] **Step 2: Add `isStreaming` field to ChatMessage**

```typescript
// web/src/types/chat.ts — add to ChatMessage interface:
export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  content: string;
  timestamp: Date;
  reasoning?: string;
  planId?: string;
  toolCalls?: ToolCall[];
  stepId?: string;
  question?: string;
  isStreaming?: boolean;  // NEW: true while tokens are still arriving
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/types/chat.ts web/package.json web/package-lock.json
git commit -m "feat: add isStreaming to ChatMessage, add markdown-it dependency"
```

### Task 2: Rewrite useAgentChat with live message streaming

**Files:**
- Modify: `web/src/composables/useAgentChat.ts`
- Modify: `web/src/composables/useAgent.ts`

**Interfaces:**
- Consumes: `agent.createPlan(userMessage, modelKey, handlers)` from Task 1 types
- Produces: `messages` ref with live-updating agent messages; `sendMessage(text, modelKey)` that creates streaming message immediately

- [ ] **Step 1: Rewrite useAgentChat.ts**

Replace the entire file content with:

```typescript
import { ref, watch } from 'vue';
import { useAgent } from './useAgent';
import type { ChatMessage } from '../types/chat';

let messageCounter = 0;

function nextId(): string {
  return `msg-${++messageCounter}`;
}

export function useAgentChat() {
  const agent = useAgent();
  const messages = ref<ChatMessage[]>([]);
  const streamingMessageId = ref<string | null>(null);

  async function sendMessage(text: string, modelKey: string) {
    if (!text.trim() || agent.loading.value) return;

    // Create user message
    messages.value.push({
      id: nextId(),
      type: 'user',
      content: text,
      timestamp: new Date(),
    });

    // Create live streaming agent message immediately
    const agentMsgId = nextId();
    messages.value.push({
      id: agentMsgId,
      type: 'agent',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      toolCalls: [],
    });
    streamingMessageId.value = agentMsgId;

    await agent.createPlan(text, modelKey, {
      onToken: (token) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) msg.content += token;
      },
      onReasoning: (reasoning) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) msg.reasoning = (msg.reasoning || '') + reasoning;
      },
      onToolUse: (data) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg) {
          msg.toolCalls = msg.toolCalls || [];
          msg.toolCalls.push({
            id: `${data.stepId || ''}-${data.toolName}`,
            toolName: data.toolName,
            args: data.args,
            result: null,
            status: 'running',
          });
        }
      },
      onToolResult: (data) => {
        const msg = messages.value.find(m => m.id === streamingMessageId.value);
        if (msg?.toolCalls) {
          const call = msg.toolCalls.find(c => c.toolName === data.toolName);
          if (call) {
            call.result = data.result;
            call.status = data.result ? 'complete' : 'error';
          }
        }
      },
    });
  }

  // Watch plan completion → finalize streaming message
  watch(() => agent.currentPlan.value, (plan) => {
    if (plan && plan.status !== 'planning' && streamingMessageId.value) {
      const msg = messages.value.find(m => m.id === streamingMessageId.value);
      if (msg) {
        msg.isStreaming = false;
        if (!msg.content && plan.responseText) {
          msg.content = plan.responseText;
        }
      }
      streamingMessageId.value = null;
    }
  });

  // Watch errors → finalize or create error message
  watch(() => agent.error.value, (err) => {
    if (err && streamingMessageId.value) {
      const msg = messages.value.find(m => m.id === streamingMessageId.value);
      if (msg) {
        msg.type = 'error';
        msg.content = err;
        msg.isStreaming = false;
      }
      streamingMessageId.value = null;
    } else if (err) {
      messages.value.push({
        id: nextId(),
        type: 'error',
        content: err,
        timestamp: new Date(),
      });
    }
  });

  return {
    messages,
    sendMessage,
    isLoading: agent.loading,
    error: agent.error,
  };
}
```

- [ ] **Step 2: Update useAgent.ts — add callback-based createPlan overload**

Add a new `createPlan` signature that accepts granular callbacks for live streaming. The existing `createPlan(userMessage, modelKey)` remains for backward compatibility. Replace the `createPlan` function body:

```typescript
// web/src/composables/useAgent.ts — replace createPlan function

interface StreamingCallbacks {
  onToken: (token: string) => void;
  onReasoning: (reasoning: string) => void;
  onToolUse: (data: { stepId: string; toolName: string; args: Record<string, unknown> }) => void;
  onToolResult: (data: { toolName: string; result: string }) => void;
}

async function createPlan(userMessage: string, modelKey: string, callbacks?: StreamingCallbacks) {
  loading.value = true;
  error.value = null;
  planTextBuffer.value = '';
  planReasoningBuffer.value = '';
  currentPlan.value = null;
  stepToolCalls.value = new Map();
  stepReasoning.value = new Map();

  try {
    await api.createPlan(userMessage, modelKey, {
      onPlanToken: (token) => {
        planTextBuffer.value += token;
        callbacks?.onToken(token);
      },
      onPlanReasoning: (reasoning) => {
        planReasoningBuffer.value += reasoning;
        callbacks?.onReasoning(reasoning);
      },
      onPlanComplete: (plan) => {
        currentPlan.value = plan;
        planTextBuffer.value = '';
        loading.value = false;
      },
      onPlanError: (err) => {
        error.value = err;
        loading.value = false;
      },
      onStepStart: () => {},
      onStepToken: () => {},
      onStepReasoning: (data) => {
        stepReasoning.value.set(data.stepId, data.reasoning);
        stepReasoning.value = stepReasoning.value;
      },
      onStepToolUse: (data) => {
        callbacks?.onToolUse(data);
        const calls = stepToolCalls.value.get(data.stepId) ?? [];
        calls.push({
          id: `${data.stepId}-${data.toolName}`,
          toolName: data.toolName,
          args: data.args,
          result: null,
          status: 'running',
        });
        stepToolCalls.value.set(data.stepId, calls);
        stepToolCalls.value = stepToolCalls.value;
      },
      onStepToolResult: (data) => {
        callbacks?.onToolResult({ toolName: data.toolName, result: data.result });
        const calls = stepToolCalls.value.get(data.stepId) ?? [];
        const call = calls.find(c => c.toolName === data.toolName);
        if (call) {
          call.result = data.result;
          call.status = data.result ? 'complete' : 'error';
        }
        stepToolCalls.value = stepToolCalls.value;
      },
      onStepAskUser: () => {},
      onStepComplete: () => {},
      onStepError: () => {},
    });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Plan creation failed';
    loading.value = false;
  }
}
```

- [ ] **Step 3: Type check**

```bash
cd web && npx vue-tsc --noEmit
```

Expected: PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/composables/useAgentChat.ts web/src/composables/useAgent.ts
git commit -m "feat: live message streaming in useAgentChat and useAgent"
```

### Task 3: Rewrite AgentMessageContent with Markdown rendering

**Files:**
- Modify: `web/src/components/agent/AgentMessageContent.vue`

**Interfaces:**
- Consumes: `ChatMessage` with `isStreaming`, `content` (plain text/markdown), `toolCalls`, `reasoning`
- Produces: rendered HTML + tool call cards + collapsible reasoning

- [ ] **Step 1: Rewrite AgentMessageContent.vue**

```vue
<template>
  <div class="agent-message-content">
    <!-- Collapsible reasoning -->
    <div v-if="message.reasoning" class="reasoning-section">
      <el-collapse v-model="activeReasoning" class="reasoning-collapse">
        <el-collapse-item name="reasoning">
          <template #title>
            <div class="reasoning-header">
              <svg class="reasoning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
                <path d="M9 21h6M10 18v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1"/>
              </svg>
              <span>{{ $t('agent.thinking') }}</span>
            </div>
          </template>
          <pre class="reasoning-content">{{ message.reasoning }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- Markdown content -->
    <div v-if="message.content" class="agent-text" v-html="renderedContent" />

    <!-- Streaming cursor -->
    <span v-if="message.isStreaming" class="streaming-cursor">|</span>

    <!-- Tool calls -->
    <div v-if="message.toolCalls?.length" class="tool-calls">
      <ToolCallCard v-for="tc in message.toolCalls" :key="tc.id" :tool-call="tc" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MarkdownIt from 'markdown-it'
import ToolCallCard from './ToolCallCard.vue'
import type { ChatMessage } from '../../types/chat'

defineProps<{ message: ChatMessage }>()

const activeReasoning = ref<string[]>(['reasoning'])

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

const renderedContent = computed(() => {
  try {
    return md.render(props.message.content || '')
  } catch {
    return props.message.content || ''
  }
})
</script>

<style scoped>
.agent-message-content { line-height: 1.6; }

.reasoning-section { margin-bottom: 8px; }
.reasoning-collapse { border: none; }
.reasoning-collapse :deep(.el-collapse-item__header) {
  height: auto;
  padding: 6px 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  border: none;
}
.reasoning-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: var(--el-fill-color-lighter);
  border-radius: 0 0 6px 6px;
  margin-top: 2px;
}
.reasoning-collapse :deep(.el-collapse-item__content) {
  padding: 8px 4px 12px;
}
.reasoning-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.reasoning-icon {
  width: 14px;
  height: 14px;
  color: var(--el-text-color-secondary);
}
.reasoning-content {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.agent-text {
  margin: 0 0 8px;
}
.agent-text :deep(h1), .agent-text :deep(h2), .agent-text :deep(h3) {
  margin: 12px 0 6px;
  font-size: inherit;
}
.agent-text :deep(p) {
  margin: 0 0 8px;
}
.agent-text :deep(p:last-child) {
  margin-bottom: 0;
}
.agent-text :deep(code) {
  background: var(--el-fill-color);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}
.agent-text :deep(pre) {
  background: var(--el-fill-color);
  padding: 8px 12px;
  border-radius: 6px;
  overflow: auto;
  font-size: 13px;
}
.agent-text :deep(pre code) {
  background: none;
  padding: 0;
}
.agent-text :deep(ul), .agent-text :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}

.streaming-cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  color: var(--el-text-color-placeholder);
  font-weight: bold;
}

@keyframes blink {
  50% { opacity: 0; }
}

.tool-calls { display: flex; flex-direction: column; gap: 4px; }
</style>
```

- [ ] **Step 2: Type check**

```bash
cd web && npx vue-tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/agent/AgentMessageContent.vue
git commit -m "feat: Markdown rendering and streaming cursor in AgentMessageContent"
```

### Task 4: Rewrite ChatMessageList with smart auto-scroll

**Files:**
- Modify: `web/src/components/agent/ChatMessageList.vue`

**Interfaces:**
- Consumes: `messages: ChatMessage[]`, `isLoading: boolean` (from useAgentChat)
- Produces: auto-scrolling message list with IntersectionObserver

- [ ] **Step 1: Rewrite ChatMessageList.vue**

```vue
<template>
  <div ref="container" class="chat-message-list">
    <ChatMessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />

    <!-- Thinking indicator when loading and no messages yet -->
    <div v-if="isLoading && messages.length === 0" class="chat-thinking">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ $t('agent.thinking') }}</span>
    </div>

    <!-- Anchor for IntersectionObserver to detect bottom -->
    <div ref="bottomAnchor" class="scroll-anchor" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import ChatMessageBubble from './ChatMessageBubble.vue'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{ messages: ChatMessage[]; isLoading: boolean }>()

const container = ref<HTMLElement>()
const bottomAnchor = ref<HTMLElement>()
const isUserAtBottom = ref(true)

let observer: IntersectionObserver | null = null

onMounted(() => {
  if (bottomAnchor.value) {
    observer = new IntersectionObserver(
      (entries) => {
        isUserAtBottom.value = entries[0].isIntersecting
      },
      { threshold: 0.9 }
    )
    observer.observe(bottomAnchor.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

function scrollToBottom() {
  nextTick(() => {
    bottomAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

// Scroll on new messages or content changes when user is at bottom
watch(() => [props.messages.length, isUserAtBottom.value], () => {
  if (isUserAtBottom.value) {
    scrollToBottom()
  }
}, { immediate: true })
</script>

<style scoped>
.chat-message-list { flex: 1; overflow-y: auto; padding: 12px 0; }
.chat-thinking { display: flex; align-items: center; gap: 6px; color: var(--el-text-color-secondary); padding: 8px 0; }
.scroll-anchor { height: 1px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/agent/ChatMessageList.vue
git commit -m "feat: smart auto-scroll with IntersectionObserver in ChatMessageList"
```

### Task 5: Rewrite ChatMessageBubble with polished visual design

**Files:**
- Modify: `web/src/components/agent/ChatMessageBubble.vue`

- [ ] **Step 1: Rewrite ChatMessageBubble.vue**

```vue
<template>
  <div class="chat-message" :class="`chat-message--${message.type}`">
    <div class="chat-bubble" :class="bubbleClasses">
      <AgentMessageContent v-if="isAgentType" :message="message" />
      <p v-else class="user-text">{{ message.content }}</p>
    </div>
    <div class="chat-timestamp">{{ formatTime(message.timestamp) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AgentMessageContent from './AgentMessageContent.vue'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{ message: ChatMessage }>()

const isAgentType = computed(() =>
  ['agent', 'plan', 'tool_call', 'error', 'user_question'].includes(props.message.type)
)

const bubbleClasses = computed(() => [
  `chat-bubble--${props.message.type}`,
  { 'chat-bubble--streaming': props.message.isStreaming },
])

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.chat-message {
  display: flex;
  flex-direction: column;
  margin: 8px 0;
  animation: fade-in-up 200ms ease-out;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-message--user { align-items: flex-end; }
.chat-message--agent,
.chat-message--plan,
.chat-message--error { align-items: flex-start; }

.chat-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 16px;
  transition: box-shadow 200ms ease;
}

.chat-bubble:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.chat-bubble--user {
  background: var(--el-color-primary);
  color: white;
  border-bottom-right-radius: 4px;
}

.chat-bubble--agent,
.chat-bubble--plan {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-bottom-left-radius: 4px;
}

.chat-bubble--error {
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-7);
  color: var(--el-color-danger);
  border-bottom-left-radius: 4px;
}

.chat-bubble--streaming {
  border-color: var(--el-border-color-light);
}

.chat-timestamp {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
  padding: 0 4px;
}

.user-text {
  margin: 0;
  line-height: 1.5;
  color: white;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/agent/ChatMessageBubble.vue
git commit -m "feat: polished visual design for ChatMessageBubble"
```

### Task 6: Polish ToolCallCard with enhanced design

**Files:**
- Modify: `web/src/components/agent/ToolCallCard.vue`

- [ ] **Step 1: Rewrite ToolCallCard.vue**

```vue
<template>
  <div class="tool-call-card" :class="`tool-call--${toolCall.status}`">
    <div class="tool-call-header">
      <el-icon v-if="toolCall.status === 'running'" class="is-loading icon-running">
        <Loading />
      </el-icon>
      <el-icon v-else-if="toolCall.status === 'complete'" class="icon-complete">
        <CircleCheck />
      </el-icon>
      <el-icon v-else class="icon-error">
        <CircleClose />
      </el-icon>
      <span class="tool-call-name">{{ toolCall.toolName }}</span>
      <el-tag size="small" :type="statusTagType" round>
        {{ $t(statusLabelKey) }}
      </el-tag>
    </div>
    <el-collapse v-model="activeNames" class="tool-call-details">
      <el-collapse-item :title="$t('agent.toolArgs')" name="args">
        <pre class="tool-call-json">{{ JSON.stringify(toolCall.args, null, 2) }}</pre>
      </el-collapse-item>
      <el-collapse-item v-if="toolCall.result" :title="$t('agent.toolResult')" name="result">
        <pre class="tool-call-output">{{ toolCall.result }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Loading, CircleCheck, CircleClose } from '@element-plus/icons-vue'

const props = defineProps<{
  toolCall: {
    toolName: string
    args: Record<string, unknown>
    result: string | null
    status: 'running' | 'complete' | 'error'
  }
}>()
const activeNames = ref<string[]>([])

const statusTagType = computed(() =>
  props.toolCall.status === 'complete' ? 'success' : props.toolCall.status === 'error' ? 'danger' : 'warning'
)
const statusLabelKey = computed(() =>
  props.toolCall.status === 'complete' ? 'agent.toolComplete' : props.toolCall.status === 'error' ? 'agent.toolFailed' : 'agent.toolRunning'
)
</script>

<style scoped>
.tool-call-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 10px 14px;
  margin: 6px 0;
  border-left: 3px solid var(--el-color-warning);
  animation: tool-call-in 150ms ease-out;
}

@keyframes tool-call-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.tool-call--complete { border-left-color: var(--el-color-success); }
.tool-call--error { border-left-color: var(--el-color-danger); }

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-running { color: var(--el-color-warning); }
.icon-complete { color: var(--el-color-success); }
.icon-error { color: var(--el-color-danger); }

.tool-call-name {
  font-weight: 600;
  font-family: monospace;
  font-size: 13px;
}

.tool-call-details { margin-top: 6px; }

.tool-call-json {
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  max-height: 200px;
  overflow: auto;
  margin: 0;
}

.tool-call-output {
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  margin: 0;
}
</style>
```

- [ ] **Step 2: Add i18n keys for tool states**

Add to `web/src/i18n/locales/en.json` agent section:
```json
"toolRunning": "Running...",
"toolComplete": "Complete",
```

Add to `web/src/i18n/locales/zh-CN.json` agent section:
```json
"toolRunning": "执行中...",
"toolComplete": "已完成",
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/agent/ToolCallCard.vue web/src/i18n/locales/en.json web/src/i18n/locales/zh-CN.json
git commit -m "feat: polished ToolCallCard with status colors and animations"
```

### Task 7: Polish ChatInputBar with modern design

**Files:**
- Modify: `web/src/components/agent/ChatInputBar.vue`

- [ ] **Step 1: Rewrite ChatInputBar.vue**

```vue
<template>
  <div class="chat-input-bar">
    <div class="input-wrapper">
      <el-input
        v-model="message"
        type="textarea"
        :rows="2"
        :placeholder="$t('agent.chatInputPlaceholder')"
        :autosize="{ minRows: 2, maxRows: 6 }"
        @keydown.ctrl.enter="send"
        resize="none"
      />
      <div class="input-actions">
        <el-select v-model="modelKey" :placeholder="$t('agent.selectModel')" size="small" class="model-select" clearable>
          <el-option v-for="m in enabledModels" :key="m.id" :label="m.name" :value="m.id" />
        </el-select>
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!canSend"
          size="default"
          @click="send"
        >
          {{ $t('agent.send') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePromptStore } from '../../stores/prompt'
import type { TextModelConfig } from '../../types/prompt'

const emit = defineEmits<{ send: [text: string, modelKey: string] }>()
defineProps<{ loading: boolean }>()

const promptStore = usePromptStore()
const enabledModels = computed<TextModelConfig[]>(() => promptStore.enabledModels)

const message = ref('')
const modelKey = ref('')

watch(enabledModels, (models) => {
  if (!modelKey.value && models.length > 0) {
    modelKey.value = models[0].id
  }
}, { immediate: true })

const canSend = computed(() => !!message.value.trim() && !!modelKey.value)

function send() {
  if (!canSend.value) return
  emit('send', message.value.trim(), modelKey.value)
  message.value = ''
}
</script>

<style scoped>
.chat-input-bar {
  padding: 12px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.input-wrapper {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  padding: 10px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.input-wrapper:focus-within {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.input-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  align-items: center;
  justify-content: flex-end;
}

.model-select { width: 180px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/agent/ChatInputBar.vue
git commit -m "feat: polished ChatInputBar with modern card design"
```

### Task 8: Add missing i18n keys for zh-CN

**Files:**
- Modify: `web/src/i18n/locales/zh-CN.json`

The en.json already has most keys. Ensure zh-CN has matching keys:

- [ ] **Step 1: Verify and add missing zh-CN keys**

Ensure the following keys exist in `web/src/i18n/locales/zh-CN.json` under the `agent` section:

```json
"toolRunning": "执行中...",
"toolComplete": "已完成",
"toolFailed": "失败",
```

- [ ] **Step 2: Commit**

```bash
git add web/src/i18n/locales/zh-CN.json
git commit -m "fix: add missing zh-CN i18n keys for tool states"
```

### Task 9: Build and E2E verification

**Files:**
- Modify: `web/e2e/agent-panel.spec.ts`

- [ ] **Step 1: Build**

```bash
cd web && npm run build
```

Expected: BUILD SUCCESS.

- [ ] **Step 2: Run E2E tests**

```bash
npx playwright test e2e/agent-panel.spec.ts
```

Expected: all 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/agent-panel.spec.ts
git commit -m "test: update E2E tests for streaming agent UI"
```

## Verification

1. `npx vue-tsc --noEmit` — PASS
2. `npm run build` — PASS
3. `npx playwright test e2e/agent-panel.spec.ts` — all pass
4. Manual: send message → see token-by-token streaming with blinking cursor
5. Manual: send message triggering tools → see tool call cards with live status
6. Manual: scroll up during streaming → verify auto-scroll pauses; scroll back down → resumes
