# 安装指南

## 前置条件

- [Claude Code](https://code.claude.com/) 已安装
- 有 GitHub 账号（用于访问仓库）

## 安装步骤

### 1. 添加 Marketplace

在 Claude Code 中执行：

```
/plugin marketplace add kunge2013/skills
```

这会克隆 `https://github.com/kunge2013/skills` 仓库并读取 `.claude-plugin/marketplace.json`。

### 2. 查看可用 Plugins

```
/plugin marketplace list
```

你会看到两个可用插件：
- `openspec-workflow` — 变更生命周期
- `openspec-trace` — 知识库

### 3. 安装 Plugins

按需安装，可以只安装其中一个：

```
# 安装变更生命周期（推荐）
/plugin install openspec-workflow@kunge-skills

# 安装知识库
/plugin install openspec-trace@kunge-skills
```

### 4. 验证安装

安装完成后，skills 会自动加载到你的 Claude Code 会话中。你可以通过以下命令确认：

```
/skill list
```

应该能看到 `openspec-explore`、`openspec-propose` 等技能。

## 更新

当仓库有新 push 时，执行：

```
/plugin marketplace update kunge-skills
```

## 卸载

```
# 卸载单个 plugin
/plugin uninstall openspec-workflow@kunge-skills

# 移除整个 marketplace
/plugin marketplace remove kunge-skills
```

## 项目级安装

如果你想让团队所有成员自动提示安装此 marketplace，在项目根目录的 `.claude/settings.json` 中添加：

```json
{
  "extraKnownMarketplaces": {
    "kunge-skills": {
      "source": "github",
      "repo": "kunge2013/skills"
    }
  },
  "enabledPlugins": {
    "openspec-workflow@kunge-skills": true,
    "openspec-trace@kunge-skills": true
  }
}
```

提交到仓库后，团队成员打开项目时会自动提示安装。

## 容器预填充

对于 CI/CD 或容器镜像，可以在构建时预填充 skills：

```bash
export CLAUDE_CODE_PLUGIN_SEED_DIR=/opt/claude-seed
claude plugin marketplace add kunge2013/skills
claude plugin install openspec-workflow@kunge-skills
```

容器启动时设置 `CLAUDE_CODE_PLUGIN_SEED_DIR=/opt/claude-seed` 即可。

## 故障排查

### Marketplace 添加失败

- 确认仓库可访问（公开或你有权限）
- 确认 `.claude-plugin/marketplace.json` 存在且 JSON 语法正确

### Plugin 安装失败

- 确认 plugins 目录和 marketplace.json 在同一仓库
- 确认 plugin.json 存在

### Skills 未加载

- 执行 `/plugin list` 确认 plugin 状态为 enabled
- 如为 disabled，执行 `/plugin enable <name>`
