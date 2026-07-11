## 1. Dependencies & Types

- [ ] 1.1 Add `@langchain/core` and `@langchain/langgraph` to `package.json`
- [ ] 1.2 Create `src/server/services/agent/types.ts` with `Plan`, `Step`, `SkillRegistration`, `AgentPlanRequest`, `AgentStepRunRequest`, `SSEEvent` interfaces
- [ ] 1.3 Create `src/server/services/agent/registry.ts` with `ISkillRegistry` interface and `SkillRegistry` implementation

## 2. Skill Registration

- [ ] 2.1 Implement `SkillRegistry` — load SKILL.md files from configured paths, parse frontmatter, store name/description/content
- [ ] 2.2 Add skill registration config (e.g., `agent.skills.json` or extend existing config)
- [ ] 2.3 Create `GET /agent/skills` endpoint returning registered skills list
- [ ] 2.4 Register ~5 openspec skills as initial set (propose, apply, verify, archive, explore)

## 3. LangChain ChatModel Bridge

- [ ] 3.1 Create `src/server/services/agent/langchain-chat-model.ts` implementing `BaseChatModel` interface
- [ ] 3.2 Implement `_generate()` method delegating to `ITextProviderAdapter.sendMessage`
- [ ] 3.3 Implement `_streamResponseChunks()` delegating to `ITextProviderAdapter.sendMessageStream`
- [ ] 3.4 Implement provider resolution via existing `resolveProtocol()` logic
- [ ] 3.5 Add unit tests for message format translation between LangChain and adapter formats

## 4. AgentService Core

- [ ] 4.1 Create `src/server/services/agent/service.ts` with `AgentService` class
- [ ] 4.2 Implement in-memory plan store (`Map<string, Plan>`)
- [ ] 4.3 Implement `createPlan(request: AgentPlanRequest)` — main agent generates plan using registered skills as tools
- [ ] 4.4 Implement `getPlan(id: string)` — retrieve plan by ID
- [ ] 4.5 Implement `runStep(stepId: string, callbacks: StreamHandlers)` — execute single step with SKILL.md system prompt + context
- [ ] 4.6 Implement context assembly: load SKILL.md content, append prior step outputs, assemble system prompt

## 5. API Routes

- [ ] 5.1 Create `src/server/routes/agent.ts` with Express route registration
- [ ] 5.2 Implement `POST /agent/plan` — create plan, SSE stream
- [ ] 5.3 Implement `GET /agent/plan/:id` — return plan JSON
- [ ] 5.4 Implement `POST /agent/step/:id/run` — trigger step execution, SSE stream
- [ ] 5.5 Implement error handling for 400/404/409 cases per specs
- [ ] 5.6 Wire agent routes into server entry point with `AgentService` instance

## 6. Frontend Agent Panel

- [ ] 6.1 Create `src/components/agent/AgentPanel.tsx` component
- [ ] 6.2 Add agent input area with provider/model selector dropdown
- [ ] 6.3 Implement plan generation with SSE streaming display
- [ ] 6.4 Render plan steps with status indicators and [▶] run buttons
- [ ] 6.5 Implement step execution SSE streaming with live output display
- [ ] 6.6 Add context passthrough visualization (show prior step outputs)
- [ ] 6.7 Add error state handling for failed steps with re-run option

## 7. Integration & Verification

- [ ] 7.1 Test plan generation with all 4 providers (Anthropic, OpenAI, Gemini, DeepSeek)
- [ ] 7.2 Test end-to-end flow: plan → review → run step 1 → run step 2 → complete
- [ ] 7.3 Verify existing LLMService `/llm/*` endpoints are unaffected
- [ ] 7.4 Verify TypeScript type checking passes with no new `any` violations
- [ ] 7.5 Manual test: switch providers mid-session, verify new plan uses selected model
