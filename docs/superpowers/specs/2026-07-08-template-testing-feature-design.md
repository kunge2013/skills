# 模板测试功能设计文档

**日期**: 2026-07-08
**作者**: Claude + fangkun
**状态**: 设计完成,待评审

---

## 概述

为提示词维护系统的模板编辑弹窗添加测试功能,允许用户在编辑模板时快速测试提示词效果,支持变量输入、模型选择、流式输出,并保存测试历史记录。

## 核心需求

### 功能需求

1. **智能变量提取**: 从 System 和 User Prompt 中提取所有 `{{var}}` 变量,区分系统变量和用户变量
2. **用户配置系统变量**: 用户可在模板编辑时标记哪些变量是系统变量
3. **变量输入**: 根据检测到的用户变量动态生成输入框
4. **模型选择**: 从已配置的模型中选择测试模型,记住上次选择
5. **测试执行**: 支持普通测试和流式测试
6. **结果显示**: 实时显示模型返回结果
7. **历史保存**: 按模板ID分文件存储测试历史
8. **历史查看**: 独立的测试历史查看页面

### 非功能需求

- 响应式UI,支持移动端
- 测试历史支持分页加载
- 错误处理友好,不中断用户操作
- 支持国际化(中英文)

---

## 数据结构设计

### Template 类型扩展

```typescript
// web/src/types/prompt.ts
export interface Template {
  id: string
  name: string
  description?: string
  type: string
  templateType: 'simple' | 'advanced'
  content: { system: string; user?: string }
  category?: string

  // 新增字段
  systemVariables?: string[]  // 系统变量列表,测试时自动填充或隐藏
}
```

**示例**:
```json
{
  "id": "optimize-general",
  "name": "General Optimize",
  "type": "optimize",
  "templateType": "advanced",
  "content": {
    "system": "You are an expert. {{originalPrompt}}",
    "user": "{{originalPrompt}}"
  },
  "systemVariables": ["originalPrompt"]
}
```

### TemplateTestRecord 类型

```typescript
// web/src/types/prompt.ts
export interface TemplateTestRecord {
  id: string
  templateId: string
  templateName: string

  // 用户输入的变量值
  variables: Record<string, string>

  // 替换后的提示词
  processedSystemPrompt: string
  processedUserPrompt: string

  // 模型信息
  modelKey: string
  modelInfo: {
    id: string
    name: string
    providerId: string
  }

  // 测试结果
  output: string
  timestamp: number
  duration?: number  // 毫秒
}
```

**示例**:
```json
{
  "id": "uuid-123",
  "templateId": "optimize-general",
  "templateName": "General Optimize",
  "variables": {
    "customVar1": "value1",
    "customVar2": "value2"
  },
  "processedSystemPrompt": "You are an expert. value1",
  "processedUserPrompt": "value2",
  "modelKey": "gpt-4",
  "modelInfo": {
    "id": "gpt-4",
    "name": "GPT-4",
    "providerId": "openai"
  },
  "output": "模型返回的结果...",
  "timestamp": 1234567890,
  "duration": 2345
}
```

### 存储结构

```
data/
├── history.json              # 现有优化历史
├── templates.json            # 现有模板存储
└── template-tests/           # 新增目录
    ├── optimize-general.json
    ├── user-optimize-professional.json
    └── {templateId}.json     # 每个模板一个文件
```

**存储策略**:
- 每个模板最多保留100条测试记录
- 记录按时间倒序排列(最新在前)
- 支持手动删除单条记录或清空历史

---

## 前端架构设计

### 文件结构

```
web/src/
├── components/prompt/
│   ├── TemplateForm.vue              # 修改: 添加变量配置和测试面板
│   ├── VariableConfigSection.vue     # 新增: 变量配置组件
│   ├── TemplateTestPanel.vue         # 新增: 测试面板组件
│   └── TemplateTestHistoryView.vue   # 新增: 测试历史查看页面
├── composables/
│   └── useTemplateVariables.ts       # 新增: 变量解析和处理逻辑
└── views/
    └── PromptOptimizer.vue           # 修改: 添加测试历史标签页
```

### useTemplateVariables Composable

**职责**: 变量提取、过滤和替换

