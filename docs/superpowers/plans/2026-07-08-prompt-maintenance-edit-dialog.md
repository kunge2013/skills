# Prompt Maintenance: Edit Template Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use kunge2013:subagent-driven-development (recommended) or kunge2013:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline edit form with an el-dialog modal to fix invisible save buttons and improve visual design.

**Architecture:** Move the `TemplateForm` component from inside template cards into an `el-dialog` popup. The dialog opens when user clicks "Edit" on a custom template. State changes from `editingTemplateId` (v-if guard) to `showEditDialog` (dialog v-model). Create form stays inline as card.

**Tech Stack:** Vue 3 (Composition API), Element Plus, TypeScript, vue-i18n

**Base directory:** `D:\github.io\skills\web`

---

### Task 1: Add i18n keys for dialog title

**Files:**
- Modify: `src/i18n/locales/zh-CN.json:213`
- Modify: `src/i18n/locales/en.json:213`

- [ ] **Step 1.1: Add key to zh-CN.json**

Open `src/i18n/locales/zh-CN.json`. Add the `editTemplate` key after `confirmDeleteTemplate` (line 213), before the closing `}`:

```json
    "confirmDeleteTemplate": "确定要删除模板「{name}」吗？",
    "editTemplate": "编辑模板：{name}"
  }
}
```

The exact edit to the file — replace:

```json
    "confirmDeleteTemplate": "确定要删除模板「{name}」吗？"
  }
}
```

With:

```json
    "confirmDeleteTemplate": "确定要删除模板「{name}」吗？",
    "editTemplate": "编辑模板：{name}"
  }
}
```

- [ ] **Step 1.2: Add key to en.json**

Open `src/i18n/locales/en.json`. Add the `editTemplate` key after `confirmDeleteTemplate` (line 213), before the closing `}`:

Replace:

```json
    "confirmDeleteTemplate": "Are you sure you want to delete the template \"{name}\"?"
  }
}
```

With:

```json
    "confirmDeleteTemplate": "Are you sure you want to delete the template \"{name}\"?",
    "editTemplate": "Edit Template: {name}"
  }
}
```

- [ ] **Step 1.3: Validate JSON syntax**

Run:
```bash
cd D:\github.io\skills\web && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh-CN.json','utf8'))" && echo "zh-CN.json: OK" && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'))" && echo "en.json: OK"
```

Expected: Both files output `OK`. If you get `SyntaxError`, check for missing commas or unescaped quotes.

- [ ] **Step 1.4: Commit**

```bash
cd D:\github.io\skills\web && git add src/i18n/locales/zh-CN.json src/i18n/locales/en.json
git commit -m "feat: add editTemplate i18n key for dialog title"
```

---

### Task 2: Replace inline edit form with el-dialog

**Files:**
- Modify: `src/components/prompt/PromptMaintenanceView.vue` (template + script)
- No changes to: `src/components/prompt/TemplateForm.vue`

- [ ] **Step 2.1: Update the template section**

In `PromptMaintenanceView.vue`, do two things:

**A) Remove the inline `TemplateForm` from inside the template cards (lines 60-68):**

Delete these lines:
```vue
        <!-- Edit Form -->
        <TemplateForm
          v-if="editingTemplateId === template.id"
          :template="editForm"
          :providers="templateTypes"
          :is-edit="true"
          @save="onUpdate"
          @cancel="cancelEdit"
        />
```

**B) Add the `<el-dialog>` after the template list closing tag and before the `<el-empty>` tag.**

Place it after the `</div>` that closes `.template-list` (line 70), before `<el-empty>` (line 72):

```vue
    <!-- Edit Dialog -->
    <el-dialog
      v-model="showEditDialog"
      :title="t('prompt.editTemplate', { name: editForm.name })"
      width="800px"
      :close-on-click-modal="false"
      @close="cancelEdit"
    >
      <TemplateForm
        :template="editForm"
        :providers="templateTypes"
        :is-edit="true"
        @save="onUpdate"
        @cancel="cancelEdit"
      />
    </el-dialog>
```

The template section after changes should look like this (lines 20-73):

