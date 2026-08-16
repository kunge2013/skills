import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn, ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'

// [AGC:START] tool=Cc author=fangkun
/**
 * E2E for the Skill Toggle feature.
 * Self-contained: builds a fixture project with known authors/skills,
 * starts the web server (createServer only), drives the checkbox tree.
 */

const PORT = Number(process.env.TEST_PORT || 3025)
const BASE = process.env.TEST_BASE_URL || `http://127.0.0.1:${PORT}`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// Use the bundled full Chromium (new headless) instead of the headless shell,
// which may not be downloaded on this machine.
test.use({ channel: 'chromium' })
const webJs = path.join(repoRoot, '..', 'src', 'commands', 'web.js')

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-toggle-e2e-'))
const projectDir = path.join(fixtureRoot, 'project')
const projectSkills = path.join(projectDir, '.claude', 'skills')
const userSkills = path.join(fixtureRoot, 'home', '.claude', 'skills')

let serverProc: ChildProcess | null = null

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function writeSkill(dir: string, name: string, author: string) {
  ensureDir(dir)
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} description\nauthor: ${author}\n---\n\n# ${name}\n`,
    'utf-8'
  )
}

test.beforeAll(async () => {
  // Fixture project scope: two authors
  ensureDir(path.join(projectDir, '.git'))
  writeSkill(path.join(projectSkills, 'alpha-one'), 'alpha-one', 'Alice')
  writeSkill(path.join(projectSkills, 'alpha-two'), 'alpha-two', 'Alice')
  writeSkill(path.join(projectSkills, 'beta-one'), 'beta-one', 'Bob')

  // User scope: point HOME-like lookup is not injectable over HTTP, so the
  // user scope here is the real ~/.claude/skills -- read-only assertions only.

  // Launcher: createServer without browser opening / prompt server
  const launcher = path.join(fixtureRoot, 'launch-server.js')
  fs.writeFileSync(
    launcher,
    `const { createServer } = require(${JSON.stringify(webJs)});\n` +
      `const server = createServer(${PORT});\n` +
      `server.listen(${PORT}, '127.0.0.1', () => console.log('READY'));\n`,
    'utf-8'
  )

  serverProc = spawn(process.execPath, [launcher], { cwd: projectDir, stdio: 'pipe' })
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 15000)
    serverProc!.stdout!.on('data', (d: Buffer) => {
      if (d.toString().includes('READY')) {
        clearTimeout(t)
        resolve()
      }
    })
    serverProc!.on('error', reject)
  })
})

test.afterAll(async () => {
  serverProc?.kill()
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

test.beforeEach(async ({ page }) => {
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.nav-sidebar')).toBeVisible({ timeout: 10000 })
})

test('sidebar shows Skill Toggle menu item', async ({ page }) => {
  const item = page.locator('.el-menu-item').filter({ hasText: /Skill Toggle|技能启停/ })
  await expect(item).toBeVisible()
})

test('toggle view groups skills by author', async ({ page }) => {
  await page.locator('.el-menu-item').filter({ hasText: /Skill Toggle|技能启停/ }).click()
  const tree = page.locator('.skill-toggle .el-tree')
  await expect(tree).toBeVisible({ timeout: 10000 })

  const rows = tree.locator('.el-tree-node__content')
  await expect(rows.filter({ hasText: /^Alice/ })).toBeVisible()
  await expect(rows.filter({ hasText: /^Bob/ })).toBeVisible()
  await expect(rows.filter({ hasText: 'alpha-one' })).toBeVisible()
  await expect(rows.filter({ hasText: 'alpha-two' })).toBeVisible()
  await expect(rows.filter({ hasText: 'beta-one' })).toBeVisible()
})

test('unchecking a leaf checkbox disables that skill on disk', async ({ page }) => {
  await page.locator('.el-menu-item').filter({ hasText: /Skill Toggle|技能启停/ }).click()
  const row = page
    .locator('.skill-toggle .el-tree')
    .locator('.el-tree-node__content')
    .filter({ hasText: 'alpha-one' })
  await expect(row).toBeVisible()
  await row.locator('.el-checkbox').click()

  const disabledPath = path.join(projectSkills, '.kungeskill-disabled', 'alpha-one')
  await expect
    .poll(() => fs.existsSync(disabledPath), { timeout: 10000 })
    .toBe(true)
  await expect
    .poll(() => fs.existsSync(path.join(projectSkills, 'alpha-one')), { timeout: 10000 })
    .toBe(false)

  // After reload the checkbox stays unchecked and author counter shows 1/2
  await expect
    .poll(async () => row.locator('input.el-checkbox__original').isChecked(), { timeout: 10000 })
    .toBe(false)
  const aliceRow = page
    .locator('.skill-toggle .el-tree')
    .locator('.el-tree-node__content')
    .filter({ hasText: /^Alice/ })
  await expect(aliceRow).toContainText('(1/2)')
})

test('checking the author checkbox batch re-enables all its skills', async ({ page }) => {
  // arrange: alpha-one disabled (leftover from previous test is fine, but ensure)
  const disabledPath = path.join(projectSkills, '.kungeskill-disabled', 'alpha-one')
  if (!fs.existsSync(disabledPath)) {
    fs.mkdirSync(path.dirname(disabledPath), { recursive: true })
    fs.renameSync(path.join(projectSkills, 'alpha-one'), disabledPath)
  }

  await page.locator('.el-menu-item').filter({ hasText: /Skill Toggle|技能启停/ }).click()
  const aliceRow = page
    .locator('.skill-toggle .el-tree')
    .locator('.el-tree-node__content')
    .filter({ hasText: /^Alice/ })
  await expect(aliceRow).toBeVisible({ timeout: 10000 })
  await aliceRow.locator('.el-checkbox').click()

  // Both alpha skills back in place
  await expect
    .poll(() => fs.existsSync(path.join(projectSkills, 'alpha-one')), { timeout: 10000 })
    .toBe(true)
  await expect
    .poll(() => fs.existsSync(path.join(projectSkills, 'alpha-two')), { timeout: 10000 })
    .toBe(true)
  await expect(aliceRow).toContainText('(2/2)')

  // Bob untouched
  expect(fs.existsSync(path.join(projectSkills, 'beta-one'))).toBe(true)
})

test('unchecking the author checkbox batch disables all its skills', async ({ page }) => {
  await page.locator('.el-menu-item').filter({ hasText: /Skill Toggle|技能启停/ }).click()
  const aliceRow = page
    .locator('.skill-toggle .el-tree')
    .locator('.el-tree-node__content')
    .filter({ hasText: /^Alice/ })
  await expect(aliceRow).toBeVisible({ timeout: 10000 })
  await aliceRow.locator('.el-checkbox').click()

  const disabledDir = path.join(projectSkills, '.kungeskill-disabled')
  await expect
    .poll(
      () =>
        fs.existsSync(path.join(disabledDir, 'alpha-one')) &&
        fs.existsSync(path.join(disabledDir, 'alpha-two')),
      { timeout: 10000 }
    )
    .toBe(true)
  await expect(aliceRow).toContainText('(0/2)')

  // restore for cleanliness
  await aliceRow.locator('.el-checkbox').click()
  await expect
    .poll(() => fs.existsSync(path.join(projectSkills, 'alpha-one')), { timeout: 10000 })
    .toBe(true)
})
// [AGC:END]