```typescript
// composables/useTemplateVariables.ts
export function useTemplateVariables(
  systemPrompt: Ref<string>,
  userPrompt: Ref<string>,
  systemVariables: Ref<string[]>
) {
  // 提取所有变量
  const allVariables = computed(() => {
    const vars = new Set<string>()
    const pattern = /\{\{(\w+)\}\}/g

    let match
    while ((match = pattern.exec(systemPrompt.value)) !== null) {
      vars.add(match[1])
    }
    while ((match = pattern.exec(userPrompt.value)) !== null) {
      vars.add(match[1])
    }

    return Array.from(vars)
  })

  // 用户需要输入的变量 = 全部变量 - 系统变量
  const userVariables = computed(() => {
    return allVariables.value.filter(v => !systemVariables.value.includes(v))
  })

  // 替换变量
  const replaceVariables = (
    text: string,
    values: Record<string, string>
  ): string => {
    let result = text
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }
    return result
  }

  return {
    allVariables,
    userVariables,
    replaceVariables
  }
}
```

### VariableConfigSection 组件

**职责**: 显示检测到的变量列表,允许用户标记系统变量

**UI 结构**:
```
┌─────────────────────────────────────┐
│ 变量配置                 [扫描变量] │
├─────────────────────────────────────┤
│ ☑ originalPrompt [系统变量]         │
│ ☐ customVar1     [用户变量]         │
│ ☐ customVar2     [用户变量]         │
└─────────────────────────────────────┘
```

**交互流程**:
1. 用户点击"扫描变量"
2. 系统检测所有 `{{var}}`
3. 显示变量列表,每个变量带复选框
4. 用户勾选系统变量
5. 选择保存到 `template.systemVariables`

### TemplateTestPanel 组件

**职责**: 提供测试界面,包括模型选择、变量输入、测试执行

**UI 结构**:
```
┌─────────────────────────────────────┐
│ 🧪 测试模板 (可折叠)                │
├─────────────────────────────────────┤
│ 模型选择: [GPT-4           ▼]       │
├─────────────────────────────────────┤
│ 变量输入                             │
│ ├─ customVar1: [输入框]             │
│ └─ customVar2: [输入框]             │
├─────────────────────────────────────┤
│ [测试] [流式测试]                    │
├─────────────────────────────────────┤
│ 测试结果                             │
│ ┌─────────────────────────────────┐ │
│ │ 模型返回内容...                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**状态管理**:
- `selectedModel`: 选择的模型(持久化到 localStorage)
- `variableValues`: 变量值映射
- `testOutput`: 测试输出结果
- `testing`: 测试中状态
- `testError`: 错误信息

### TemplateTestHistoryView 组件

**职责**: 查看和管理测试历史记录

**UI 结构**:
```
┌─────────────────────────────────────┐
│ 模板测试历史                         │
│ [选择模板 ▼]                         │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ General Optimize  2024-01-15    │ │
│ │ 变量: {"var": "value"}          │ │
│ │ 输出: 模型返回内容预览...        │ │
│ │ [查看详情] [删除]                │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Professional Optimizer ...      │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**功能**:
- 按模板筛选历史记录
- 查看完整测试详情
- 删除单条记录
- 清空模板历史

### TemplateForm 修改

**修改点**:
1. 引入 `useTemplateVariables` composable
2. 添加 `VariableConfigSection` 组件
3. 添加 `TemplateTestPanel` 组件(仅编辑模式显示)
4. 保存时包含 `systemVariables` 字段

**布局**:
```
┌─────────────────────────────────────┐
│ 模板名称: [输入框]                  │
│ 模板类型: [下拉框]                  │
│ System Prompt: [编辑器]             │
│ User Prompt: [编辑器]               │
├─────────────────────────────────────┤
│ 变量配置 (新增)                     │
│ └─ VariableConfigSection            │
├─────────────────────────────────────┤
│ 测试面板 (新增,仅编辑模式)          │
│ └─ TemplateTestPanel                │
├─────────────────────────────────────┤
│ [保存] [取消]                        │
└─────────────────────────────────────┘
```

---

## 后端架构设计

### 文件结构

```
src/server/
├── routes/
│   ├── prompts.ts                    # 修改: 添加测试模板路由
│   └── template-test-history.ts      # 新增: 测试历史路由
├── services/
│   ├── prompt/service.ts             # 修改: 添加测试模板方法
│   └── template-test/
│       ├── manager.ts                # 新增: 测试历史管理器
│       └── types.ts                  # 新增: 类型定义
└── storage/
    ├── types.ts                      # 修改: 扩展接口
    └── template-tests/               # 新增目录
```

