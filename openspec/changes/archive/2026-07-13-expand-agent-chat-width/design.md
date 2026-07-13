## Architecture

### Current State

Agent 面板布局采用三层嵌套的居中宽度约束：

```
AgentPanel (max-width: 800px, margin: 0 auto)
└── ChatMessageList
    └── message-content (max-width: 768px, margin: 0 auto)
        └── chat-bubble (max-width: 75%)
    └── ChatInputBar
        └── input-wrapper (max-width: 768px, margin: 0 auto)
```

三层 `max-width` + `margin: 0 auto` 导致在任何屏幕尺寸下聊天内容都居中且很窄。

### Target State

去掉 `max-width` 约束，改用 `padding` 控制左右边距：

```
AgentPanel (padding: 0 1rem, no max-width)
└── ChatMessageList
    └── message-content (padding: 0 0.5rem, no max-width)
        └── chat-bubble (max-width: 75%)  // 不变，依然限制气泡宽度
    └── ChatInputBar
        └── input-wrapper (padding: 12px 14px, no max-width, no margin: 0 auto)
```

### Key Decisions

1. **不使用 `width: 100%`** — `AgentPanel` 本身在 `main-content` 中，flex 布局下自然撑满父容器，不需要显式 `width: 100%`
2. **保留 `margin: 0 auto`** — 去掉 `max-width` 后，`margin: 0 auto` 不再有意义，但保留也不会影响布局，最小化 diff
3. **气泡 `max-width: 75%` 不变** — 外层变宽后气泡自然变大，但 75% 的限制防止在超宽行下消息过长难以阅读
4. **输入框改为 `width: 100%`** — 去掉 `max-width` 后让输入框填满可用宽度

### Risks

- **超宽屏幕下行过长**：agent 消息中的纯文本行可能会很长。缓解措施：气泡保持 `max-width: 75%`，且 markdown 渲染会自动换行。
- **其他视图受影响**：本次改动仅限于 `components/agent/` 下的 scoped 样式，不影响全局 CSS 或其他视图。
