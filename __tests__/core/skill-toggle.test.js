import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  DISABLED_DIR_NAME,
  listSkillToggleState,
  setSkillEnabled,
  setOwnerSkillsEnabled,
  setProjectSkillsEnabled,
  resolveSkillAuthor,
  parseSkillStructure,
} from '../../src/core/skill-toggle.js'
import { getProviderByName } from '../../src/core/config.js'

const testBase = path.join(os.tmpdir(), 'skills-toggle-test-' + Date.now())

// ---------- fixtures ----------

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function writeSkillMd(dir, name, description, author) {
  ensureDir(dir)
  const desc = description || `${name} skill`
  const authorLine = author ? `\nauthor: ${author}` : ''
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${desc}${authorLine}\n---\n\n# ${name}\n`,
    'utf-8'
  )
}

function linkDir(target, link) {
  const type = process.platform === 'win32' ? 'junction' : 'dir'
  fs.symlinkSync(path.resolve(target), link, type)
}

// Use user-level skills dir for testing
const userSkills = path.join(testBase, 'fake-home', '.claude', 'skills')
const piAgentSkills = path.join(testBase, 'fake-home', '.pi', 'agent', 'skills')

// Mock os.homedir to return our test directory
const originalHomedir = os.homedir
beforeEach(() => {
  os.homedir = () => path.join(testBase, 'fake-home')

  // Create some test skills in user scope (Claude Code)
  ensureDir(userSkills)

  // Local skill
  writeSkillMd(path.join(userSkills, 'local-skill'), 'local-skill', 'A local skill', 'Carol')

  // External skill (simulating mattpocock/skills structure)
  // Single-level: mattpocock__skill-name
  writeSkillMd(path.join(userSkills, 'mattpocock__ts-skill'), 'ts-skill', 'TypeScript skill', 'mattpocock')
  // Multi-level: mattpocock__project__skill-name
  writeSkillMd(path.join(userSkills, 'mattpocock__myproject__react-skill'), 'react-skill', 'React skill', 'mattpocock')

  // Create some test skills for Pi Agent
  ensureDir(piAgentSkills)
  writeSkillMd(path.join(piAgentSkills, 'pi-local-skill'), 'pi-local-skill', 'A Pi Agent skill', 'Dave')
  writeSkillMd(path.join(piAgentSkills, 'mattpocock__pi-skill'), 'pi-skill', 'Pi TypeScript skill', 'mattpocock')
})

afterEach(() => {
  os.homedir = originalHomedir
  fs.rmSync(testBase, { recursive: true, force: true })
})

function flatSkills(state) {
  return state.groups.flatMap(g =>
    g.projects.flatMap(p => p.skills.map(s => ({ ...s, owner: g.owner })))
  )
}

// ---------- tests ----------

describe('parseSkillStructure', () => {
  it('parses external skill with owner/project/skill format', () => {
    const result = parseSkillStructure('mattpocock__myproject__react-skill')
    expect(result.isExternal).toBe(true)
    expect(result.owner).toBe('mattpocock')
    expect(result.projectPath).toBe('myproject')
    expect(result.skillName).toBe('react-skill')
  })

  it('parses external skill with owner/skill format', () => {
    const result = parseSkillStructure('mattpocock__ts-skill')
    expect(result.isExternal).toBe(true)
    expect(result.owner).toBe('mattpocock')
    expect(result.projectPath).toBe('')
    expect(result.skillName).toBe('ts-skill')
  })

  it('returns non-external for regular skill names', () => {
    const result = parseSkillStructure('local-skill')
    expect(result.isExternal).toBe(false)
    expect(result.skillName).toBe('local-skill')
  })
})

