# Agent UI 全面整改设计文档

> **目标**：参考 LangChain Agent Chat UI，全面重写 Agent 聊天界面，实现逐字流式渲染、工具调用可视化、用户提问中断、以及现代化视觉设计。

## 架构概述

采用 **"活消息" (Live Message) 模式**：用户发送消息后立即创建一个空的 agent 消息气泡（`isStreaming: true`），SSE token 到达时逐字填充内容，工具调用事件到达时内嵌插入工具卡片，plan 完成时标记气泡为完成状态。

### 数据流

```
用户发送文本
  │
  ├─► 创建 user message（立即显示）
  │
  ├─► 创建 agent message（isStreaming: true, content: ""）
  │
  └─► POST /agent/plan (SSE)
       │
       ├─ plan_token      → agent.message.content += token（逐字追加）
       ├─ plan_reasoning  → agent.message.reasoning += reasoning
       ├─ step_tool_use   → agent.message.toolCalls.push(new ToolCall)
       ├─ step_tool_result→ 更新对应 ToolCall 的 result + status
       ├─ step_ask_user   → 弹出 UserQuestionDialog，等待回答
       ├─ plan_complete   → isStreaming = false
       └─ plan_error      → 转换为 error message
```

## 组件设计

### 1. ChatMessageList.vue — 消息列表容器

**职责**：渲染所有消息 + 自动滚动 + 流式指示器

**关键设计**：
- 使用 `IntersectionObserver` 检测用户是否在底部（观察一个 1px 的锚点元素）
- `isUserAtBottom` ref 控制自动滚动行为：在底部时新 token 触发 `scrollIntoView({ behavior: 'smooth' })`，不在底部时不触发
- 流式进行中且无消息时显示 "思考中..." 动画指示器
- 移除旧的 `isLoading` prop，改用 `hasActiveStreamingMessage` 计算属性

### 2. ChatMessageBubble.vue — 消息气泡包装器

**职责**：根据消息类型渲染不同风格的气泡

**关键设计**：
- 用户消息：右侧对齐，`background: var(--el-color-primary)`，白色文字，`border-radius: 16px 16px 4px 16px`
- Agent 消息：左侧对齐，`background: var(--el-fill-color-light)`，`border: 1px solid var(--el-border-color-lighter)`，`border-radius: 16px 16px 16px 4px`
- 错误消息：危险色边框 + 红色图标
- 流式消息：末尾添加闪烁光标动画（`<span class="streaming-cursor">|</span>`）
- 每个气泡入场时添加 `fade-in-up` CSS 动画（`transform: translateY(8px)` → `0`，`opacity: 0` → `1`）

### 3. AgentMessageContent.vue — Agent 消息内容

**职责**：渲染 Markdown 文本 + 工具调用卡片 + 可折叠思考内容

**关键设计**：
- 使用 `markdown-it` 将 `message.content` 转为 HTML，通过 `v-html` 渲染
- 工具调用卡片内嵌在 Markdown 文本之后（保持简单；后续可扩展为在文本中间插入）
- 思考内容使用 `el-collapse` 展示，默认折叠，带脑图标 + "思考"标签
- 代码块使用 `highlight.js` 语法高亮（如果项目已有；否则保持无高亮）

### 4. ToolCallCard.vue — 工具调用卡片

**职责**：实时展示工具调用的完整生命周期

**关键设计**：
- **Header 行**：工具图标 + 工具名称 + 状态指示器
  - running: 蓝色旋转 spinner
  - complete: 绿色 ✓
  - error: 红色 ✗
- **参数区域**：`el-collapse` 折叠展示 JSON 参数，使用 monospace 字体
- **结果区域**：展开显示工具返回文本，支持 Markdown 渲染
- 入场动画：卡片出现时 `scale(0.95)` → `scale(1)` + `opacity: 0` → `1`

### 5. ChatInputBar.vue — 输入栏

**职责**：消息输入 + 模型选择 + 发送

