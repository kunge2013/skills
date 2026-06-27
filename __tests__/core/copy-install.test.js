import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  copyInstallSkill,
  uninstallCopySkill,
  getCopyInstallStatus,
  copyDirRecursive,
} from '../../src/core/copy-install.js'

const testBase = path.join(os.tmpdir(), 'skills-test-' + Date.now())

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function createSkillSource(name) {
  const src = path.join(testBase, 'source', name)
  ensureDir(src)
  fs.writeFileSync(path.join(src, 'SKILL.md'), `---\nname: ${name}\ndescription: Test skill\n---\n\n# ${name}`, 'utf-8')
  fs.writeFileSync(path.join(src, 'readme.txt'), `Readme for ${name}`, 'utf-8')
  ensureDir(path.join(src, 'subdir'))
  fs.writeFileSync(path.join(src, 'subdir', 'nested.txt'), 'nested content', 'utf-8')
  return src
}

describe('copyDirRecursive', () => {
  const src = path.join(testBase, 'copy-src')
  const dest = path.join(testBase, 'copy-dest')

  beforeEach(() => {
    ensureDir(src)
    fs.writeFileSync(path.join(src, 'file.txt'), 'content', 'utf-8')
    ensureDir(path.join(src, 'dir'))
    fs.writeFileSync(path.join(src, 'dir', 'nested.txt'), 'nested', 'utf-8')
  })

  afterEach(() => {
    fs.rmSync(testBase, { recursive: true, force: true })
  })

  it('copies directory recursively', () => {
    copyDirRecursive(src, dest)
    expect(fs.existsSync(path.join(dest, 'file.txt'))).toBe(true)
    expect(fs.existsSync(path.join(dest, 'dir', 'nested.txt'))).toBe(true)
    expect(fs.readFileSync(path.join(dest, 'file.txt'), 'utf-8')).toBe('content')
  })
})

describe('copyInstallSkill', () => {
  let sourcePath
  let targetDir

  beforeEach(() => {
    sourcePath = createSkillSource('test-skill')
    targetDir = path.join(testBase, 'target')
    ensureDir(targetDir)
  })

  afterEach(() => {
    fs.rmSync(testBase, { recursive: true, force: true })
  })

  it('copies skill files and creates manifest', () => {
    const result = copyInstallSkill('test-skill', sourcePath, targetDir)
    expect(result.success).toBe(true)
    expect(result.installPath).toBe(path.join(targetDir, 'test-skill'))
    expect(fs.existsSync(path.join(result.installPath, 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(result.installPath, 'readme.txt'))).toBe(true)
    expect(fs.existsSync(path.join(result.installPath, 'subdir', 'nested.txt'))).toBe(true)
    expect(fs.existsSync(path.join(result.installPath, '.skills-manifest.json'))).toBe(true)

    const manifest = JSON.parse(
      fs.readFileSync(path.join(result.installPath, '.skills-manifest.json'), 'utf-8')
    )
    expect(manifest.skillName).toBe('test-skill')
    expect(manifest.mode).toBe('copy')
    expect(manifest.sourcePath).toBe(sourcePath)
    expect(manifest.installedAt).toBeDefined()
  })

  it('fails if source does not exist', () => {
    const result = copyInstallSkill('no-such-skill', '/nonexistent', targetDir)
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('fails if target directory does not exist', () => {
    const result = copyInstallSkill('test-skill', sourcePath, '/nonexistent-target')
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('fails if skill already exists', () => {
    copyInstallSkill('test-skill', sourcePath, targetDir)
    const result = copyInstallSkill('test-skill', sourcePath, targetDir)
    expect(result.success).toBe(false)
    expect(result.error).toContain('already exists')
  })
})

describe('uninstallCopySkill', () => {
  let sourcePath
  let targetDir
  let installPath

  beforeEach(() => {
    sourcePath = createSkillSource('test-skill')
    targetDir = path.join(testBase, 'target')
    ensureDir(targetDir)
    const result = copyInstallSkill('test-skill', sourcePath, targetDir)
    installPath = result.installPath
  })

  afterEach(() => {
    fs.rmSync(testBase, { recursive: true, force: true })
  })

  it('uninstalls copy-mode skill successfully', () => {
    const result = uninstallCopySkill(installPath)
    expect(result.success).toBe(true)
    expect(fs.existsSync(installPath)).toBe(false)
  })

  it('fails if skill directory does not exist', () => {
    const result = uninstallCopySkill(path.join(targetDir, 'nonexistent'))
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('refuses to uninstall directory without manifest', () => {
    // Create a non-managed directory
    const manual = path.join(targetDir, 'manual-skill')
    ensureDir(manual)
    fs.writeFileSync(path.join(manual, 'SKILL.md'), 'manual', 'utf-8')

    const result = uninstallCopySkill(manual)
    expect(result.success).toBe(false)
    expect(result.error).toContain('manifest')
  })
})

describe('getCopyInstallStatus', () => {
  let sourcePath
  let targetDir
  let installPath

  beforeEach(() => {
    sourcePath = createSkillSource('test-skill')
    targetDir = path.join(testBase, 'target')
    ensureDir(targetDir)
    const result = copyInstallSkill('test-skill', sourcePath, targetDir)
    installPath = result.installPath
  })

  afterEach(() => {
    fs.rmSync(testBase, { recursive: true, force: true })
  })

  it('returns copy status for copy-mode install', () => {
    const status = getCopyInstallStatus(installPath)
    expect(status.isCopy).toBe(true)
    expect(status.manifest.skillName).toBe('test-skill')
    expect(status.manifest.mode).toBe('copy')
  })

  it('returns not-copy for directory without manifest', () => {
    const manual = path.join(targetDir, 'manual')
    ensureDir(manual)
    const status = getCopyInstallStatus(manual)
    expect(status.isCopy).toBe(false)
  })
})
