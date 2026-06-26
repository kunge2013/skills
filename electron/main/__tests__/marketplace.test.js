// electron/main/__tests__/marketplace.test.js

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}))

const fsMock = {
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}
vi.mock('fs', () => fsMock)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from 'path'

vi.mock('../../../src/core/cache.js', () => ({
  getAllMarketplaceDirs: vi.fn(() => [process.cwd()]),
  getMarketplaceSourceDir: vi.fn(() => process.cwd()),
}))

vi.mock('../../../src/core/registry.js', () => ({
  parseMarketplace: vi.fn(),
}))

import { getAllMarketplaceDirs } from '../../../src/core/cache.js'
import { parseMarketplace } from '../../../src/core/registry.js'
const fs = fsMock

function listAllSkills() {
  const sourceDirs = getAllMarketplaceDirs()
  const allSkills = []; const seen = new Set()
  for (const sourceDir of sourceDirs) {
    const marketplace = parseMarketplace(sourceDir)
    if (!marketplace || !marketplace.plugins) continue
    for (const plugin of marketplace.plugins) {
      const sDir = path.join(sourceDir, plugin.source, 'skills')
      if (!fs.existsSync(sDir)) continue
      const skillDirs = fs.readdirSync(sDir).filter((d) => {
        const full = path.join(sDir, d)
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'))
      })
      for (const skillName of skillDirs) {
        if (seen.has(skillName)) continue; seen.add(skillName)
        allSkills.push({ skillName, pluginName: plugin.name, sourcePath: path.join(sDir, skillName),
          pluginDescription: plugin.description, pluginAuthor: plugin.author?.name || 'Unknown',
          pluginLicense: plugin.license || 'Unknown', pluginCategory: plugin.category || 'other', pluginKeywords: plugin.keywords || [] })
      }
    }
  }
  return allSkills
}

function listPlugins() {
  const sourceDirs = getAllMarketplaceDirs()
  const allPlugins = []; const seen = new Set()
  for (const sourceDir of sourceDirs) {
    const marketplace = parseMarketplace(sourceDir)
    if (!marketplace || !marketplace.plugins) continue
    for (const plugin of marketplace.plugins) {
      if (seen.has(plugin.name)) continue; seen.add(plugin.name)
      const sDir = path.join(sourceDir, plugin.source, 'skills')
      let skillCount = 0
      if (fs.existsSync(sDir)) skillCount = fs.readdirSync(sDir).filter((d) => {
        const full = path.join(sDir, d)
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'))
      }).length
      allPlugins.push({ name: plugin.name, source: plugin.source, description: plugin.description,
        author: plugin.author?.name || 'Unknown', license: plugin.license || 'Unknown',
        category: plugin.category || 'other', keywords: plugin.keywords || [], skillCount, sourceDir: path.join(sourceDir, plugin.source) })
    }
  }
  return allPlugins
}

function searchSkills(query, filters = {}) {
  let skills = listAllSkills()
  if (query) { const q = query.toLowerCase(); skills = skills.filter((s) => s.skillName.toLowerCase().includes(q) || s.pluginName.toLowerCase().includes(q) || s.pluginDescription?.toLowerCase().includes(q) || s.pluginKeywords?.some((kw) => kw.toLowerCase().includes(q))) }
  if (filters.category) skills = skills.filter((s) => s.pluginCategory === filters.category)
  if (filters.plugin) skills = skills.filter((s) => s.pluginName === filters.plugin)
  return skills
}