describe('listSkillToggleState', () => {
  it('lists skills grouped by owner with project structure', () => {
    const state = listSkillToggleState()

    expect(state.userSkillsDir).toBe(userSkills)
    expect(state.exists).toBe(true)

    const owners = state.groups.map(g => g.owner)
    expect(owners).toContain('mattpocock')
    expect(owners).toContain('Carol')

    const all = flatSkills(state)
    expect(all.filter(s => s.enabled)).toHaveLength(3)

    const mattpocock = state.groups.find(g => g.owner === 'mattpocock')
    expect(mattpocock).toBeTruthy()
    expect(mattpocock.total).toBe(2)
    expect(mattpocock.enabledCount).toBe(2)
    // Should have 2 projects: empty (single-level) and 'myproject'
    expect(mattpocock.projects.length).toBe(2)
  })

  it('includes disabled skills parked in the hidden folder', () => {
    ensureDir(path.join(userSkills, DISABLED_DIR_NAME))
    fs.renameSync(
      path.join(userSkills, 'local-skill'),
      path.join(userSkills, DISABLED_DIR_NAME, 'local-skill')
    )

    const state = listSkillToggleState()
    const local = flatSkills(state).find(s => s.skillName === 'local-skill')
    expect(local).toBeTruthy()
    expect(local.enabled).toBe(false)

    const carol = state.groups.find(g => g.owner === 'Carol')
    expect(carol.enabledCount).toBe(0)
    expect(carol.total).toBe(1)
  })
})

// Provider-aware tests
describe.each([
  ['claude-code', userSkills],
  ['pi-agent', piAgentSkills]
])('provider: %s', (provider, skillsDir) => {
  describe('listSkillToggleState with provider', () => {
    it(`lists skills for ${provider}`, () => {
      const state = listSkillToggleState(provider)
      expect(state.provider).toBe(provider)
      expect(state.userSkillsDir).toBe(skillsDir)
      expect(state.groups.length).toBeGreaterThan(0)
    })
  })

  describe('setSkillEnabled with provider', () => {
    it(`disables a skill for ${provider}`, () => {
      const skillName = provider === 'claude-code' ? 'local-skill' : 'pi-local-skill'
      const r = setSkillEnabled(skillName, false, provider)
      expect(r.success).toBe(true)

      const disabledDir = path.join(skillsDir, DISABLED_DIR_NAME)
      expect(fs.existsSync(path.join(skillsDir, skillName))).toBe(false)
      expect(fs.existsSync(path.join(disabledDir, skillName, 'SKILL.md'))).toBe(true)
    })

    it(`re-enables a disabled skill for ${provider}`, () => {
      const skillName = provider === 'claude-code' ? 'local-skill' : 'pi-local-skill'
      setSkillEnabled(skillName, false, provider)
      const r = setSkillEnabled(skillName, true, provider)
      expect(r.success).toBe(true)
      expect(fs.existsSync(path.join(skillsDir, skillName, 'SKILL.md'))).toBe(true)
    })
  })
})

describe('resolveSkillAuthor', () => {
  it('resolves owner from external skill name', () => {
    const skillPath = path.join(userSkills, 'mattpocock__ts-skill')
    expect(resolveSkillAuthor(skillPath, 'mattpocock__ts-skill')).toBe('mattpocock')
  })

  it('falls back to frontmatter for non-external skills', () => {
    const skillPath = path.join(userSkills, 'local-skill')
    expect(resolveSkillAuthor(skillPath, 'local-skill')).toBe('Carol')
  })

  it('falls back to Unknown when nothing is known', () => {
    writeSkillMd(path.join(userSkills, 'anon-skill'), 'anon-skill')
    expect(resolveSkillAuthor(path.join(userSkills, 'anon-skill'), 'anon-skill')).toBe('Unknown')
  })
})

