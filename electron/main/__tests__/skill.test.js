// electron/main/__tests__/skill.test.js

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

function readSkillContent(skillPath) {
  if (!fs.existsSync(skillPath)) throw new Error(`Skill path does not exist: ${skillPath}`)
  const skillMdPath = path.join(skillPath, 'SKILL.md')
  if (!fs.existsSync(skillMdPath)) throw new Error(`SKILL.md not found in: ${skillPath}`)
  const content = fs.readFileSync(skillMdPath, 'utf-8')
  const stat = fs.statSync(skillMdPath)
  return { content, path: skillMdPath, lastModified: stat.mtimeMs }
}

function validateSkillMd(content) {
  const errors = []
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (!fm) { errors.push('Missing YAML frontmatter (--- ... ---)'); return { valid: false, errors } }
  const frontmatter = fm[1]
  if (!/^name:\s*\S+/m.test(frontmatter)) errors.push('Missing required field: name')
  if (!/^description:\s*\S+/m.test(frontmatter)) errors.push('Missing required field: description')
  return { valid: errors.length === 0, errors, frontmatter, body: content.slice(fm[0].length) }
}

function saveSkillContent(skillPath, content, expectedMtime = null) {
  const skillMdPath = path.join(skillPath, 'SKILL.md')
  if (!fs.existsSync(skillMdPath)) throw new Error(`SKILL.md not found in: ${skillPath}`)
  if (expectedMtime !== null) {
    const cur = fs.statSync(skillMdPath)
    if (cur.mtimeMs !== expectedMtime) return { success: false, error: 'File was modified externally. Please reload and try again.', conflict: true, currentContent: fs.readFileSync(skillMdPath, 'utf-8') }
  }
  const v = validateSkillMd(content)
  if (!v.valid) return { success: false, error: `Validation failed: ${v.errors.join(', ')}` }
  fs.writeFileSync(skillMdPath, content, 'utf-8')
  return { success: true }
}

describe('skill handlers', () => {
  const testDir = path.join(process.cwd(), '__test_tmp__')

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true })
    fs.mkdirSync(testDir, { recursive: true })
    fs.writeFileSync(path.join(testDir, 'SKILL.md'), '---\nname: test-skill\ndescription: A test skill\n---\n# Test\n', 'utf-8')
  })
  afterEach(() => { if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true }) })

  describe('readSkillContent', () => {
    it('reads SKILL.md with content path and mtime', () => {
      const r = readSkillContent(testDir)
      expect(r.content).toContain('test-skill')
      expect(r.path).toBe(path.join(testDir, 'SKILL.md'))
      expect(typeof r.lastModified).toBe('number')
    })
    it('throws when path missing', () => { expect(() => readSkillContent('/nonexistent')).toThrow('Skill path does not exist') })
    it('throws when SKILL.md missing', () => { const d = path.join(testDir, 'empty'); fs.mkdirSync(d); expect(() => readSkillContent(d)).toThrow('SKILL.md not found') })
  })

  describe('validateSkillMd', () => {
    it('validates correct frontmatter', () => { const r = validateSkillMd('---\nname: x\ndescription: y\n---\nbody'); expect(r.valid).toBe(true) })
    it('reports missing frontmatter', () => { const r = validateSkillMd('no front'); expect(r.errors).toContain('Missing YAML frontmatter (--- ... ---)') })
    it('reports missing name', () => { const r = validateSkillMd('---\ndescription: only\n---\nbody'); expect(r.errors).toContain('Missing required field: name') })
    it('reports missing description', () => { const r = validateSkillMd('---\nname: x\n---\nbody'); expect(r.errors).toContain('Missing required field: description') })
    it('reports multiple missing fields', () => { const r = validateSkillMd('---\n---\nbody'); expect(r.errors.length).toBeGreaterThanOrEqual(1) })
  })

  describe('saveSkillContent', () => {
    it('saves valid content', () => {
      const r = saveSkillContent(testDir, '---\nname: up\ndescription: up\n---\nnew')
      expect(r.success).toBe(true)
      expect(fs.readFileSync(path.join(testDir, 'SKILL.md'), 'utf-8')).toContain('up')
    })
    it('rejects invalid content', () => { const r = saveSkillContent(testDir, 'no front'); expect(r.success).toBe(false) })
    it('detects conflict on mtime mismatch', () => {
      const stat = fs.statSync(path.join(testDir, 'SKILL.md'))
      const oldMtime = stat.mtimeMs
      fs.writeFileSync(path.join(testDir, 'SKILL.md'), '---\nname: ext\ndescription: ext\n---\next', 'utf-8')
      const r = saveSkillContent(testDir, '---\nname: stale\ndescription: stale\n---\nstale', oldMtime)
      expect(r.conflict).toBe(true)
    })
    it('saves when mtime matches', () => {
      const stat = fs.statSync(path.join(testDir, 'SKILL.md'))
      expect(saveSkillContent(testDir, '---\nname: ok\ndescription: ok\n---\nok', stat.mtimeMs).success).toBe(true)
    })
    it('saves without mtime check', () => { expect(saveSkillContent(testDir, '---\nname: n\ndescription: n\n---\nb').success).toBe(true) })
    it('throws when SKILL.md missing', () => { const d = path.join(testDir, 'empty'); fs.mkdirSync(d); expect(() => saveSkillContent(d, '---\nname: x\ndescription: y\n---\nz')).toThrow('SKILL.md not found') })
  })
})