**关键设计**：
- 单行布局：左侧 textarea（2行），右侧竖向排列模型选择器 + 发送按钮
- 发送按钮：loading 时显示 spinner，无消息或无模型时 disabled
- 圆角卡片设计：`border-radius: 12px`，`box-shadow: 0 2px 8px rgba(0,0,0,0.06)`
- 支持 Ctrl+Enter 发送

### 6. UserQuestionDialog.vue — 用户提问弹窗

**职责**：Agent 执行中向用户提问，等待回答后继续

**关键设计**：
- `el-dialog` 居中弹出，宽度 480px
- 标题："Agent 向你提问"
- 问题文本区域（带引号样式）
- 输入框 + 提交按钮 + 取消按钮
- 提交后将答案传递给 `POST /agent/step/:id/run` 的 `userAnswers` body

## 状态管理

### useAgentChat.ts（简化后）

```typescript
interface StreamingMessageState {
  isStreaming: boolean;
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
}

// 核心方法
sendMessage(text, modelKey):
  1. 创建 user message 推入 messages
  2. 创建 agent message (isStreaming: true) 推入 messages
  3. 调用 agent.createPlan(text, modelKey, handlers)
  
handlers:
  onPlanToken(token)     → 当前 agent message.content += token
  onPlanReasoning(r)     → 当前 agent message.reasoning += r
  onStepToolUse(data)    → toolCalls.push({ ...data, status: 'running' })
  onStepToolResult(data) → 找到对应 toolCall，更新 result + status = 'complete'
  onStepAskUser(data)    → 触发 questionDialog，等待回答后继续 step
  onPlanComplete(plan)   → isStreaming = false
  onPlanError(err)       → 转换 message 为 error type
```

### 清理决策

| 文件 | 操作 | 原因 |
|------|------|------|
| `AgentInput.vue` | 删除 | 死代码，不被任何组件使用 |
| `PlanView.vue` | 保留但不用 | chat-only 模式下不渲染，保留以备未来恢复 |
| `StepCard.vue` | 保留但不用 | 同上 |
| `StepOutput.vue` | 保留但不用 | 同上 |
| `useAgent.planTextBuffer` | 保留 | 向下兼容，但不再是主要渲染来源 |

## 依赖

**新增依赖**：
- `markdown-it` — Markdown 渲染（~50KB，成熟稳定）
- `@types/markdown-it` — TypeScript 类型定义

**不新增依赖**：代码高亮暂不引入 `highlight.js`，保持轻量。后续可按需添加。

## 视觉设计规范

| 元素 | 规范 |
|------|------|
| 用户气泡 | 主色背景，白字，16px/16px/4px/16px 圆角 |
| Agent 气泡 | 浅色背景，1px 边框，16px/16px/16px/4px 圆角，悬停阴影 |
| 工具卡片 | 1px 边框，8px 圆角，4px 左边框（状态色） |
| 输入栏 | 12px 圆角，微阴影，focus 时主色边框 |
| 思考指示器 | 旋转脑图标 + "思考中..." 文字，灰色 |
| 流式光标 | `|` 字符，CSS `animation: blink 1s step-end infinite` |
| 入场动画 | `fade-in-up`: 0→1 opacity, 8px→0 translateY, 200ms ease-out |

## 错误处理

| 场景 | 处理 |
|------|------|
| SSE 连接断开 | 当前流式消息转为 error，显示"连接中断" |
| plan_error 事件 | 当前流式消息转为 error，显示错误文本 |
| step 执行失败 | 对应 toolCall 标记为 error，显示错误信息 |
| 用户取消回答 | 对应 step 标记为 failed，显示"用户取消" |
| Markdown 解析失败 | 降级为纯文本显示 |

## 测试策略

1. **E2E 测试**（Playwright）：
   - 验证流式消息逐字出现（检查 content 长度随时间增长）
   - 验证工具调用卡片出现和状态变化
   - 验证自动滚动跟随 + 暂停行为
   - 验证用户提问弹窗出现和回答流程

2. **手动测试**：
   - 发送消息 → 观察 token-by-token 流式效果
   - 发送触发工具调用的消息 → 观察卡片实时状态
   - 流式输出期间上滑 → 验证暂停自动滚动
   - 回到底部 → 验证恢复自动滚动