describe('marketplace handlers', () => {
  const root = process.cwd()
  beforeEach(() => { vi.clearAllMocks(); getAllMarketplaceDirs.mockReturnValue([root]) })

  describe('listPlugins', () => {
    it('returns plugins from marketplace.json', () => {
      parseMarketplace.mockReturnValue({ plugins: [{ name: 'tp', source: './plugins/tp', description: 'desc', author: { name: 'A' }, license: 'MIT', category: 'wf', keywords: ['k'] }] })
      fs.existsSync.mockImplementation((p) => p === path.join(root, 'plugins', 'tp', 'skills') || p === path.join(root, 'plugins', 'tp', 'skills', 's1') || p === path.join(root, 'plugins', 'tp', 'skills', 's1', 'SKILL.md'))
      fs.readdirSync.mockReturnValue(['s1'])
      fs.statSync.mockReturnValue({ isDirectory: () => true })
      const r = listPlugins()
      expect(r).toHaveLength(1)
      expect(r[0]).toMatchObject({ name: 'tp', description: 'desc', author: 'A', license: 'MIT', skillCount: 1 })
    })
    it('returns empty array when no plugins', () => { parseMarketplace.mockReturnValue({ plugins: [] }); expect(listPlugins()).toEqual([]) })
    it('returns empty array when null marketplace', () => { parseMarketplace.mockReturnValue(null); expect(listPlugins()).toEqual([]) })
    it('deduplicates plugins by name', () => {
      getAllMarketplaceDirs.mockReturnValue(['s1', 's2'])
      parseMarketplace.mockReturnValue({ plugins: [{ name: 'x', source: './x', description: '', author: {}, license: '', category: '', keywords: [] }] })
      fs.existsSync.mockReturnValue(false)
      expect(listPlugins()).toHaveLength(1)
    })
  })

  describe('listAllSkills', () => {
    it('returns skills with plugin metadata', () => {
      parseMarketplace.mockReturnValue({ plugins: [{ name: 'p', source: './p', description: 'pd', author: { name: 'A' }, license: 'MIT', category: 'c', keywords: ['k'] }] })
      fs.existsSync.mockImplementation((p) => p === path.join(root, 'p', 'skills') || p === path.join(root, 'p', 'skills', 's1') || p === path.join(root, 'p', 'skills', 's1', 'SKILL.md'))
      fs.readdirSync.mockReturnValue(['s1'])
      fs.statSync.mockReturnValue({ isDirectory: () => true })
      const r = listAllSkills()
      expect(r).toHaveLength(1)
      expect(r[0]).toMatchObject({ skillName: 's1', pluginName: 'p', pluginAuthor: 'A', pluginCategory: 'c' })
    })
    it('skips missing skills dir', () => { parseMarketplace.mockReturnValue({ plugins: [{ name: 'x', source: './x', description: '', author: {}, license: '', category: '', keywords: [] }] }); fs.existsSync.mockReturnValue(false); expect(listAllSkills()).toEqual([]) })
    it('deduplicates skills by name', () => {
      getAllMarketplaceDirs.mockReturnValue(['a', 'b'])
      parseMarketplace.mockReturnValue({ plugins: [{ name: 'p', source: './p', description: '', author: {}, license: '', category: '', keywords: [] }] })
      fs.existsSync.mockReturnValue(true); fs.readdirSync.mockReturnValue(['shared']); fs.statSync.mockReturnValue({ isDirectory: () => true })
      const r = listAllSkills()
      expect(r.filter((s) => s.skillName === 'shared')).toHaveLength(1)
    })
  })

  describe('searchSkills', () => {
    beforeEach(() => {
      parseMarketplace.mockReturnValue({ plugins: [
        { name: 'sp', source: './sp', description: 'search plugin', author: { name: 'A' }, license: 'MIT', category: 'u', keywords: ['search'] },
        { name: 'op', source: './op', description: 'other plugin', author: { name: 'O' }, license: 'MIT', category: 'd', keywords: [] },
      ]})
      fs.existsSync.mockReturnValue(true); fs.readdirSync.mockReturnValue(['find-docs', 'build-tools']); fs.statSync.mockReturnValue({ isDirectory: () => true })
    })
    it('returns all skills with no query', () => { expect(searchSkills('').length).toBeGreaterThan(0) })
    it('filters by skill name', () => { const r = searchSkills('find'); expect(r.some((s) => s.skillName.includes('find'))).toBe(true) })
    it('filters by description in keywords', () => { const r = searchSkills('search'); expect(r.some((s) => s.pluginKeywords?.includes('search'))).toBe(true) })
    it('filters by category', () => { const r = searchSkills('', { category: 'u' }); expect(r.every((s) => s.pluginCategory === 'u')).toBe(true) })
    it('filters by plugin name filter', () => { const r = searchSkills('', { plugin: 'sp' }); expect(r.every((s) => s.pluginName === 'sp')).toBe(true) })
    it('combines query and filters', () => { const r = searchSkills('build', { category: 'd' }); expect(r.every((s) => s.pluginCategory === 'd')).toBe(true) })
  })
})
