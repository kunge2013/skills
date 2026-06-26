# Proposal: add-anthropics-plugin

## What

将 Anthropic 官方 Claude Code Skills 集成到 kungeskill marketplace，添加为 `anthropics` 插件。包含 6 个官方技能：pdf、xlsx、pptx、docx、mcp-builder、skill-creator。

## Why

- Anthropic 官方发布了高质量的 Claude Code 技能，覆盖文档处理和开发工具场景
- 将官方技能纳入 marketplace 统一管理，用户可通过 `kungeskill add` 一键安装
- 保留原始作者归属（Anthropic），尊重许可证

## Scope

1. 创建 `plugins/anthropics/plugin.json` 配置文件
2. 更新 `.claude-plugin/marketplace.json` 注册 anthropics 插件
3. 更新 README.md 文档，添加 anthropics 插件说明
4. 更新使用手册，补充 anthropics 相关技能介绍

## Out of Scope

- 不修改官方 SKILL.md 内容
- 不修改官方 LICENSE.txt
- 不修改官方脚本或引用文件
