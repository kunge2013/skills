## Context

The KungeSkill web UI is a Vue 3 + Element Plus SPA used to browse, view, edit, and manage skills. It uses Pinia for state management. All UI text is currently hardcoded in English across five components: `NavSidebar.vue`, `SkillList.vue`, `SkillDetail.vue`, `SkillEditor.vue`, and `StatusBar.vue`. The store also uses hardcoded English strings for `ElMessage` success/error notifications.

## Goals / Non-Goals

**Goals:**
- Provide Chinese and English translations for all user-facing text
- Add a visible language toggle in the navigation sidebar
- Persist language preference in `localStorage`
- Maintain backward compatibility — no changes to component APIs or store interfaces
- Keep the implementation lightweight — minimal additional bundle size

**Non-Goals:**
- No translation of skill content (skill markdown remains as authored)
- No server-side locale support (this is a frontend-only change)
- No translation for non-critical system messages (e.g., raw API error strings)
- No auto-translation from external services

## Decisions

### 1. Use `vue-i18n` (official Vue i18n library)
**Why:** Native Vue 3 support, Composition API compatibility, small bundle (~8KB gzipped), well-maintained, and integrates cleanly with Element Plus (which also uses `vue-i18n` internally).

**Alternatives considered:**
- `@intlify/unplugin-vue-i18n` — adds build-time extraction but unnecessary complexity for this scope
- Hand-rolled i18n — fragile, misses edge cases (pluralization, date formatting)

### 2. Store translations as JSON files in `src/i18n/locales/`
**Why:** Simple, idiomatic approach. Easy to edit and review. Matches the project's small scope.

```
src/i18n/
├── index.ts          # i18n instance setup
├── locales/
│   ├── en.json       # English translations
│   └── zh-CN.json    # Chinese translations
```

### 3. Language switcher as a dropdown in NavSidebar footer
**Why:** The NavSidebar is always visible. Placing the switcher in the footer (below cache status) keeps it discoverable but unobtrusive. Using `el-select` with language names (English / 中文) is consistent with the existing UI style.

### 4. Default to browser locale, fall back to English
**Why:** Best UX for users whose browsers are already configured for their preferred language. Fallback to English covers cases where the locale isn't supported.

### 5. Persistence via `localStorage` under key `kungeskill:locale`
**Why:** Simple, reliable, no server round-trip. Namespace prevents key collision with other apps.

### 6. Use `useI18n().t()` for programmatic messages, `$t()` for template strings
**Why:** Store action messages (`ElMessage.success()`) are called from JavaScript, not templates. The Composition API's `t()` function works in script context. Templates use the shorter `$t()` global injection.

## Risks / Trade-offs

- **[Risk] Bundle size increase**: `vue-i18n` adds ~8KB. **Mitigation**: Acceptable for the UX gain; use production build which tree-shakes unused features.
- **[Risk] Incomplete translations**: Some strings might be missed. **Mitigation**: Review all components systematically; any untranslated key will show the key path (e.g., `nav.allSkills`), making it easy to spot.
- **[Risk] Element Plus locale mismatch**: Element Plus components (pagination, date pickers, etc.) have their own locale config. **Mitigation**: Configure Element Plus locale alongside `vue-i18n` locale using Element Plus's built-in locale files (`element-plus/es/locale/lang/zh-cn`).
- **[Trade-off] Manual translation**: Translations are hand-authored, not machine-generated. Higher quality, but more effort to maintain. Future expansion to additional languages will require more manual work.

## Migration Plan

1. Install `vue-i18n` dependency
2. Create i18n infrastructure (setup, locale files)
3. Wire i18n into `main.ts`
4. Replace hardcoded strings component by component (NavSidebar → StatusBar → SkillList → SkillDetail → SkillEditor)
5. Wire store messages to i18n
6. Build and verify all text renders correctly in both languages

**Rollback**: Remove the i18n plugin registration and restore original hardcoded strings. No data migration needed since `localStorage` key is namespaced.
