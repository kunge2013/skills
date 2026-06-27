# kunge-skills：让 Claude Code 真正学会"先想再做"

## 一、作者的初心：为什么要做这个项目？

用过 Claude Code 的人都知道，它写代码很快，但快有时候也是问题。

### 痛点一：AI 一上来就写代码

你告诉 Claude："帮我加个用户登录功能。"它二话不说就开始写代码。结果呢？

- 需求没搞清楚，写了一半发现方向错了
- 没有设计文档，后面的人接手看不懂为什么要这么写
- 改完代码就完了，没人知道这次改了什么、为什么改

**我们缺的不是写代码的能力，而是"写代码之前先想清楚"的习惯。**

### 痛点二：好技能找不到、装不上

Claude Code 支持 skills 扩展，但官方生态刚起步。网上有人写了很好的 skill，你怎么用？

- 手动 clone 仓库
- 找到 SKILL.md
- 复制到项目的 `.claude/skills/` 目录
- 更新了还要重新复制一遍

太麻烦了。好工具应该像 npm install 一样简单。

### 痛点三：代码能跑，但没人知道"为什么"

一个项目跑了一两年，老员工走了，新员工进来看着代码一脸懵：

> "这个判断为什么这么写？"
> "这个字段什么时候加的？"
> "这个逻辑当初是为了解决什么问题？"

代码本身不会告诉你业务背景。**我们需要一个能把"业务逻辑"从代码里抽出来、存下来、搜得到的工具。**

基于这三个痛点，kunge-skills 诞生了。

---

## 二、kunge-skills 是什么？

用一句话概括：**它是 Claude Code 的"技能应用商店" + "规范化开发工作流"。**

它包含两样东西：

1. **一个 CLI 工具**（`kungeskill`）—— 像 npm 一样管理 skills，一条命令安装、卸载、更新
2. **一套 skills 集合** —— 涵盖需求探索、变更提案、任务实施、代码归档的完整开发流程

---

## 三、核心优势

### 1. 一条命令装技能

```bash
npm install -g kungeskill
kungeskill init
kungeskill add openspec-explore
```

就这么简单。不需要手动找文件、不需要复制粘贴、不需要记目录结构。

### 2. 更新了自动同步

安装用的是 symlink（符号链接），技能源文件更新后，你项目里的技能**自动生效**，不需要重新安装。

```bash
kungeskill update  # 拉取远程更新
# 搞定，所有已安装技能自动升级
```

### 3. 跨平台无忧

Windows 上 symlink 有权限和跨盘问题？它自动处理：

- 同盘 → 用 symlink（自动同步）
- 跨盘 → 降级为文件复制（`--force` 可刷新）
- 不需要你操心

### 4. 健康检查一键诊断

```bash
kungeskill doctor
```

自动检查：
- 缓存是否完整
- 链接是否断裂
- SKILL.md 是否存在
- 给出修复建议

不用自己猜哪里出了问题。

### 5. 双渠道安装

- **CLI 方式**：`npm install -g kungeskill`，适合喜欢命令行的人
- **Claude Code 插件方式**：`/plugin marketplace add kunge2013/skills`，在 Claude Code 里直接用

两种方式互不冲突，按喜好选。

### 6. Web 管理界面

```bash
kungeskill web
```

浏览器打开就能看到所有技能，支持预览、编辑、一键安装，对不熟悉命令行的用户非常友好。

---

## 四、设计思想：四步工作流

kunge-skills 的核心理念是 **spec-driven development（规格驱动开发）**，用四个步骤替代"上来就写代码"：

```
探索(Explore) → 提案(Propose) → 实施(Apply) → 归档(Archive)
```

### 第一步：Explore（探索）—— 先搞清楚"要做什么"

> "我想加个登录功能。"

`openspec-explore` 不会马上写代码，而是像一个技术搭档一样跟你聊：

- 用户需要什么体验？
- 有哪些技术方案？各自的利弊是什么？
- 现有的代码会影响吗？
- 有没有被忽略的边缘情况？

**目的：在写第一行代码之前，把问题想清楚。**

### 第二步：Propose（提案）—— 把方案写下来

聊清楚之后，`openspec-propose` 会生成三份文档：

1. **Proposal**（提案）—— 这次要改什么、为什么改
2. **Design**（设计）—— 怎么改、影响哪些模块
3. **Tasks**（任务）—— 具体的实施步骤，一步一步列清楚

**目的：方案可审查、可讨论、可追溯。不是口头上说说，而是白纸黑字写下来。**

### 第三步：Apply（实施）—— 按步骤执行

`openspec-apply-change` 读取上一步生成的 Tasks，一步一步实施。每完成一步都有记录，进度一目了然。

**目的：防止漏步骤、防止跳步、防止写到一半忘了要干什么。**

### 第四步：Archive（归档）—— 完成后的收尾

改完了，`openspec-archive-change` 把这次变更归档，同时更新项目的规格文档，保持文档和代码同步。

**目的：今天的改动，三个月后的人也能看懂。**

---

## 五、还有一个隐藏技能：业务知识库

`openspec-trace` 是项目里的第二个插件，解决"代码能跑但没人懂"的问题：

1. **opst-code-anysic**：分析已有的代码，提取其中的业务逻辑，生成结构化的设计文档
2. **opst-business-search**：按关键词搜索这些文档，快速找到"某块逻辑当初是怎么设计的"

**相当于给你的项目建了一个"业务知识维基百科"。**

---

## 六、谁适合用？

| 你是谁 | 你会用到什么 |
|--------|-------------|
| Claude Code 的日常用户 | 一条命令装各种好用的 skills |
| 技术负责人 | 用四步工作流规范团队的开发习惯 |
| 接手老项目的开发者 | 用业务知识库快速理解陌生代码 |
| Skill 创作者 | 创建自己的 skill，通过 marketplace 分发给别人 |
| 小团队 / 个人开发者 | 不花钱、不复杂，装上用就行 |

---

## 七、快速上手

```bash
# 1. 安装 CLI
npm install -g kungeskill

# 2. 初始化缓存（只需做一次）
kungeskill init

# 3. 看看有什么技能
kungeskill list

# 4. 给项目装一个试试
cd your-project
kungeskill add openspec-explore

# 5. 打开 Claude Code，输入 /openspec-explore 开始使用
```

也可以在 Claude Code 里直接安装：

```
/plugin marketplace add kunge2013/skills
/plugin install openspec-workflow@kunge-skills
```

---

## 八、总结

kunge-skills 不是一个"又一个 AI 工具"。它解决的是一个很朴素的问题：

> **AI 写代码很快，但写之前想清楚了吗？写之后有人记得为什么这么写吗？**

它的答案是：用一个标准化的工作流，把"想"放在"做"前面，把"记"放在"忘"前面。

开源、免费（MIT）、零依赖、跨平台。值得一试。

---

**项目地址**：https://github.com/kunge2013/skills
