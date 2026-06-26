# Skills 使用指南

## openspec-workflow 插件

### openspec-explore

**触发方式**: `/opsx:explore`

探索模式——在写代码前思考清楚。用于：
- 模糊需求的深入理解
- 方案对比与权衡
- 架构问题的分析
- 卡点时的突破

**示例**:
```
User: /opsx:explore add-real-time-collaboration
You: [探索实时协作的技术方案、复杂度、集成点]
```

### openspec-propose

**触发方式**: `/opsx:propose <change-name>`

一键生成变更提案，包含：
- `proposal.md` — 什么、为什么
- `design.md` — 怎么做
- `tasks.md` — 实施步骤

**示例**:
```
User: /opsx:propose add-dark-mode
You: [生成 proposal.md、design.md、tasks.md]
```

### openspec-apply-change

**触发方式**: `/opsx:apply [<change-name>]`

按任务清单实施变更。逐个完成任务，标记进度。

**示例**:
```
User: /opsx:apply add-dark-mode
You: [实施 task 1/5: 创建主题上下文...]
     [实施 task 2/5: 添加颜色变量...]
```

### openspec-archive-change

**触发方式**: `/opsx:archive [<change-name>]`

归档完成的变更。可选同步 delta specs 到主规范。

**示例**:
```
User: /opsx:archive add-dark-mode
You: [归档到 openspec/changes/archive/2026-06-26-add-dark-mode/]
```

---

## openspec-trace 插件

### opst-code-anysic

**触发方式**: `/opst:code-anysic`

分析已归档的 OpenSpec 变更代码，提取业务逻辑并归档到知识库：
- 读取变更上下文
- 分析代码变更（Controller/Service/Entity）
- 生成五段式设计文档（接口定义、业务流程图、业务逻辑、ER图、源码清单）
- 维护三级索引（全局索引、模块索引、版本历史）

**示例**:
```
User: /opst:code-anysic add-payment-method
You: [分析代码，生成 openspec/billing/payment-method/v1-2026-06-26.md]
```

### opst-business-search

**触发方式**: 自然语言触发（业务检索、搜索业务逻辑、查找模块）

在知识库中检索已归档的业务逻辑文档：
- **关键词检索**: 按关键词搜索
- **浏览模式**: 浏览所有领域/模块
- **精确查看**: 查看指定模块或版本

**示例**:
```
User: 搜索支付相关的业务逻辑
You: [找到 billing/payment-method, billing/refund-processing 等]

User: 列出所有模块
You: [展示完整的领域分类树]
```

---

## 完整工作流

```
1. 探索     /opsx:explore <idea>
              ↓
2. 提案     /opsx:propose <change-name>
              ↓
3. 实施     /opsx:apply <change-name>
              ↓
4. 归档     /opsx:archive <change-name>
              ↓
5. 知识库   /opst:code-anysic <archived-change>
              ↓
6. 检索     /opst:business-search <keyword>
```