```vue
    <!-- Template List -->
    <div class="template-list">
      <el-card
        v-for="template in store.templates"
        :key="template.id"
        shadow="never"
        class="template-card"
      >
        <div class="template-header">
          <div class="template-info">
            <span class="template-name">{{ template.name }}</span>
            <el-tag size="small" type="info">{{ template.type }}</el-tag>
            <el-tag v-if="!store.isCustomTemplate(template.id)" size="small" type="warning">
              {{ t('prompt.builtIn') }}
            </el-tag>
          </div>
          <div class="template-actions">
            <el-button size="small" @click="store.selectAndOptimize(template)">
              {{ t('prompt.optimize') }}
            </el-button>
            <el-button
              v-if="store.isCustomTemplate(template.id)"
              size="small"
              @click="startEdit(template)"
            >
              {{ t('prompt.edit') }}
            </el-button>
            <el-button
              v-if="store.isCustomTemplate(template.id)"
              type="danger"
              size="small"
              @click="onDelete(template)"
            >
              {{ t('prompt.delete') }}
            </el-button>
          </div>
        </div>

        <div class="template-preview">{{ truncate(template.content.system) }}</div>
      </el-card>
    </div>

    <!-- Edit Dialog -->
    <el-dialog
      v-model="showEditDialog"
      :title="t('prompt.editTemplate', { name: editForm.name })"
      width="800px"
      :close-on-click-modal="false"
      @close="cancelEdit"
    >
      <TemplateForm
        :template="editForm"
        :providers="templateTypes"
        :is-edit="true"
        @save="onUpdate"
        @cancel="cancelEdit"
      />
    </el-dialog>

    <el-empty v-if="store.templates.length === 0" :description="t('prompt.emptyTemplates')" />
```

- [ ] **Step 2.2: Update the script section**

Replace the `editingTemplateId` state and update `startEdit` / `cancelEdit` functions.

Replace:
```typescript
const showCreateForm = ref(false)
const editingTemplateId = ref<string | null>(null)
```

With:
```typescript
const showCreateForm = ref(false)
const showEditDialog = ref(false)
```

Replace:
```typescript
function startEdit(template: Template) {
  editingTemplateId.value = template.id
  editForm.id = template.id
  editForm.name = template.name
  editForm.type = template.type
  editForm.content = { system: template.content.system, user: template.content.user || '' }
  editForm.description = template.description || ''
  editForm.category = template.category || ''
}

function cancelEdit() {
  editingTemplateId.value = null
}
```

With:
```typescript
function startEdit(template: Template) {
  editForm.id = template.id
  editForm.name = template.name
  editForm.type = template.type
  editForm.content = { system: template.content.system, user: template.content.user || '' }
  editForm.description = template.description || ''
  editForm.category = template.category || ''
  showEditDialog.value = true
}

function cancelEdit() {
  showEditDialog.value = false
}
```

- [ ] **Step 2.3: Run type check**

```bash
cd D:\github.io\skills\web && npx vue-tsc --noEmit 2>&1
```

Expected: No errors. If you see `Property 'editingTemplateId' does not exist on type...`, it means there's a stale reference — search for `editingTemplateId` in the file and ensure it's fully removed.

- [ ] **Step 2.4: Commit**

```bash
cd D:\github.io\skills\web && git add src/components/prompt/PromptMaintenanceView.vue
git commit -m "feat: move edit form to el-dialog modal"
```

---

### Task 3: Verify end-to-end

**Files:**
- No new files
- Reference: `e2e/prompt-maintenance.spec.ts` (existing E2E tests)

- [ ] **Step 3.1: Manual smoke test**

Start the dev server:
```bash
cd D:\github.io\skills\web && npm run dev
```

Then verify:
1. Click "Prompt Maintenance" in sidebar → maintenance view loads
2. Click "Edit" on a custom template → dialog opens with title "编辑模板：xxx"
3. Dialog shows TemplateForm with editors, save/cancel buttons visible
4. Click "Cancel" → dialog closes, template card returns to normal
5. Edit again, make a change, click "Save" → template updates, dialog closes
6. Click "创建模板" → inline create form still works (unchanged)

- [ ] **Step 3.2: Run existing E2E tests**

```bash
cd D:\github.io\skills\web && npx playwright test e2e/prompt-maintenance.spec.ts --reporter=list 2>&1
```

Expected: All 4 existing tests pass. Our changes do not affect the existing test assertions (menu items, page loading, tabs) — those tests verify structural elements that haven't changed.

- [ ] **Step 3.3: Run full build check**

```bash
cd D:\github.io\skills\web && npm run build 2>&1
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3.4: Commit (if any fixes needed)**

If any issues were found and fixed:
```bash
cd D:\github.io\skills\web && git add .
git commit -m "fix: address E2E/build verification issues"
```
