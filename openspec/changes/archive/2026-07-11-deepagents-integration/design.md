## Context

The current Prompt Optimizer application uses a direct SDK-call architecture via `LLMService` → `ITextProviderAdapter` → provider SDKs (Anthropic, OpenAI, Gemini, DeepSeek). Each interaction is a single request-response cycle with optional SSE streaming.

This design adds a higher-level **AgentService** layer using LangChain.js DeepAgents on top of the existing infrastructure. The AgentService will:
- Accept natural language requests from users
- Generate structured execution plans using registered SKILL.md files as tools
- Allow users to review plans and trigger individual sub-agent steps
- Stream sub-agent output via SSE while preserving context between steps

**Current architecture:**
```
Frontend → POST /llm/send-stream → LLMService → ITextProviderAdapter → Provider SDK
```

**Target architecture (hybrid):**
```
Frontend → POST /agent/plan     → AgentService → DeepAgents (LangChain ChatModel) → Provider SDK
         → POST /agent/step/:id/run  → AgentService → DeepAgents → Provider SDK
Frontend → POST /llm/send-stream → LLMService → ITextProviderAdapter → Provider SDK  (unchanged)
```

**Key constraints:**
- Existing `LLMService` must remain unaffected
- Reuse existing `ModelManager` configs for API keys and model settings
- Reuse existing `ITextAdapterRegistry` to resolve protocol→adapter
- SKILL.md files are registered via config file, not RAG/dynamic retrieval
- Sub-agents are user-triggered, not automatic

## Goals / Non-Goals

**Goals:**
- Enable multi-step planning with user-visible plan structures
- Use SKILL.md content as sub-agent system prompts
- Support provider/model switching per agent session
- Stream sub-agent execution output via SSE
- Pass context between sequential sub-agent steps
- Maintain backward compatibility with all existing features

**Non-Goals:**
- No replacement of existing `LLMService`
- No automatic sub-agent execution (all steps user-triggered)
- No async/background sub-agents in phase 1
- No dynamic SKILL.md retrieval or RAG
- No modification to existing SKILL.md file format

## Decisions

### 1. LangChain ChatModel via existing adapter bridge

**Decision:** Build a thin `LangChainChatModel` wrapper that implements `@langchain/core`'s `BaseChatModel` interface but delegates to existing `ITextProviderAdapter.sendMessageStream`.

**Why:** DeepAgents requires a `BaseChatModel` instance. Rather than pulling in `@langchain/anthropic` and `@langchain/openai` as separate dependencies, we bridge through the existing adapter layer. This:
- Reuses existing API key management, connection testing, and model config
- Avoids duplicating provider-specific SDK initialization
- Keeps a single source of truth for provider credentials

**Alternatives considered:**
- *Direct LangChain provider imports* (`@langchain/anthropic`, etc.): Would require duplicating API key config, baseURL handling, and model resolution logic already in `ModelManager`. Rejected.
- *OpenAI-compatible wrapper for all providers*: Anthropic's native tool use differs from OpenAI's function calling format. Rejected to avoid format conversion bugs.

### 2. AgentService as a separate service (not extending LLMService)

**Decision:** Create `AgentService` as a new class with its own dependencies (`ModelManager`, `ITextAdapterRegistry`, `SkillRegistry`).

**Why:** The agent lifecycle (plans, steps, state management) is fundamentally different from single-request LLM calls. Separation prevents coupling and makes it easy to evolve independently.

### 3. In-memory plan storage (phase 1)

**Decision:** Store plans and steps in memory using a `Map<string, Plan>` structure.

**Why:** Phase 1 is a single-server deployment. Adding persistence adds unnecessary complexity. The in-memory store is a clean interface that can be backed by a database later without API changes.

**Alternatives considered:**
- *SQLite/PostgreSQL*: Adds migration and schema management overhead. Phase 1 does not need durability.
- *Redis*: Adds operational complexity for a feature that only needs ephemeral state.

### 4. SKILL.md as sub-agent system prompt (not as LangChain tools)

**Decision:** When executing a step, assemble the sub-agent's system prompt from: (a) SKILL.md content, (b) original user request, (c) outputs from previous steps.

**Why:** SKILL.md files contain workflow instructions and role definitions, not discrete function signatures. They map naturally to system prompts, not to LangChain tool definitions. The planning phase uses SKILL.md `name` and `description` (from frontmatter) as tool metadata for the main agent.

### 5. SSE event format extension

**Decision:** Extend the existing SSE format with agent-specific event types (`plan`, `step_start`, `step_token`, `step_reasoning`, `step_tool`, `step_complete`, `step_error`).

**Why:** The frontend already parses SSE `data: {...}` lines. Extending with typed events maintains compatibility and requires minimal frontend changes.

### 6. Provider resolution via existing `resolveProtocol`

**Decision:** The `LangChainChatModel` uses the same `resolveProtocol()` logic from `service.ts` to determine which adapter to use, then delegates to that adapter.

**Why:** Consistency with existing behavior. All provider→adapter mapping is centralized.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| LangChain dependency adds significant bundle size | Only import `@langchain/core` (types/interfaces), not full provider packages. Use tree-shaking. |
| In-memory state lost on server restart | Document as phase 1 limitation. Phase 2 adds persistence layer. |
| SKILL.md files are large and may exceed context windows | Implement SKILL.md trimming/summarization in phase 2. Phase 1: warn users if combined context exceeds model limit. |
| Adapter `sendMessageStream` may not support all DeepAgents features | Bridge layer translates between DeepAgents message format and adapter format. Test with all 4 providers. |
| Circular dependency if AgentService imports from LLMService | Both services share `ModelManager` and `ITextAdapterRegistry` as common dependencies. No direct import between them. |

## Migration Plan

1. **Add dependencies**: `@langchain/core`, `@langchain/langgraph` (DeepAgents depends on these)
2. **Create types**: `AgentService` types (`Plan`, `Step`, `SkillRegistration`, etc.)
3. **Create `LangChainChatModel`**: Thin wrapper implementing `BaseChatModel` → `ITextProviderAdapter`
4. **Create `SkillRegistry`**: Config-based registration of SKILL.md files
5. **Create `AgentService`**: Planning, step execution, state management
6. **Create `/agent/*` routes**: New Express routes
7. **Create frontend AgentPanel**: Plan display, provider selector, step execution, SSE streaming
8. **Wire up in server entry point**: Initialize `AgentService`, register routes

**Rollback**: Remove `/agent/*` routes and frontend panel. No data migration needed (in-memory state).

## Open Questions

1. **Should sub-agents also have access to SKILL.md tools, or only system prompt?** — Phase 1: system prompt only. Phase 2: evaluate whether sub-agents need tool access for multi-step workflows within a sub-agent.
2. **How to handle plan rejection/revision?** — Phase 1: user can regenerate a new plan. Phase 2: in-place plan editing.
3. **What happens if a step fails mid-stream?** — Phase 1: mark step as `failed`, allow user to re-run. Full SSE error event sent to frontend.
