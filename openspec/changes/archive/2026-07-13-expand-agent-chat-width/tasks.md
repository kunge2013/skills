## 1. AgentPanel — 去掉外层宽度限制

- [x] 1.1 `web/src/components/agent/AgentPanel.vue`：删除 `.agent-panel` 的 `max-width: 800px`
- [x] 1.2 添加 `padding: 0 1rem` 作为左右边距

## 2. ChatMessageList — 去掉内容区宽度限制

- [x] 2.1 `web/src/components/agent/ChatMessageList.vue`：删除 `.message-content` 的 `max-width: 768px`
- [x] 2.2 添加 `padding: 0 0.5rem` 作为左右边距

## 3. ChatInputBar — 去掉输入框宽度限制

- [x] 3.1 `web/src/components/agent/ChatInputBar.vue`：删除 `.input-wrapper` 的 `max-width: 768px`
- [x] 3.2 添加 `width: 100%` 使输入框填满可用宽度

## 4. 验证

- [x] 4.1 TypeScript 类型检查通过
- [ ] 4.2 启动 dev server，在 agent 页面确认聊天面板撑满 main-content
- [ ] 4.3 确认消息气泡依然正常显示（max-width: 75%）
- [ ] 4.4 确认输入框正常显示
- [ ] 4.5 确认其他视图（SkillList、SkillDetail 等）布局不受影响