### TemplateTestHistoryManager

**职责**: 管理测试历史的增删查

```typescript
// services/template-test/manager.ts
export class TemplateTestHistoryManager {
  private storage: IStorageProvider
  private baseDir: string = 'template-tests'

  // 获取测试历史
  async getRecords(templateId?: string): Promise<TemplateTestRecord[]>

  // 添加测试记录
  async addRecord(record: TemplateTestRecord): Promise<void>

  // 删除记录
  async deleteRecord(recordId: string): Promise<void>

  // 清空模板历史
  async clearHistory(templateId: string): Promise<void>
}
```

**关键逻辑**:
- `getRecords(templateId)`:
  - 有 templateId: 返回单个模板的历史
  - 无 templateId: 合并所有模板的历史并按时间排序
- `addRecord`:
  - 添加到文件开头
  - 限制最多100条记录

### API 路由设计

#### GET /api/v1/template-test-history

**描述**: 获取测试历史

**查询参数**:
- `templateId` (可选): 模板ID

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "templateId": "optimize-general",
      "templateName": "General Optimize",
      "variables": {"var": "value"},
      "output": "...",
      "timestamp": 1234567890
    }
  ]
}
```

#### POST /api/v1/template-test-history

**描述**: 添加测试记录(通常由测试流程自动调用)

**请求体**: TemplateTestRecord

**响应**:
```json
{
  "success": true,
  "data": { "id": "new-uuid" }
}
```

#### DELETE /api/v1/template-test-history/:id

**描述**: 删除单条测试记录

**响应**:
```json
{
  "success": true
}
```

#### DELETE /api/v1/template-test-history/template/:templateId

**描述**: 清空指定模板的测试历史

**响应**:
```json
{
  "success": true
}
```

#### POST /api/v1/prompts/test-template-stream

**描述**: 测试模板(流式输出)

**请求体**:
```json
{
  "templateId": "optimize-general",
  "templateName": "General Optimize",
  "variables": {"var": "value"},
  "processedSystemPrompt": "...",
  "processedUserPrompt": "...",
  "modelKey": "gpt-4",
  "modelInfo": {"id": "gpt-4", "name": "GPT-4", "providerId": "openai"},
  "saveHistory": true
}
```

**响应**: SSE 流
```
data: {"token": "模"}
data: {"token": "型"}
data: {"done": true, "fullText": "模型返回内容..."}
```

### IStorageProvider 扩展

```typescript
// storage/types.ts
export interface IStorageProvider {
  // 现有方法
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>

  // 新增方法
  listItems?(dir: string): Promise<string[]>
  deleteItem?(key: string): Promise<void>
}
```

---

## 用户操作流程

### 模板编辑流程

```
1. 用户打开编辑弹窗
   ↓
2. 编写 System/User Prompt (包含 {{变量}})
   ↓
3. 点击"扫描变量"
   ↓
4. 系统显示变量列表
   ↓
5. 用户勾选系统变量
   ↓
6. 保存模板
```

### 模板测试流程

```
1. 在编辑弹窗中展开测试面板
   ↓
2. 选择测试模型
   ↓
3. 输入变量值
   ↓
4. 点击"测试"或"流式测试"
   ↓
5. 系统处理:
   ├─ 替换变量
   ├─ 发送 SSE 请求
   ├─ 流式显示结果
   └─ 自动保存历史
   ↓
6. 用户查看结果
```

### 历史查看流程

```
1. 切换到"Template Tests"标签页
   ↓
2. (可选) 选择特定模板筛选
   ↓
3. 浏览历史记录列表
   ↓
4. 点击"查看详情"查看完整内容
   ↓
5. (可选) 删除单条记录
```

---

## 错误处理策略

### 前端错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 未选择模型 | 禁用测试按钮,显示提示 |
| 变量未填写完整 | 禁用测试按钮 |
| 模型不存在 | 显示错误提示:"选择的模型不存在或未启用" |
| API密钥未配置 | 显示错误提示:"模型API密钥未配置" |
| 网络错误 | 显示错误提示,允许重试 |
| SSE连接断开 | 显示部分结果,提示"连接中断" |

### 后端错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 模板不存在 | 返回 404 错误 |
| 模型不存在 | 返回 400 错误 |
| 存储失败 | 记录日志,不中断用户操作 |
| LLM调用失败 | 通过 SSE 返回错误信息 |

---

## 国际化支持

### 新增翻译键

```typescript
// 中文
prompt: {
  testTemplate: '测试模板',
  selectModelPlaceholder: '请选择模型',
  variableInput: '变量输入',
  scanVariables: '扫描变量',
  variableConfig: '变量配置',
  systemVariable: '系统变量',
  userVariable: '用户变量',
  noVariables: '未检测到变量,请使用 {{variableName}} 格式',
  templateTestHistory: '模板测试历史',
  allTemplates: '全部模板',
  viewDetail: '查看详情',
  testDuration: '耗时',
  clearHistory: '清空历史',
  confirmClearHistory: '确定要清空该模板的所有测试历史吗?'
}

