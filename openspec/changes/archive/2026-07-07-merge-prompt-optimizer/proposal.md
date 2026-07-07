# Merge Prompt Optimizer into Skills Project

## Background

We have two separate projects:
1. **Skills** (`D:\github.io\skills`) — A Claude Code skill marketplace manager with a Vue 3 + Element Plus web UI (`kungeskill web`)
2. **Prompt Optimizer** (`D:\github.io\prompt-optimizer\fullstack`) — A prompt optimization tool with Vue 3 + plain CSS UI, Express backend with LLM integration (OpenAI, Anthropic, Gemini, DeepSeek)

## Problem

Users need to switch between two separate tools. The prompt optimizer runs independently (`npm run dev`) and has a different UI style, making the experience disjointed.

## Goal

Merge the prompt optimizer into the skills project as a unified experience:
- Single CLI entry point: `kungeskill prompt` (alongside existing `kungeskill web`)
- Unified UI using Element Plus design system
- Shared data layer (models, templates, history)
- All dependencies managed in the main `package.json`

## Scope

### In scope
- Merge prompt-optimizer frontend (Vue components) into `web/src/`
- Convert prompt-optimizer UI from plain CSS/Naive UI to Element Plus components
- Merge prompt-optimizer Express backend routes into `web.js` HTTP server
- Add all prompt-optimizer dependencies to main `package.json`
- Unified i18n (merge locale files)
- Shared Pinia stores for model config, preferences
- New `prompt` CLI command

### Out of scope
- Image generation features in prompt-optimizer
- Authentication changes
- Database migration (still file-based storage)
- Existing `kungeskill web` functionality changes (kept intact)

## Impact

- **Users**: Single tool for both skill management and prompt optimization
- **Developers**: One codebase, one build process
- **Data**: Shared models and templates between features
