## Context

当前 Agent 聊天界面的 LLM 响应通过 SSE 流式接收 token，但前端采用"watch plan completion → 一次性显示完整内容"的模式。用户看到的是 loading spinner → 完整消息突然出现，而非逐字出现的实时效果。工具调用虽支持但展示不直观。

**当前架构：**
- `useAgent.ts`：累积 `planTextBuffer` 和 `planReasoningBuffer`，plan 完成时才触发 watch
- `useAgentChat.ts`：watch `currentPlan` 变化，plan 完成后创建一条完整 ChatMessage
- `AgentMessageContent.vue`：渲染完整 content + reasoning + toolCalls
- `ToolCallCard.vue`：静态展示工具调用，无实时状态更新
- SSE handler 已具备 `onPlanToken`、`onPlanReasoning`、`onStepToken`、`onStepToolUse`、`onStepAskUser` 等回调，但仅用于 buffer 累积

**参考设计：** LangChain Agent Chat UI (https://agentchat.vercel.app)
- 逐字流式渲染，token 到达即显示
- 工具调用内嵌在消息流中，实时展示运行状态
- 用户提问弹窗优雅地中断 agent 执行

**约束：**
- 后端 SSE 协议不变（已有的 event types 完整支持所有需求）
- 使用 Vue 3 Composition API + Element Plus v2.9.0
- scoped CSS，不使用 Tailwind
- vue-i18n 用于所有用户可见文本

## Goals / Non-Goals

**Goals:**
- SSE token 到达时实时更新 UI，逐字渲染（类似 ChatGPT/Claude 效果）
- 工具调用以卡片形式实时展示 name → args → running → result 生命周期
- Agent 提问时弹出对话框，用户回答后继续执行
- 优化整体视觉设计，参考 LangChain Agent Chat UI 的现代简洁风格
- 流式输出期间平滑自动滚动，用户上滑查看时暂停

**Non-Goals:**
- 不修改后端 SSE 协议或 AgentService 逻辑
- 不引入新的外部依赖
- 不改变 Plan/Step 数据结构
- 不修改现有的 Prompt Optimizer 页面
- 不实现多线程/多会话（当前单会话即可）

## Decisions

### 1. 流式渲染：创建"活消息"ref，token 到达时直接更新 content

**Decision：** 在 `useAgentChat.ts` 中，发送消息后立即创建一条"活" agent message（type: `agent`，content 初始为空字符串，isStreaming: true），`onPlanToken` 回调中直接 append 到该 message 的 content。`onPlanComplete` 时将 isStreaming 设为 false。

**Why：** 当前方案是 plan 完成后才创建消息，用户只能看到 loading spinner。改为"先创建空消息 → token 实时更新"可以让用户看到逐字出现的效果，与 LangChain Agent Chat UI 一致。

**Alternatives considered:**
- *仅 watch planTextBuffer*：buffer 变化频繁，Vue watch 会过度触发，性能差
- *使用 Vue 3 的 shallowRef + triggerRef*：可行但复杂度高，直接 ref 更新更简洁

### 2. 工具调用：维护独立的 toolCalls ref 数组，SSE 事件驱动更新

**Decision：** ToolCall 不嵌入到 message.content 字符串中，而是作为 message 对象的独立 `toolCalls` 数组。SSE `step_tool_use` 时追加新 call，`step_tool_result` 时更新对应 call 的 result 和 status。

**Why：** 与 LangChain Agent Chat UI 一致——工具调用是结构化的，不应混入文本流。分离存储让渲染更灵活（可在消息内任意位置插入 tool call card）。

### 3. 用户提问中断：使用 el-dialog 弹出，阻塞后续 step 执行直到回答

**Decision：** SSE `step_ask_user` 事件触发时，在当前消息下方弹出 el-dialog，显示问题文本，提供输入框 + 提交按钮。用户提交后将答案通过 `POST /agent/step/:id/run` 的 `userAnswers` body 传递给后端。

**Why：** Element Plus 的 el-dialog 已提供遮罩、动画、焦点管理等功能，无需手写弹窗。与 LangChain Agent Chat UI 的 interrupt 功能对等。

### 4. 自动滚动：IntersectionObserver 检测用户是否在底部

**Decision：** 当用户滚动到消息列表底部时启用自动滚动；用户向上滚动查看历史时暂停，回到底部时恢复。

**Why：** 比"每次消息更新都 scrollIntoView"体验更好，避免用户查看历史时被强制拉回底部。

### 5. 视觉美化：保持 Element Plus 设计语言，增强而非重写

**Decision：** 使用 CSS 变量（`--el-*`）保持主题一致性，通过增加微阴影、圆角、过渡动画来提升质感。布局参考 LangChain Agent Chat UI 的 spacious、minimal 风格：更大的气泡间距、更宽的输入区域、更柔和的颜色层次。

**Why：** 与现有 Prompt Optimizer 页面保持视觉一致性，降低维护成本。不引入 Tailwind 避免与项目现有构建冲突。

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| 频繁 ref 更新可能导致 Vue 渲染性能问题 | Vue 3 的响应式系统对字符串 append 优化良好，如需节流可用 `requestAnimationFrame` |
| 流式消息在 plan_error 时显示不完整 | plan_error 时将当前流式消息转换为 error type，显示错误信息 |
| SSE 连接断开时流式消息卡住 | 添加超时保护，30 秒无新 token 则标记为完成或错误 |
| 工具调用卡片在流式中可能被截断 | 工具调用在流式文本之间内嵌渲染，不影响文本流完整性 |
