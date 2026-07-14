```markdown
# skills Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you how to contribute to a TypeScript/Express codebase with a modern, test-driven workflow. You'll learn the coding conventions, file organization, and step-by-step processes for implementing features, adding API endpoints, improving test coverage, and building internationalized frontend components. The repository emphasizes clear commit practices, modular code, and robust testing using Vitest.

## Coding Conventions

- **File Naming:** Use `camelCase` for files, e.g., `agentService.ts`, `userRoutes.ts`.
- **Import Style:** Use relative imports.
  ```typescript
  import { getAgent } from './agentService';
  ```
- **Export Style:** Use named exports.
  ```typescript
  // agentService.ts
  export function getAgent(id: string) { /* ... */ }
  ```
- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) with prefixes like `feat`, `fix`, or `test`.
  ```
  feat(agent): add agent registration endpoint
  fix(agent): handle missing agent ID error
  test(agent): add tests for agent deletion
  ```

## Workflows

### Feature Implementation with Tests
**Trigger:** When adding a new backend or frontend feature that requires both implementation and tests  
**Command:** `/new-service-with-tests`

1. Create or update implementation files in `src/server/services/agent/` or `src/server/routes/`.
2. Create or update corresponding test files in `tests/server/services/agent/` or `tests/server/routes/`.
3. Update or add type definitions if needed.
4. Update `package.json` if new dependencies are required.

**Example:**
```typescript
// src/server/services/agent/agentService.ts
export function createAgent(data: AgentData) { /* ... */ }

// tests/server/services/agent/agentService.test.ts
import { createAgent } from '../../../src/server/services/agent/agentService';
import { describe, it, expect } from 'vitest';

describe('createAgent', () => {
  it('should create an agent', () => {
    // test logic
  });
});
```

---

### Test Coverage and Bugfix Cycle
**Trigger:** When improving reliability by adding tests or fixing issues found in review  
**Command:** `/add-tests-and-fix`

1. Add or update test files to cover missing scenarios or edge cases.
2. Fix bugs or refactor code in implementation files based on findings.
3. Update related type definitions or configuration if necessary.

**Example:**
```typescript
// tests/server/services/agent/agentService.test.ts
it('should handle invalid agent data', () => {
  // test for edge case
});
```

---

### API Endpoint Addition with Wiring and Tests
**Trigger:** When exposing new backend functionality via HTTP routes  
**Command:** `/add-api-endpoint`

1. Create or update route handler file in `src/server/routes/`.
2. Wire new route into the server entry point (`src/server/index.ts`).
3. Add or update corresponding test file in `tests/server/routes/`.
4. Update `package.json` if dependencies change.

**Example:**
```typescript
// src/server/routes/agentRoutes.ts
import { Router } from 'express';
import { createAgent } from '../services/agent/agentService';

export const agentRoutes = Router();
agentRoutes.post('/agents', (req, res) => {
  // handler logic
});

// src/server/index.ts
import { agentRoutes } from './routes/agentRoutes';
app.use('/api', agentRoutes);
```

---

### Frontend Component Feature with i18n
**Trigger:** When adding or modifying frontend features that require new components and i18n support  
**Command:** `/add-frontend-feature-i18n`

1. Create or update Vue component(s) in `web/src/components/agent/`.
2. Update or add i18n strings in `web/src/i18n/locales/en.json` and `zh-CN.json`.
3. Wire components into parent views (e.g., `App.vue`, `NavSidebar.vue`).
4. Update related composables or stores if needed.

**Example:**
```vue
<!-- web/src/components/agent/AgentCard.vue -->
<template>
  <div>{{ $t('agent.name') }}: {{ agent.name }}</div>
</template>
<script setup lang="ts">
defineProps<{ agent: Agent }>();
</script>
```
```json
// web/src/i18n/locales/en.json
{
  "agent": {
    "name": "Agent Name"
  }
}
```

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test Files:** Use the `*.test.ts` pattern, colocated in `tests/server/services/agent/` or `tests/server/routes/`.
- **Typical Structure:**
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { someFunction } from '../../../src/server/services/agent/someService';

  describe('someFunction', () => {
    it('should do something', () => {
      // assertions
    });
  });
  ```

## Commands

| Command                     | Purpose                                                        |
|-----------------------------|----------------------------------------------------------------|
| /new-service-with-tests      | Scaffold a new backend or frontend feature with test coverage  |
| /add-tests-and-fix           | Add missing tests and fix bugs or review findings              |
| /add-api-endpoint            | Add a new API endpoint, wire it, and provide tests             |
| /add-frontend-feature-i18n   | Add or update frontend components with i18n support            |
```