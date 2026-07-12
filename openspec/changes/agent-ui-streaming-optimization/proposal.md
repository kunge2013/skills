## Why

当前 Agent 对话界面存在两个核心问题：1）界面布局和视觉设计不够美观，缺乏现代 AI 聊天产品的舒适感；2）LLM 响应是一次性显示完整内容，缺少逐字流式渲染的实时效果，工具调用也没有可视化展示。参考 https://github.com/langchain-ai/agent-chat-ui 的成品效果（https://agentchat.vercel.app），需要全面整改现有 Agent 界面，实现 token-by-token 流式渲染、工具调用实时可视化、以及优雅的用户交互体验。

## What Changes

- **流式渲染**：Agent 响应从"一次性显示"改为"逐字实时渲染"，每个 token 到达时立即显示，类似 ChatGPT/Claude 效果
- **工具调用可视化**：工具调用以内嵌卡片形式展示，实时显示 name → args → running → result 的完整生命周期
- **界面美化**：参考 LangChain Agent Chat UI 的设计风格，优化聊天气泡、输入栏、布局层次，使用 Tailwind-free 的现代 CSS（保持项目现有的 scoped CSS 风格）
- **自动滚动优化**：流式输出期间平滑跟随，用户向上滚动查看历史时暂停自动滚动
- **骨架屏/打字指示器**：LLM 思考期间显示优雅的动画指示器
- **中断/用户提问支持**：Agent 执行中可向用户提问，弹窗等待回答后继续

## Capabilities

### New Capabilities
- `agent-chat-streaming`: 前端 SSE 流式 token 逐字渲染能力，包括 plan_token、step_token 的实时更新
- `agent-chat-tool-calls`: 工具调用实时可视化，展示 tool name、arguments、running status、result
- `agent-chat-interrupts`: Agent 执行中向用户提问的交互能力（step_ask_user SSE 事件）

### Modified Capabilities
- `agent-step-execution`: 前端 SSE step_token/step_tool/step_ask_user 事件需要支持实时渲染（不仅是完整输出显示）

## Impact

- **修改文件**：`web/src/components/agent/` 下的全部聊天组件
- **修改 composable**：`web/src/composables/useAgentChat.ts` 和 `useAgent.ts` 的 streaming handler 逻辑
- **修改 types**：`web/src/types/chat.ts` 和 `web/src/types/agent.ts` 的 ToolCall 类型
- **依赖**：无新增依赖，仅使用现有 Vue 3 响应式系统和 Element Plus 组件
- **不影响**：后端 API、SSE 协议、AgentService 逻辑均保持不变（已支持所有需要的 SSE event type）
