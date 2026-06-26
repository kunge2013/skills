# Design: add-anthropics-plugin

## plugin.json 配置

```json
{
  "name": "anthropics",
  "description": "Anthropic official Claude Code skills — document processing and developer tools",
  "author": { "name": "Anthropic" },
  "license": "Proprietary",
  "keywords": ["anthropic", "official", "pdf", "docx", "xlsx", "mcp", "skill-creator"]
}
```

## marketplace.json 新增条目

在 plugins 数组中追加：

```json
{
  "name": "anthropics",
  "source": "./plugins/anthropics",
  "description": "Anthropic official Claude Code skills — document processing and developer tools",
  "author": { "name": "Anthropic" },
  "license": "Proprietary",
  "keywords": ["anthropic", "official", "pdf", "docx", "xlsx", "pptx", "mcp", "skill-creator"],
  "category": "official"
}
```

## 技能清单与触发说明

| Skill | 功能 | 触发场景 |
|-------|------|----------|
| `pdf` | PDF 文件处理：读取、合并、拆分、旋转、水印、加密、OCR、表单填写 | 用户提到 .pdf 文件或要求生成/处理 PDF |
| `xlsx` | Excel 电子表格处理：创建、编辑、格式化、图表、公式、数据清洗 | 用户提到 .xlsx/.csv/.tsv 文件或要求创建/编辑表格 |
| `docx` | Word 文档：创建、编辑、格式化、目录、页码、信头 | 用户提到 .docx、Word 文档、报告、备忘录、信函 |
| `mcp-builder` | MCP 服务器开发指南：创建 LLM 与外部服务交互的工具 | 用户需要构建 MCP 服务器集成外部 API |
| `skill-creator` | 技能创建器：创建新技能、评估、基准测试、优化触发描述 | 用户需要创建/编辑/测试 Claude Code 技能 |

## 文档更新

### README.md

在 Available Plugins 区域新增 `anthropics` 插件说明表格。

### docs/使用手册.md

不需要改动（通用命令文档不涉及特定插件）。
