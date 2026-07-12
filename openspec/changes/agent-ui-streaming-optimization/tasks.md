## 1. Streaming Token Rendering

- [ ] 1.1 Add `isStreaming` and `streamingContent` fields to ChatMessage type
- [ ] 1.2 Update `useAgentChat.ts` to create a streaming agent message immediately on send, append `plan_token` to it in real-time
- [ ] 1.3 Update `useAgent.ts` to expose `onPlanToken`, `onPlanReasoning` callbacks that trigger reactive updates (not just buffer accumulation)
- [ ] 1.4 Update `ChatMessageList.vue` to implement auto-scroll with pause-on-scroll (IntersectionObserver pattern)
- [ ] 1.5 Update `ChatMessageBubble.vue` to show streaming cursor animation when `isStreaming: true`
- [ ] 1.6 Replace the static loading spinner with an animated thinking indicator bubble that transitions to streaming on first token

## 2. Tool Call Real-Time Visualization

- [ ] 2.1 Update `useAgent.ts` to expose `onStepToolUse`, `onStepToolResult` callbacks that update a reactive `toolCalls` array on the current streaming message
- [ ] 2.2 Rewrite `ToolCallCard.vue` with polished design: tool name header, collapsible args (code block), expandable result, status-colored indicators (blue/green/red)
- [ ] 2.3 Update `AgentMessageContent.vue` to render tool call cards inline within the message flow, between text segments

## 3. User Question Interrupt Support

- [ ] 3.1 Add `question` state and dialog handler to `useAgentChat.ts`
- [ ] 3.2 Wire `onStepAskUser` SSE callback to trigger a user question dialog
- [ ] 3.3 Create `UserQuestionDialog.vue` component with el-dialog, text input, submit/cancel buttons
- [ ] 3.4 Wire submit answer to `POST /agent/step/:id/run` with `userAnswers` body

## 4. Visual Polish

- [ ] 4.1 Redesign chat bubble styles: larger padding, smoother border-radius, subtle shadows, hover effects (aligned with LangChain Agent Chat UI aesthetic)
- [ ] 4.2 Redesign `ChatInputBar.vue`: cleaner layout, model selector and send button on same row, rounded input area
- [ ] 4.3 Redesign `AgentMessageContent.vue`: better spacing between text/reasoning/tool-calls, smoother transitions
- [ ] 4.4 Add i18n keys for new UI text (thinking indicator, tool states, question dialog)

## 5. Build & E2E Verification

- [ ] 5.1 `npx vue-tsc --noEmit` — PASS
- [ ] 5.2 `npm run build` — PASS
- [ ] 5.3 Update `web/e2e/agent-panel.spec.ts` for streaming behavior (token-by-token appearance, tool call cards visible during execution)
- [ ] 5.4 `npx playwright test e2e/agent-panel.spec.ts` — all pass
- [ ] 5.5 Manual test: send message → verify token-by-token streaming → verify tool call cards → verify reasoning collapsible