describe('setSkillEnabled', () => {
  it('disables a skill by moving it into the hidden folder', () => {
    const r = setSkillEnabled('local-skill', false)
    expect(r.success).toBe(true)

    expect(fs.existsSync(path.join(userSkills, 'local-skill'))).toBe(false)
    const parked = path.join(userSkills, DISABLED_DIR_NAME, 'local-skill')
    expect(fs.existsSync(path.join(parked, 'SKILL.md'))).toBe(true)
  })

  it('re-enables a disabled skill', () => {
    setSkillEnabled('local-skill', false)
    const r = setSkillEnabled('local-skill', true)
    expect(r.success).toBe(true)
    expect(fs.existsSync(path.join(userSkills, 'local-skill', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(userSkills, DISABLED_DIR_NAME, 'local-skill'))).toBe(false)
  })

  it('toggles an external skill', () => {
    const r = setSkillEnabled('mattpocock__ts-skill', false)
    expect(r.success).toBe(true)
    expect(fs.existsSync(path.join(userSkills, 'mattpocock__ts-skill'))).toBe(false)
    expect(fs.existsSync(path.join(userSkills, DISABLED_DIR_NAME, 'mattpocock__ts-skill', 'SKILL.md'))).toBe(true)
  })

  it('is idempotent (already in target state)', () => {
    const r = setSkillEnabled('local-skill', true)
    expect(r.success).toBe(true)
    expect(r.already).toBe(true)
  })

  it('fails for unknown skill', () => {
    const r = setSkillEnabled('nope', false)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/not found/i)
  })

  it('rejects invalid skill names (traversal)', () => {
    expect(setSkillEnabled('../evil', false).success).toBe(false)
    expect(setSkillEnabled('.kungeskill-disabled', false).success).toBe(false)
    expect(setSkillEnabled('', false).success).toBe(false)
  })
})

describe('setOwnerSkillsEnabled', () => {
  it('batch-disables all skills of an owner', () => {
    const r = setOwnerSkillsEnabled('mattpocock', false)
    expect(r.success).toBe(true)
    expect(r.data.changed).toBe(2)

    expect(fs.existsSync(path.join(userSkills, 'mattpocock__ts-skill'))).toBe(false)
    expect(fs.existsSync(path.join(userSkills, 'mattpocock__myproject__react-skill'))).toBe(false)

    const state = listSkillToggleState()
    const mattpocock = state.groups.find(g => g.owner === 'mattpocock')
    expect(mattpocock.enabledCount).toBe(0)

    // other owners untouched
    expect(fs.existsSync(path.join(userSkills, 'local-skill', 'SKILL.md'))).toBe(true)
  })

  it('skips skills already in the target state', () => {
    setSkillEnabled('mattpocock__ts-skill', false)
    const r = setOwnerSkillsEnabled('mattpocock', false)
    expect(r.data.changed).toBe(1) // only react-skill remains
    expect(r.success).toBe(true)
  })

  it('batch-re-enables', () => {
    setOwnerSkillsEnabled('mattpocock', false)
    const r = setOwnerSkillsEnabled('mattpocock', true)
    expect(r.data.changed).toBe(2)
    const state = listSkillToggleState()
    expect(state.groups.find(g => g.owner === 'mattpocock').enabledCount).toBe(2)
  })

  it('returns success with zero changes for unknown owner', () => {
    const r = setOwnerSkillsEnabled('Nobody', false)
    expect(r.success).toBe(true)
    expect(r.data.changed).toBe(0)
  })
})

describe('setProjectSkillsEnabled', () => {
  it('disables all skills in a specific project', () => {
    const r = setProjectSkillsEnabled('mattpocock', 'myproject', false)
    expect(r.success).toBe(true)
    expect(r.data.changed).toBe(1)

    // myproject skill disabled
    expect(fs.existsSync(path.join(userSkills, 'mattpocock__myproject__react-skill'))).toBe(false)
    // single-level skill still enabled
    expect(fs.existsSync(path.join(userSkills, 'mattpocock__ts-skill', 'SKILL.md'))).toBe(true)
  })

  it('enables all skills in a specific project', () => {
    setProjectSkillsEnabled('mattpocock', 'myproject', false)
    const r = setProjectSkillsEnabled('mattpocock', 'myproject', true)
    expect(r.data.changed).toBe(1)
    expect(fs.existsSync(path.join(userSkills, 'mattpocock__myproject__react-skill', 'SKILL.md'))).toBe(true)
  })
})
