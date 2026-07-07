---
name: skill-loader
description: Loads external skills into the local plugins directory and automatically configures plugin.json, marketplace.json, and related metadata. Use when a user asks to load, install, or register a skill from a local path into the project's plugin system. Trigger phrases: "loader skill", "加载 skill", "加载xxx skill 路径是xxx", "load skill from path", "install skill".
---

# Skill Loader

Automatically integrates external skills into the project's plugin system by creating proper directory structure, plugin metadata, and marketplace registration.

## Trigger Patterns

The skill activates when the user says something like:
- "loader skill"
- "加载 skill" / "加载xxx skill"
- "加载xxx skill 路径是xxx"
- "load skill from path"
- "install skill from xxx"

## Workflow

```
User invokes skill-loader
        │
        ▼
┌─────────────────────┐
│ Step 1: Discover    │ ← Identify source directory and skill name
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Step 2: Determine   │ ← Decide plugin name and category group
│         group       │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Step 3: Copy files  │ ← Copy skill files to plugins/{plugin-name}/
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Step 4: Create/     │ ← Create or update plugin.json
│         update      │
│         plugin.json │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Step 5: Register    │ ← Add entry to .claude-plugin/marketplace.json
│         in          │
│         marketplace │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Step 6: Verify      │ ← Confirm structure and display summary
└─────────────────────┘
```

### Step 1: Discover Source

Determine the source directory of the skills to load:

1. If the user provided a path explicitly, use it.
2. If the skill name suggests a known source (e.g., GitHub repo, common location), ask the user to confirm.
3. Validate that the source directory contains at least one skill directory with a `SKILL.md` file.

```bash
# Validate source contains valid skills
find <source-path> -name "SKILL.md" -maxdepth 2
```

### Step 2: Determine Plugin Name and Category

**Plugin name**: Derive from the source directory name. Convert to kebab-case if needed.

**Category group**: Determine which category the plugin belongs to:

| Category | Description | Examples |
|----------|-------------|----------|
| `workflow` | Multi-step workflow skills | openspec-workflow, tdd-workflow |
| `documentation` | Code analysis, docs, knowledge base | openspec-trace |
| `content` | Content creation, illustration, media | baoyu-skills |
| `devops` | Build, publish, deploy, CI/CD | publish |
| `official` | Official vendor skills | anthropics |
| `utility` | General-purpose utilities | — |

Ask the user to confirm the category if ambiguous.

### Step 3: Copy Skill Files

Copy the entire source directory into `plugins/{plugin-name}/`:

```bash
cp -r <source-path> plugins/<plugin-name>/
```

Preserve the internal structure. If the source is already structured as a plugin (has `SKILL.md` directly inside or under a named subdirectory), copy as-is.

Two common source structures:

**Single-skill plugin** (like openspec-workflow):
```
source/
├── plugin.json (optional)
└── skills/
    └── skill-name/
        └── SKILL.md
```

**Multi-skill collection plugin** (like baoyu-skills):
```
source/
├── plugin.json (optional)
├── README.md (optional)
└── skill-1/
    ├── SKILL.md
    └── references/
```

Copy the entire source tree as the plugin directory.

### Step 4: Create or Update plugin.json

If `plugin.json` does not exist in the plugin directory, create it:

```json
{
  "name": "<plugin-name>",
  "description": "<description from SKILL.md or user-provided>",
  "author": { "name": "<author or project default>" },
  "license": "<MIT or Proprietary or user-provided>",
  "keywords": ["<relevant-keywords>"],
  "category": "<category>"
}
```

If `plugin.json` already exists, update only missing fields (never overwrite user-edited values).

**Derive fields:**
- `name`: From directory name or user input
- `description`: From SKILL.md frontmatter or user input
- `author`: Default to project author from marketplace.json, or ask
- `license`: Default to "MIT" for own skills, "Proprietary" for third-party, or ask
- `keywords`: Extract from SKILL.md description and directory structure
- `category`: From Step 2

### Step 5: Register in marketplace.json

Read `.claude-plugin/marketplace.json` and add a new plugin entry to the `plugins` array:

```json
{
  "name": "<plugin-name>",
  "source": "./plugins/<plugin-name>",
  "description": "<from plugin.json>",
  "author": { "name": "<from plugin.json>" },
  "license": "<from plugin.json>",
  "keywords": ["<from plugin.json>"],
  "category": "<from plugin.json>"
}
```

**Rules:**
- Do NOT add duplicates — check if name already exists in the plugins array.
- Preserve existing entries and formatting.
- Insert as the last item in the plugins array.

### Step 6: Verify and Summarize

After registration, verify:

```bash
# Check plugin directory exists
ls plugins/<plugin-name>/

# Check plugin.json is valid JSON
python3 -c "import json; json.load(open('plugins/<plugin-name>/plugin.json'))"

# Check marketplace.json is valid JSON and contains new entry
python3 -c "import json; d=json.load(open('.claude-plugin/marketplace.json')); print(any(p['name']=='<plugin-name>' for p in d['plugins']))"
```

Display summary to user:

```
Skill loaded successfully!

Plugin: <plugin-name>
Category: <category>
Skills: <list of SKILL.md files found>
Location: plugins/<plugin-name>/

Files created/updated:
  - plugins/<plugin-name>/plugin.json
  - .claude-plugin/marketplace.json
```

## Edge Cases

### Source is a single SKILL.md file

If the source is just a single `SKILL.md` file without a directory structure:
1. Create `plugins/<skill-name>/skills/<skill-name>/SKILL.md`
2. Create `plugins/<skill-name>/plugin.json`
3. Register in marketplace.json

### Plugin name collision

If a plugin with the same name already exists:
1. Ask the user: overwrite, merge, or create with a different name.
2. For merge: only copy files that don't already exist, and update SKILL.md if newer.

### Source contains multiple top-level skill directories

If the source has multiple directories each containing `SKILL.md` (like baoyu-skills):
1. Treat the entire source as a multi-skill plugin collection.
2. Create `plugin.json` at the plugin root level.
3. Each subdirectory remains a separate skill within the plugin.
4. Derive plugin description from the collection, not individual skills.

### User specifies a different target directory

If the user asks to load into a specific plugin directory or subdirectory:
1. Use the user-specified path instead of the default `plugins/<plugin-name>/`.
2. Confirm before proceeding.
