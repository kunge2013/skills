## 1. Setup & Infrastructure

- [x] 1.1 Add `vue-i18n` dependency to `web/package.json`
- [x] 1.2 Create `web/src/i18n/index.ts` — i18n instance setup with `createI18n()`, locale detection from browser/localStorage, fallback to `en`
- [x] 1.3 Create `web/src/i18n/locales/en.json` — English translation file with all keys
- [x] 1.4 Create `web/src/i18n/locales/zh-CN.json` — Chinese translation file mirroring en.json keys
- [x] 1.5 Wire i18n into `web/src/main.ts` — import and `app.use(i18n)` before mount

## 2. Language Switcher Component

- [x] 2.1 Add language switcher UI to `NavSidebar.vue` footer — `el-select` with English / 中文 options
- [x] 2.2 Implement locale change handler — update `i18n.global.locale`, sync Element Plus locale, persist to `localStorage`
- [x] 2.3 Add i18n translation keys for nav sidebar text (`nav.title`, `nav.allSkills`, `nav.cacheStatus`, etc.)

## 3. Translate All Components

- [x] 3.1 Translate `StatusBar.vue` — status labels, card header, button text, version label
- [x] 3.2 Translate `SkillList.vue` — search placeholder, category/select labels, sort options, empty state
- [x] 3.3 Translate `SkillDetail.vue` — back button, metadata labels, preview heading, action buttons
- [x] 3.4 Translate `SkillEditor.vue` — header, validation messages, action buttons, discard message
- [x] 3.5 Translate `skills.ts` store — all `ElMessage.success()` and `ElMessage.error()` message strings

## 4. Verify & Test

- [x] 4.1 Build the web app (`npm run build`) and verify no TypeScript errors
- [x] 4.2 Verify Chinese locale renders correctly for all UI text
- [x] 4.3 Verify English locale renders correctly for all UI text
- [x] 4.4 Verify locale persists across page refresh via `localStorage`
- [x] 4.5 Verify Element Plus components (buttons, tags, menus) display in correct locale
