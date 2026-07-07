## Why

The KungeSkill web UI currently displays all text in English, limiting usability for Chinese-speaking users. As a growing number of users are Chinese speakers, adding i18n support for both Chinese and English will improve accessibility and user experience across both audiences.

## What Changes

- Add `vue-i18n` as a dependency to the web frontend
- Create translation files (`zh-CN.json`, `en.json`) covering all UI text
- Add a language switcher component in the NavSidebar for toggling between Chinese and English
- Persist the selected language preference in `localStorage` so it survives page refreshes
- Replace all hardcoded English strings in Vue components with `$t()` i18n calls
- Default to browser locale; fall back to English if unsupported
- No breaking changes — existing functionality remains unchanged

## Capabilities

### New Capabilities

- `i18n-language-switching`: Internationalization infrastructure including locale setup, language switcher UI, locale persistence, and translated strings for all user-facing UI text

### Modified Capabilities

<!-- No existing spec-level behavior changes -->

## Impact

- **Dependencies**: Adds `vue-i18n` to `web/package.json`
- **Components**: All Vue components with hardcoded text (`NavSidebar.vue`, `SkillList.vue`, `SkillDetail.vue`, `SkillEditor.vue`, `StatusBar.vue`)
- **Store**: `skills.ts` store — may need locale-aware messages for `ElMessage` calls
- **New files**: `src/i18n/` directory with locale files and i18n setup module
