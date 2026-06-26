# kunge-skills

OpenSpec-based development workflow skills for Claude Code.

This marketplace provides reusable skills that enable a spec-driven approach to software development: explore ideas, propose changes, implement tasks, and archive results -- plus a knowledge base for code analysis and business logic documentation.

## Installation

### Option 1: Install kungeskill CLI (Recommended)

Manage skills via npm — install, remove, update skills with one command.

```bash
# Install globally
npm install -g kungeskill

# Initialize marketplace cache (first time only)
kungeskill init

# View available skills
kungeskill list

# Install a skill (creates symlink in your project)
cd your-project
kungeskill add openspec-explore
```

**CLI Commands:**

| Command | Description |
|---------|-------------|
| `kungeskill init` | Download marketplace cache (first time only) |
| `kungeskill list` | List all available skills |
| `kungeskill add <skill>` | Install a skill into your project via symlink |
| `kungeskill remove <skill>` | Remove a skill from your project |
| `kungeskill view` | Show installed skills with health status |
| `kungeskill update` | Update marketplace cache to latest |
| `kungeskill doctor` | Check symlink health and detect broken links |

### Uninstall

```bash
# Remove a skill from your project
kungeskill remove openspec-explore

# Uninstall kungeskill CLI globally
npm uninstall -g kungeskill

# (Optional) Clean up marketplace cache
rm -rf ~/.kungeskills
```

### Option 2: Claude Code Plugin Marketplace

Install skills via Claude Code's built-in plugin system.

#### Add the marketplace

```
/plugin marketplace add kunge2013/skills
```

#### Install individual plugins

```
# Spec-driven change lifecycle (explore, propose, apply, archive)
/plugin install openspec-workflow@kunge-skills

# Code analysis and business logic knowledge base
/plugin install openspec-trace@kunge-skills
```

#### Update to latest

```
/plugin marketplace update kunge-skills
```

## Available Plugins

### openspec-workflow

Spec-driven change lifecycle for Claude Code. Enables you to:

- **Explore** ideas and requirements before writing code
- **Propose** changes with structured proposal, design, and task artifacts
- **Apply** tasks through sequential, verifiable implementation
- **Archive** completed changes with spec synchronization

| Skill | Description |
|-------|-------------|
| `openspec-explore` | Enter explore mode -- a thinking partner for exploring ideas, investigating problems, and clarifying requirements |
| `openspec-propose` | Propose a new change with all artifacts (proposal, design, tasks) generated in one step |
| `openspec-apply-change` | Implement tasks from an OpenSpec change, working through them sequentially with progress tracking |
| `openspec-archive-change` | Archive a completed change, with optional delta spec sync to main specs |

### openspec-trace

Code analysis and business logic knowledge base. Enables you to:

- **Archive** code changes from OpenSpec changes into a versioned knowledge base
- **Search** archived business logic documents by keyword, domain, or exact module

| Skill | Description |
|-------|-------------|
| `opst-code-anysic` | Analyze archived OpenSpec change code, extract business logic, and archive into a versioned knowledge base with five-section design documents |
| `opst-business-search` | Search the archived business logic knowledge base by keyword, browse by domain, or view exact modules |

### anthropics

Anthropic official Claude Code skills — document processing and developer tools. Author: **Anthropic**.

| Skill | Description | Trigger |
|-------|-------------|---------|
| `pdf` | PDF processing: read, merge, split, rotate, watermark, encrypt, OCR, form filling | User mentions .pdf files or asks to generate/process PDFs |
| `xlsx` | Excel spreadsheet: create, edit, format, chart, formulas, data cleaning | User mentions .xlsx/.csv/.tsv or asks to create/edit spreadsheets |
| `docx` | Word documents: create, edit, format, TOC, page numbers, letterheads | User mentions .docx, Word document, report, memo, letter |
| `mcp-builder` | MCP server development guide for integrating external APIs | User needs to build MCP servers to integrate external services |
| `skill-creator` | Skill creator: create, evaluate, benchmark, and optimize Claude Code skills | User wants to create/edit/test Claude Code skills |

## Tech Stack

- OpenSpec (spec-driven development workflow)
- Claude Code skills framework
- Node.js >= 18 (kungeskill CLI)

## License

MIT
