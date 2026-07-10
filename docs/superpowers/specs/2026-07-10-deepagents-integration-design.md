# DeepAgents Integration Design

**Date**: 2026-07-10
**Status**: Draft
**Change**: openspec/changes/deepagents-integration

## Overview

在当前 Prompt Optimizer 服务中新增 `AgentService` 层，集成 LangChain DeepAgents 框架，实现基于 SKILL.md 的多步任务规划与子代理调度。用户通过前端提交自然语言请求后，主 agent 生成结构化执行计划，用户审核后逐个触发子代理执行，子代理支持多轮对话、工具调用、以及向用户提问暂停等待回复。

## Architecture

```
Frontend (Vue 3)
├── NavSidebar ← 新增 "Agent" 导航项
├── AgentPanel ← 主面板
│   ├── AgentInput (输入 + Provider/Model 选择)
│   ├── PlanView (SSE 流式 → 结构化卡片)
│   ├── StepCard (步骤状态 + [▶] 按钮)
│   ├── StepOutput (流式输出)
│   └── UserQuestionDialog (子代理提问弹窗)
├── useAgent.ts (composable + 状态管理)
└── GlobalEventBus (SSE 事件转发)

Backend (Express)
├── AgentService
│   ├── createPlan() → LangChain ChatModel + registered skills
│   ├── getPlan() → 查询计划
│   └── runStep() → 子代理执行（SSE 流式）
├── SkillRegistry (自动扫描所有 SKILL.md)
├── LangChainChatModel (桥接层: config 转换 → LangChain 官方 LLM 调用)
└── SSE 事件分发 (10 种事件类型)

LangChain Ecosystem
├── @langchain/anthropic → @anthropic-ai/sdk
├── @langchain/openai → openai (Gemini/DeepSeek)
└── DeepAgents planning + sub-agent orchestration
```

核心数据流：
1. 用户在 AgentPanel 输入 → POST `/agent/plan`
2. `AgentService.createPlan()` 用 LangChain ChatModel + 注册 skills 生成 Plan（SSE 流式）
3. 前端渲染为结构化步骤卡片，用户审核
4. 用户点击 [▶] → POST `/agent/step/:id/run` → 子代理执行（SSE 流式）
5. 子代理可用 SKILL.md 定义的工具，可暂停向用户提问

## Data Models

### Plan
```typescript
interface Plan {
  id: string;
  userMessage: string;
  providerId: string;
  modelKey: string;
  status: 'planning' | 'pending_review' | 'executing' | 'done' | 'failed';
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}
```

### Step
```typescript
interface Step {
  id: string;
  planId: string;
  skillName: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'waiting_user';
  output: string | null;
  error?: string;
  userQuestions?: UserQuestion[];
  runAt?: string;
}
```

### UserQuestion
```typescript
interface UserQuestion {
  question: string;
  answer: string | null;
}
```

### SkillRegistration
```typescript
interface SkillRegistration {
  name: string;
  description: string;
  filePath: string;
  content: string;         // 不含 frontmatter
  tools: SkillTool[];
}
```

### API Requests
```typescript
interface CreatePlanRequest {
  userMessage: string;
  providerId: string;
  modelKey: string;
}

interface RunStepRequest {
  userAnswers?: UserQuestion[];
}
```

## SSE Event Format

| Event | Payload | 用途 |
|-------|---------|------|
| `plan_token` | `{ token }` | 流式计划文本 |
| `plan_complete` | `{ plan: Plan }` | 完整计划 JSON |
| `plan_error` | `{ error }` | 计划生成失败 |
| `step_start` | `{ stepId, skillName, title }` | 步骤开始 |
| `step_token` | `{ stepId, token }` | 流式输出文本 |
| `step_reasoning` | `{ stepId, reasoning }` | 推理过程 |
| `step_tool_use` | `{ stepId, toolName, args }` | 工具调用 |
| `step_tool_result` | `{ stepId, toolName, result }` | 工具结果 |
| `step_ask_user` | `{ stepId, question }` | 暂停等回复 |
| `step_complete` | `{ stepId, output }` | 步骤完成 |
| `step_error` | `{ stepId, error }` | 步骤失败 |

## Frontend Component Structure

```
web/src/
├── components/agent/
│   ├── AgentPanel.vue
│   ├── AgentInput.vue
│   ├── PlanView.vue
│   ├── StepCard.vue
│   ├── StepOutput.vue
│   └── UserQuestionDialog.vue
├── composables/
│   └── useAgent.ts
├── utils/
│   └── eventBus.ts
├── api/
│   └── agent.ts
└── types/
    └── agent.ts
```

## Error Handling

| 场景 | 处理方式 |
|------|---------|
| 计划生成失败（LLM 超时） | SSE `plan_error`，前端重试 |
| 用户断开连接 | 清理执行状态，step 标记 `failed` |
| SKILL.md 文件缺失 | 启动 warn，不阻塞 |
| 子代理提问后用户超时 | 30 分钟超时 → `failed` |
| 重复点击 [▶] | 409 Conflict |
| 已完成 plan 重复请求 | 返回现有 plan |
| modelKey 无效 | 400 错误 |

## Implementation Phases

1. **Dependencies & Types** — 添加 LangChain 依赖，定义类型
2. **Skill Registry** — 自动扫描注册所有 SKILL.md
3. **LangChain Bridge** — LangChainChatModel 桥接层
4. **AgentService Core** — Plan 管理 + 子代理执行
5. **API Routes** — `/agent/*` 端点
6. **Frontend AgentPanel** — 完整 UI + SSE 集成
7. **Integration & Testing** — 全链路验证
