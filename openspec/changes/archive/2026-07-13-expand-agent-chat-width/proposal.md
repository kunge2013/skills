## Why

Agent 聊天框目前被 `max-width: 800px` 限制得很窄，在大屏幕上浪费了大量可用空间。用户消息和 agent 消息在宽屏下都显得很窄，视觉上不协调。

## What Changes

将 Agent 视图中的聊天面板、消息内容区、输入框从固定最大宽度（800px / 768px）改为使用左右 padding 控制边距，使聊天内容充分利用 main-content 区域的可用空间。

## Impact

- **Modified**: `web/src/components/agent/AgentPanel.vue` — 去掉 `.agent-panel` 的 `max-width: 800px`，改用左右 padding
- **Modified**: `web/src/components/agent/ChatMessageList.vue` — 去掉 `.message-content` 的 `max-width: 768px`，改用左右 padding
- **Modified**: `web/src/components/agent/ChatInputBar.vue` — 去掉 `.input-wrapper` 的 `max-width: 768px`，改用左右 padding
- **Not affected**: 聊天消息气泡的 `max-width: 75%` 保持不变，因为外层变宽后气泡自然变大但仍有限制
- **Not affected**: 其他视图（SkillList、SkillDetail 等）布局不变
