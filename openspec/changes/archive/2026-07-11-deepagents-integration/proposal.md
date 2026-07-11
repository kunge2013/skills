# Proposal: deepagents-integration

## Summary

在当前 Prompt Optimizer 服务中新增 AgentService 层，集成 LangChain.js DeepAgents 框架，实现基于 SKILL.md 的多步任务规划与子代理调度。用户通过前端提交自然语言请求后，主 agent 生成结构化执行计划（使用可用 skills），用户审核后逐个或批量触发子代理执行，每个子代理携带对应 SKILL.md 作为 system prompt，通过 SSE 流式输出结果。

## Motivation

当前应用的 LLM 交互模式是"单次请求-响应"，用户需要手动编排多步骤工作流（如 openspec propose → apply → verify）。引入 DeepAgents 后可以：

1. **自动规划** — 主 agent 根据用户意图自动拆解步骤，识别需要哪些 skills
2. **子代理执行** — 每个 step 由专用子代理执行，带着 SKILL.md 作为工作流指南
3. **用户可控** — 用户审核计划后手动触发子代理，保持透明度
4. **模型可切换** — 用户可选择不同 provider/model 驱动 agent
5. **上下文传递** — 子代理之间自动传递上一步输出作为下一步输入

这使应用从单纯的 Prompt Optimizer 升级为具备自主规划能力的 Agent 平台。

## Scope

### In Scope

- 引入 LangChain.js 依赖（`@langchain/core`, `@langchain/langgraph`, `@langchain/anthropic`, `@langchain/openai`）
- 新增 `AgentService` — 包含计划生成、子代理调度、状态管理
- 新增 `/agent/plan` API — 接收用户请求，主 agent 生成执行计划（SSE 流式）
- 新增 `/agent/plan/:id` API — 查询计划状态与详情
- 新增 `/agent/step/:id/run` API — 手动触发单个子代理执行
- 新增 `/agent/step/:id/stream` API — 子代理执行结果的 SSE 流式输出
- 新增前端 Agent 面板 — 展示计划、provider 选择器、子代理触发按钮、流式输出
- SKILL.md 注册机制 — 通过配置文件显式注册可用 skills 到 agent 的 tool list
- 子代理 system prompt 组装 — SKILL.md 内容 + 用户原始请求 + 上一步输出
- 现有 LLMService 保持不变，继续直接调用各 provider SDK
- 复用现有 ModelManager 配置，agent 使用相同 provider 的 API keys

### Out of Scope

- 不替代现有 LLMService（直接 SDK 调用）
- 不自动执行子代理（用户必须手动触发）
- 不实现 skill 之间的自动依赖解析
- 不实现异步/后台子代理（首期所有子代理都是同步的）
- 不实现 skill 动态检索/RAG（首期用配置文件显式注册）
- 不修改现有 SKILL.md 格式
- 不实现 tool result 的自动重试/回退

## Success Criteria

1. `POST /agent/plan` 能正确解析用户意图，返回包含 openspec skills 的结构化计划
2. 用户能在前端切换 provider（如 Anthropic ↔ OpenAI），计划生成使用所选模型
3. 点击子代理的 [▶] 按钮后，能通过 SSE 看到实时流式输出
4. 子代理执行时，上一步输出能正确传递到下一步的 system prompt
5. 现有 Prompt Optimizer 功能（prompt 测试、模板测试等）不受影响
6. 新增代码通过 TypeScript 类型检查，无 `any` 类型滥用
