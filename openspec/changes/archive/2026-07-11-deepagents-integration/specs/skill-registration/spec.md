## ADDED Requirements

### Requirement: SKILL.md files can be registered as agent tools

The system SHALL provide a configuration mechanism to register SKILL.md files with the agent system. Each registration SHALL include the skill name (from frontmatter), description (from frontmatter), and the full file path for loading content during execution.

#### Scenario: Register a single skill
- **WHEN** a SKILL.md file is registered in the agent config
- **THEN** the skill appears in the agent's available tool list during plan generation

#### Scenario: Register multiple skills
- **WHEN** multiple SKILL.md files are registered
- **THEN** all skills appear in the agent's available tool list, accessible by name

#### Scenario: Skill registration with invalid path
- **WHEN** a SKILL.md file path does not exist
- **THEN** the system logs a warning and skips that skill during registration

### Requirement: SKILL.md content is loaded and used as sub-agent system prompt

When a step referencing a registered skill is executed, the system SHALL load the full SKILL.md file content (excluding frontmatter) and use it as the sub-agent's system prompt, combined with the user's original request and context from previous steps.

#### Scenario: Load SKILL.md content for step execution
- **WHEN** a step with skill "openspec-propose" is executed
- **THEN** the system loads the content of the registered SKILL.md file and strips YAML frontmatter

#### Scenario: SKILL.md frontmatter is not included in prompt
- **WHEN** SKILL.md content is assembled into system prompt
- **THEN** the YAML frontmatter block (--- ... ---) is excluded from the prompt

### Requirement: Registered skills are discoverable via API

The system SHALL provide an endpoint to list all registered skills with their name, description, and status.

#### Scenario: List registered skills
- **WHEN** user calls GET /agent/skills
- **THEN** the system returns a list of all registered skills with name, description, and file path

#### Scenario: No skills registered
- **WHEN** no skills are registered
- **THEN** the system returns an empty array
