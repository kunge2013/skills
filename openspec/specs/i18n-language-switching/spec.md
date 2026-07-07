## ADDED Requirements

### Requirement: i18n Infrastructure Setup
The application SHALL initialize `vue-i18n` with support for English (`en`) and Chinese Simplified (`zh-CN`) locales. The i18n instance SHALL be registered as a Vue plugin in `main.ts` before mounting the app. Element Plus locale configuration SHALL be synchronized with the active i18n locale.

#### Scenario: App starts with browser locale
- **WHEN** the user's browser locale is `zh-CN` or starts with `zh`
- **THEN** the application initializes with Chinese translations and Element Plus Chinese locale

#### Scenario: App starts with unsupported browser locale
- **WHEN** the user's browser locale is neither `zh-CN` nor `en`
- **THEN** the application defaults to English translations and Element Plus English locale

#### Scenario: App restores persisted locale
- **WHEN** a locale is stored in `localStorage` under the key `kungeskill:locale`
- **THEN** the application initializes with that locale, overriding browser locale detection

### Requirement: Language Switcher UI
A language switcher SHALL be visible in the navigation sidebar footer, allowing the user to toggle between English and Chinese (中文). The switcher SHALL display the currently active language and update Element Plus locale immediately upon selection.

#### Scenario: User switches to Chinese
- **WHEN** the user selects "中文" from the language switcher
- **THEN** all UI text updates to Chinese and the selection is persisted to `localStorage`

#### Scenario: User switches to English
- **WHEN** the user selects "English" from the language switcher
- **THEN** all UI text updates to English and the selection is persisted to `localStorage`

### Requirement: Translated UI Strings
All user-facing static text in the UI components (`NavSidebar.vue`, `SkillList.vue`, `SkillDetail.vue`, `SkillEditor.vue`, `StatusBar.vue`) SHALL be replaced with i18n translation keys. Translation keys SHALL be organized under semantic namespaces (e.g., `nav.*`, `list.*`, `detail.*`, `editor.*`, `status.*`).

#### Scenario: All nav sidebar text is translated
- **WHEN** the user views the navigation sidebar
- **THEN** the app title, menu items, cache status labels, and button text are displayed in the active locale

#### Scenario: All skill list text is translated
- **WHEN** the user views the skill list
- **THEN** the search placeholder, category labels, sort options, and empty state message are displayed in the active locale

#### Scenario: All skill detail text is translated
- **WHEN** the user views a skill detail page
- **THEN** the back button, metadata labels, preview heading, and action button text are displayed in the active locale

#### Scenario: All skill editor text is translated
- **WHEN** the user views the skill editor
- **THEN** the header, toolbar labels, validation messages, and action button text are displayed in the active locale

#### Scenario: All status bar text is translated
- **WHEN** the user views the marketplace status page
- **THEN** the card header, status labels, and action button text are displayed in the active locale

### Requirement: Store Action Messages
All `ElMessage` notifications (success/error) triggered by store actions SHALL use i18n keys for their message text.

#### Scenario: Success message uses active locale
- **WHEN** a store action completes successfully and shows an `ElMessage`
- **THEN** the success message text is in the active locale

#### Scenario: Error message uses active locale
- **WHEN** a store action fails and shows an `ElMessage`
- **THEN** the error message text is in the active locale