// 英文
prompt: {
  testTemplate: 'Test Template',
  selectModelPlaceholder: 'Please select a model',
  variableInput: 'Variable Input',
  scanVariables: 'Scan Variables',
  variableConfig: 'Variable Configuration',
  systemVariable: 'System Variable',
  userVariable: 'User Variable',
  noVariables: 'No variables detected, use {{variableName}} format',
  templateTestHistory: 'Template Test History',
  allTemplates: 'All Templates',
  viewDetail: 'View Detail',
  testDuration: 'Duration',
  clearHistory: 'Clear History',
  confirmClearHistory: 'Are you sure to clear all test history for this template?'
}
```

---

## 实施计划

### 阶段一: 核心功能 (本次实施)

**目标**: 实现基础测试功能

**任务清单**:
1. 扩展数据类型定义
2. 创建 `useTemplateVariables` composable
3. 创建 `VariableConfigSection` 组件
4. 创建 `TemplateTestPanel` 组件
5. 修改 `TemplateForm` 集成新组件
6. 创建后端 `TemplateTestHistoryManager`
7. 添加 API 路由
8. 修改 `PromptService` 支持模板测试
9. 创建 `TemplateTestHistoryView` 组件
10. 修改 `PromptOptimizer` 添加标签页
11. 添加国际化翻译

### 阶段二: 优化改进 (后续迭代)

**目标**: 改进用户体验

**优化方向**:
1. 编辑器变量高亮显示
2. 点击变量名快速配置
3. 变量输入支持多行文本
4. 测试历史支持搜索
5. 测试结果导出功能
6. 批量测试功能

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| MdEditor插件开发复杂 | 中 | 阶段一使用简化方案,阶段二再优化 |
| SSE连接超时 | 低 | 添加心跳机制,提供重试按钮 |
| 存储文件过大 | 低 | 限制每个模板最多100条记录 |
| 变量名冲突 | 中 | 使用正则严格匹配变量名格式 |
| 用户输入XSS | 中 | 前端显示时转义HTML |

---

## 验收标准

### 功能验收

- [ ] 能正确检测模板中的变量
- [ ] 用户能标记系统变量
- [ ] 测试面板能动态生成变量输入框
- [ ] 模型选择能记住上次选择
- [ ] 测试能正常执行并显示结果
- [ ] 流式测试能实时更新输出
- [ ] 测试历史能正确保存
- [ ] 历史页面能正确显示记录
- [ ] 能删除单条历史记录
- [ ] 能清空模板历史

### 性能验收

- [ ] 变量扫描响应时间 < 100ms
- [ ] 测试历史加载时间 < 500ms
- [ ] 单个历史文件大小 < 1MB

### 兼容性验收

- [ ] 支持主流浏览器(Chrome, Firefox, Safari, Edge)
- [ ] 响应式布局支持移动端
- [ ] 中英文切换正常

---

## 附录

### 变量命名规范

- 仅支持字母、数字、下划线
- 必须以字母开头
- 推荐使用驼峰命名: `{{userPrompt}}`, `{{customVar}}`
- 系统变量推荐: `originalPrompt`, `lastOptimizedPrompt`, `iterateInput`

### 示例模板

```json
{
  "id": "custom-template-1",
  "name": "Custom Template",
  "type": "optimize",
  "templateType": "advanced",
  "content": {
    "system": "You are an expert in {{domain}}.\n\nTask: {{task}}",
    "user": "{{userInput}}"
  },
  "systemVariables": [],
  "category": "custom"
}
```

测试时需要输入:
- `domain`: 领域名称
- `task`: 任务描述
- `userInput`: 用户输入

---

**文档版本**: 1.0
**最后更新**: 2026-07-08
