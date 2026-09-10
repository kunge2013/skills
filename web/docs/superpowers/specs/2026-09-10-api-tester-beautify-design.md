# ApiTester.vue 界面美化设计

日期: 2026-09-10
状态: 已批准（用户确认 "可以"）

## 背景与目标

`web/src/components/ApiTester.vue` 当前的请求输入框和响应 JSON 展示区使用 VS Code 深色主题（背景 `#1e1e1e`、文字 `#d4d4d4`），界面观感偏暗、缺乏交互反馈。用户反馈：

- 界面太丑，尤其请求输入框和响应 JSON 框
- 格式化能力不够明显
- 响应/请求背景颜色太深
- 选中无动态效果

用户确认方向：**浅色主题** + **格式化增强**（醒目按钮/发送前自动格式化/响应自动美化/右键菜单）+ **动态效果**（括号高亮动画/输入框聚焦动效/按钮按压反馈/面板过渡）。

## 现状分析

- `jsonHighlight.ts` 提供 `highlightJson`、`buildBracketMap`、`isBracket`，负责语法着色与括号配对标记。
- store 的 `sendRawRequest` 已对响应做 `JSON.stringify(data, null, 2)` 美化。
- 组件已有：语法高亮、手动格式化按钮、括号匹配高亮、textarea+pre 叠层编辑器。

## 改动方案（集中于 ApiTester.vue 单文件）

### 1. 浅色主题重绘（CSS）

- 编辑器/响应框背景 `#1e1e1e` → `#fdfdfe`，面板卡片底色 `#f5f7fa` 风格，边框 `#dcdfe6`
- 正文颜色 `#d4d4d4` → `#1f2328`
- 语法高亮 token 改为 VS Code Light+ 配色：
  - `.tok-key`: `#0550ae`
  - `.tok-string`: `#a31515`
  - `.tok-number`: `#098658`
  - `.tok-keyword`: `#0000ff`
  - `.tok-bracket`: 背景 `#cfe8ff`、文字 `#0550ae`
  - `.tok-bracket-region`: 背景 `rgba(5,80,174,0.06)`
- 光标 `caret-color` → `#1f2328`
- 滚动条 thumb 改为浅灰 `#c1c1c1`
- 编辑器内边框 `#3c3c3c` → 浅色 `#e0e0e0`

### 2. 格式化增强（script + template）

- **发送前自动格式化**：`onSend` 先对 `payloadText` 做 `JSON.stringify(JSON.parse(...), null, 2)`，成功则回写展示并以其发送，失败提示 `invalidJson` 并中断。
- **格式化按钮更醒目**：加图标（`MagicStick`）+ 文字，样式优化。
- **响应自动美化**：保留 store 现有 pretty-print；`highlightedOutput` 不变，纯文本响应原样显示。
- **右键菜单**：输入框与响应框各自包裹 `el-dropdown`（`trigger="contextmenu"`）：
  - 输入框：格式化 / 复制 / 清空
  - 响应框：复制（有内容时可用）

### 3. 动态效果（CSS + 少量模板）

- **括号高亮动画**：`.tok-bracket` 加淡入 + 微光 keyframe（重渲染自动重播）。
- **输入框聚焦动效**：`.json-editor:focus-within` 蓝色发光 ring，`box-shadow` 过渡。
- **按钮悬停/按压**：`:active` 时 `scale(0.97)`，`transition` 过渡。
- **面板过渡**：卡片淡入上移（mount 动画）；响应内容切换时淡入。

## 变更：改用 CodeMirror 6（2026-09-10 用户确认）

用户确认将手写编辑器替换为 **CodeMirror 6**（`vue-codemirror` + `@codemirror/lang-json`），以省去自维护的高亮/括号匹配/滚动同步，提升稳定性。

- 新增依赖：`vue-codemirror`、`codemirror`、`@codemirror/lang-json`、`@codemirror/language`、`@codemirror/state`、`@codemirror/view`、`@codemirror/commands`、`@lezer/highlight`（其中核心包模板已预装，现显式声明）
- 新建 `web/src/utils/jsonCodeMirror.ts`：导出浅色 `EditorView.theme`、JSON 语法 `HighlightStyle`（VS Code Light+ 配色）、可编辑与只读两组 extensions、`formatJson` 帮助函数
- 请求编辑器改为 `<Codemirror v-model="payloadText">`，内置高亮/括号匹配/折叠/行号
- 响应框改为只读 `<Codemirror :model-value>`（`EditorState.readOnly.of(true)`，保留点击括号匹配）
- 删除组件内自实现：textarea+pre 叠层、`syncScroll`、`onInputActive`、`onOutputClick`、`activeInputPair`/`outputPair`、`highlightJson`/`buildBracketMap`/`isBracket` 使用
- 聚焦动效改为编辑器外层 div 的 `:focus-within` 蓝色 ring；括号高亮由 `.cm-matchingBracket` 样式 + 过渡实现
- `jsonHighlight.ts` 保留：`LLMCallLogs.vue` 仍在使用

## 非目标 / 保持不变

- 不改 store
- `jsonHighlight.ts` 保留（供 LLMCallLogs 使用）
- 保留格式化/右键菜单/发送前自动格式化逻辑
- 保留 `[AGC]` 标签

## 验证

- `vue-tsc` 类型检查 / build 通过
- 浏览器验证：浅色观感、发送前自动格式化、右键菜单、括号高亮动画、聚焦动效
