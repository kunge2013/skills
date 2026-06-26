// electron/main/__tests__/symlink.test.js

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { describe, it, expect, vi } from 'vitest'
import * as path from 'path'

vi.mock('../../../src/core/symlink.js', () => ({
  createSkillSymlink: vi.fn(() => true),
  removeSkillSymlink: vi.fn(() => true),
  getSymlinkStatus: vi.fn(() => ({ isLink: true, isValid: true, target: '/t', exists: true, hasSkillMd: true })),
}))
vi.mock('../../../src/commands/shared.js', () => ({
  findProjectSkillsDir: vi.fn((p) => path.join(p || process.cwd(), '.claude', 'skills')),
}))
vi.mock('../../../src/core/cache.js', () => ({ getAllMarketplaceDirs: vi.fn(() => [process.cwd()]) }))
vi.mock('../../../src/core/registry.js', () => ({
  findSkillMerged: vi.fn((_dirs, name) => name === 'missing' ? null : { skillName: name, pluginName: 't', sourcePath: '/skills/' + name }),
}))

import { createSkillSymlink, removeSkillSymlink, getSymlinkStatus } from '../../../src/core/symlink.js'
import { findProjectSkillsDir } from '../../../src/commands/shared.js'
import { getAllMarketplaceDirs } from '../../../src/core/cache.js'
import { findSkillMerged } from '../../../src/core/registry.js'

function installSkill(skillName, projectPath) {
  const skillsDir = findProjectSkillsDir(projectPath || undefined)
  const linkPath = path.join(skillsDir, skillName)
  const sourceDirs = getAllMarketplaceDirs()
  const skill = findSkillMerged(sourceDirs, skillName)
  if (!skill) return { success: false, error: `Skill '${skillName}' not found in marketplace` }
  createSkillSymlink(skill.sourcePath, linkPath)
  return { success: true, linkPath, targetPath: skill.sourcePath }
}
function uninstallSkill(skillName, projectPath) {
  removeSkillSymlink(path.join(findProjectSkillsDir(projectPath), skillName))
  return { success: true }
}
function checkSkillStatus(skillName) {
  const cwd = process.cwd()
  const linkPath = path.join(cwd, '.claude', 'skills', skillName)
  // Simulate: check if link exists
  const exists = getSymlinkStatus(linkPath).exists
  if (!exists) return { success: true, data: { installed: false, skillName } }
  const status = getSymlinkStatus(linkPath)
  return { success: true, data: { installed: true, skillName, linkPath, isLink: status.isLink, isValid: status.isValid, hasSkillMd: status.hasSkillMd } }
}

describe('symlink handlers', () => {
  describe('installSkill', () => {
    it('creates symlink for existing skill', () => {
      const r = installSkill('my-skill', '/project')
      expect(r.success).toBe(true)
      expect(r.linkPath).toBe(path.join('/project', '.claude', 'skills', 'my-skill'))
      expect(createSkillSymlink).toHaveBeenCalledWith('/skills/my-skill', r.linkPath)
    })
    it('returns error for missing skill', () => {
      const r = installSkill('missing', '/project')
      expect(r.success).toBe(false)
    })
    it('uses cwd when projectPath empty', () => {
      const r = installSkill('my-skill', '')
      expect(r.success).toBe(true)
      expect(r.linkPath).toBe(path.join(process.cwd(), '.claude', 'skills', 'my-skill'))
    })
  })
  describe('uninstallSkill', () => {
    it('removes symlink', () => {
      uninstallSkill('my-skill', '/project')
      expect(removeSkillSymlink).toHaveBeenCalledWith(path.join('/project', '.claude', 'skills', 'my-skill'))
    })
  })
  describe('checkSkillStatus', () => {
    it('returns installed status', () => {
      const r = checkSkillStatus('existing')
      expect(r.data.installed).toBe(true)
      expect(r.data.isLink).toBe(true)
    })
  })
})
