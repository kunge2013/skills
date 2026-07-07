# Design: Merge Prompt Optimizer

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        kungeskill CLI                           │
│                                                                 │
│   kungeskill web     → 技能市场 (port 3010)                     │
│   kungeskill prompt  → 提示词优化器 (port 3011)                 │
│                                                                 │
│   两个命令共享同一套后端代码，不同端口                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Web 前端 (web/src/)                        │
│                                                                 │
│  App.vue (统一外壳)                                              │
│  ├── NavSidebar.vue                                             │
│  │   ├── 技能市场 (currentView: 'list')                         │
│  │   ├── 技能详情 (currentView: 'detail')                       │
│  │   ├── 技能编辑 (currentView: 'editor')                       │
│  │   ├── 技能管理 (currentView: 'manage')                       │
│  │   └── 提示词优化器 (currentView: 'prompt') ◀ 新增            │
│  └── MainContent                                                │
│      ├── SkillList / SkillDetail / SkillEditor / SkillManage    │
│      └── prompt/                                                │
│          ├── OptimizeView.vue   (优化提示词)                    │
│          ├── IterateView.vue    (迭代提示词)                    │
│          ├── TestView.vue       (测试提示词)                    │
│          ├── ModelsView.vue     (模型管理)                      │
│          ├── HistoryView.vue    (历史记录)                      │
│          └── PromptSettingsView.vue (设置)                      │
│                                                                 │
│  Stores:                                                        │
│  ├── stores/skills.ts        (现有)                             │
│  └── stores/prompt.ts        (新增)                             │
│                                                                 │
│  API Client:                                                    │
│  ├── window.api.*            (现有，技能市场 API)               │
│  └── api-client.ts           (新增，prompt 优化器 API)          │
│                                                                 │
│  i18n: 合并 locales/en.json, locales/zh-CN.json                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      后端 (web.js HTTP Server)                  │
│                                                                 │
│  现有 API:                        新增 API:                     │
│  /api/marketplace/*               /api/v1/models/*              │
│  /api/skill/*                     /api/v1/prompts/*             │
│  /api/fs/*                        /api/v1/llm/*                 │
│  /api/git/*                       /api/v1/templates/*           │
│                                 /api/v1/history/*               │
│                                 /api/v1/preferences/*           │
│                                 /api/v1/data/*                  │
│                                 /api/v1/favorites/*             │
│                                 /health                         │
│                                                                 │
│  服务层 (从 prompt-optimizer 搬入):                              │
│  ├── LLMService (OpenAI/Anthropic/Gemini/DeepSeek adapters)     │
│  ├── ModelManager                                                 │
│  ├── TemplateManager                                              │
│  ├── HistoryManager                                               │
│  ├── FavoriteManager                                                │
│  ├── PreferenceService                                              │
│  ├── DataManager                                                  │
│  └── ContextManager                                               │
│                                                                 │
│  存储: FileStorageProvider (data/ 目录)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Backend Design

### HTTP Server Modification

web.js 的 `createServer()` 需要扩展：

1. **路由分发**：现有 `/api/*` 保持不变，新增 `/api/v1/*` 路由组
2. **SSE 支持**：LLM 流式输出需要 SSE headers (`text/event-stream`)
3. **静态文件**：构建后 `dist/` 由 HTTP 服务器 serve
4. **CORS**：开发环境允许 localhost 跨域

### Express → Native HTTP Migration

prompt-optimizer 使用 Express，需要转换为原生 Node HTTP handlers：

```
Express route          →  HTTP handler switch case
app.get('/api/v1/models')  →  case '/api/v1/models': GET models
app.post('/api/v1/prompts/optimize')  →  case '/api/v1/prompts/optimize': POST
```

SSE 流式端点需要特殊处理：
```javascript
// SSE handler
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*'
});
// Write events: res.write(`data: ${JSON.stringify(event)}\n\n`);
```

## Frontend Design

### Component Conversion

| 原始 | 转换后 |
|------|--------|
| `<textarea>` | `<el-input type="textarea">` |
| `<select>` | `<el-select>` |
| `<button>` | `<el-button>` |
| `<input>` | `<el-input>` |
| Plain CSS dark theme | Element Plus dark theme variables |
| Manual tab system | `<el-tabs>` + `<el-tab-pane>` |
| `v-if` workspace divs | `<el-tab-pane>` children |

### Navigation

在 `NavSidebar.vue` 增加导航项：
```
◀ 技能市场
◀ 提示词优化器    ◀ 新增
◀ 技能管理
◀ 系统状态
```

点击「提示词优化器」时 `store.setView('prompt')`，显示优化器主组件。

### CSS Theming

- 复用 Element Plus 默认主题
- 暗色模式通过 CSS variables 覆盖
- 统一背景色、字体、间距

## Data Sharing Design

### 共享模型配置

```typescript
// stores/prompt.ts
interface ModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerId: string;
  apiKey: string;
  baseURL?: string;
}
```

模型配置存储在 `data/models/` 目录，两个功能模块共用。

### 模板互用

技能模板可以作为提示词模板使用：
```
SKILL.md (技能)  →  template.content (提示词模板)
```

### 统一存储

所有数据通过 `FileStorageProvider` 存储在 `data/` 目录：
```
data/
├── models/       # 模型配置
├── templates/    # 提示词模板
├── history/      # 优化历史
├── favorites/    # 收藏
├── preferences/  # 用户偏好
└── contexts/     # 上下文配置
```

## File Structure

```
skills/
├── src/
│   ├── cli.js                      # 新增: prompt 命令
│   ├── commands/
│   │   ├── web.js                  # 扩展: 新增 /api/v1/* 路由
│   │   └── prompt.js               # 新增: cmdPrompt() 入口
│   └── server/                     # 新增: 从 prompt-optimizer 搬入
│       ├── services/
│       │   ├── llm/               # LLM adapters
│       │   ├── model/             # Model manager
│       │   ├── template/          # Template manager
│       │   ├── history/           # History manager
│       │   ├── favorite/          # Favorite manager
│       │   ├── preference/        # Preference service
│       │   ├── data/              # Data manager
│       │   ├── context/           # Context manager
│       │   └── image/             # Image service
│       ├── middleware/
│       │   ├── cors.ts
│       │   ├── rate-limit.ts
│       │   ├── auth.ts
│       │   └── error-handler.ts
│       ├── routes/
│       │   ├── health.ts
│       │   ├── auth.ts
│       │   ├── llm.ts
│       │   ├── models.ts
│       │   ├── prompts.ts
│       │   ├── templates.ts
│       │   ├── history.ts
│       │   ├── favorites.ts
│       │   ├── preferences.ts
│       │   ├── images.ts
│       │   ├── image-models.ts
│       │   ├── data.ts
│       │   └── contexts.ts
│       ├── config/
│       │   └── environment.ts
│       └── storage/
│           └── file-provider.ts
├── web/
│   ├── src/
│   │   ├── main.ts                # 扩展: 不改动
│   │   ├── App.vue                # 扩展: 新增 prompt view
│   │   ├── style.css              # 扩展: 全局样式
│   │   ├── i18n/
│   │   │   ├── index.ts           # 扩展
│   │   │   └── locales/
│   │   │       ├── en.json        # 扩展: 新增 prompt.* keys
│   │   │       └── zh-CN.json     # 扩展: 新增 prompt.* keys
│   │   ├── stores/
│   │   │   ├── skills.ts          # 不改动
│   │   │   └── prompt.ts          # 新增
│   │   ├── components/
│   │   │   ├── NavSidebar.vue     # 扩展: 新增 prompt 导航项
│   │   │   └── prompt/            # 新增目录
│   │   │       ├── PromptView.vue       # 主容器 (el-tabs)
│   │   │       ├── OptimizeView.vue     # 优化 tab
│   │   │       ├── IterateView.vue      # 迭代 tab
│   │   │       ├── TestView.vue         # 测试 tab
│   │   │       ├── ModelsView.vue       # 模型管理 tab
│   │   │       ├── HistoryView.vue      # 历史记录 tab
│   │   │       └── PromptSettingsView.vue # 设置 tab
│   │   ├── api/                   # 新增: 从 prompt-optimizer 搬入
│   │   │   ├── api-client.ts
│   │   │   └── services.ts
│   │   ├── types/
│   │   │   ├── skill.ts           # 不改动
│   │   │   └── prompt.ts          # 新增
│   │   └── utils/
│   │       └── referenceParser.ts # 不改动
│   └── package.json               # 扩展: 新增依赖
├── data/                          # 新增: prompt 数据存储
├── package.json                   # 扩展: 新增 express, openai 等
├── tsconfig.json                  # 扩展: 包含 server/ TypeScript
└── tsconfig.server.json           # 新增: server 端 TS 配置
```

## Build & Run

### 开发模式
```bash
# 技能市场 (保持不变)
kungeskill web

# 提示词优化器 (新命令)
kungeskill prompt
```

### 构建
```bash
cd web && npm run build    # 构建前端 → web/dist/
```

### 依赖管理
```bash
npm install                # 安装所有依赖 (express, openai, etc.)
```
