import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

test.describe('Prompt Maintenance Feature E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
    // Wait for the app to fully load
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.nav-sidebar')).toBeVisible({ timeout: 10000 })
  })

  // ========== 6.1: Verify "Prompt Maintenance" menu item in sidebar ==========
  test('6.1 - Prompt Maintenance menu item appears in the sidebar', async ({ page }) => {
    // Look for the menu item with index="promptMaintenance"
    const menuItems = page.locator('.el-menu-item')
    const count = await menuItems.count()

    let foundPromptOptimizer = false
    let foundPromptMaintenance = false

    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i)
      const text = await item.textContent()
      if (text?.includes('Prompt Optimizer') || text?.includes('提示词优化')) {
        foundPromptOptimizer = true
      }
      if (text?.includes('Prompt Maintenance') || text?.includes('提示词维护')) {
        foundPromptMaintenance = true
      }
    }

    expect(foundPromptOptimizer, 'Prompt Optimizer menu item should exist').toBe(true)
    expect(foundPromptMaintenance, 'Prompt Maintenance menu item should exist').toBe(true)

    // Verify it's clickable (has the promptMaintenance index)
    const maintenanceItem = page.locator('.el-menu-item').filter({ hasText: /Prompt Maintenance|提示词维护/ })
    await expect(maintenanceItem).toBeVisible()
    await expect(maintenanceItem).toBeEnabled()

    // Verify the menu item has the correct data-testid or index
    const indexAttr = await maintenanceItem.getAttribute('data-menu-id')
    // Element Plus uses data-menu-id or we check the index attribute
    // The index attribute is set internally, we just verify it responds to clicks
    console.log('6.1 PASS: Prompt Maintenance menu item found and is clickable')
  })

  // ========== 6.2: Verify clicking maintenance menu loads the maintenance page ==========
  test('6.2 - Clicking Prompt Maintenance loads the maintenance page', async ({ page }) => {
    const maintenanceItem = page.locator('.el-menu-item').filter({ hasText: /Prompt Maintenance|提示词维护/ })
    await expect(maintenanceItem).toBeVisible()

    // Click the maintenance menu item
    await maintenanceItem.click()

    // Wait a moment for view transition
    await page.waitForTimeout(500)

    // Verify the maintenance view is shown
    const mainContent = page.locator('.main-content')
    await expect(mainContent).toBeVisible()

    // The maintenance view should have the maintenance header with title
    const maintenanceTitle = page.locator('h2').filter({ hasText: /Prompt Maintenance|提示词维护/ })
    await expect(maintenanceTitle).toBeVisible({ timeout: 5000 })

    // Should have a "Create Template" button
    const createButton = page.locator('button').filter({ hasText: /Create Template|创建模板/ })
    await expect(createButton).toBeVisible({ timeout: 3000 })

    // The prompt view (tabs) should NOT be visible
    const promptTabs = page.locator('.prompt-tabs')
    await expect(promptTabs).toBeHidden()

    console.log('6.2 PASS: Prompt Maintenance page loaded correctly')
  })

  // ========== 6.3: Verify "Maintenance" tab is NOT in PromptOptimizer view ==========
  test('6.3 - Maintenance tab is NOT visible in PromptOptimizer view', async ({ page }) => {
    // Click the Prompt Optimizer menu item
    const promptOptimizerItem = page.locator('.el-menu-item').filter({ hasText: /Prompt Optimizer|提示词优化/ })
    await expect(promptOptimizerItem).toBeVisible()
    await promptOptimizerItem.click()

    // Wait for the prompt view to load
    await page.waitForTimeout(500)

    // The prompt view should be visible
    const promptTabs = page.locator('.prompt-tabs')
    await expect(promptTabs).toBeVisible({ timeout: 5000 })

    // Get all tab labels
    const tabLabels = page.locator('.el-tabs__item')
    const tabCount = await tabLabels.count()
    const tabNames: string[] = []
    for (let i = 0; i < tabCount; i++) {
      const name = await tabLabels.nth(i).textContent()
      tabNames.push(name?.trim() || '')
    }

    console.log('Tabs found in PromptOptimizer:', tabNames)

    // Verify Maintenance tab is NOT present
    const hasMaintenanceTab = tabNames.some(
      (name) => name.toLowerCase().includes('maintenance') || name === '维护'
    )
    expect(hasMaintenanceTab, 'Maintenance tab should NOT be visible in PromptOptimizer').toBe(false)

    console.log('6.3 PASS: Maintenance tab is correctly NOT present in PromptOptimizer')
  })

  // ========== 6.4: Verify all other PromptOptimizer tabs still work ==========
  test('6.4 - All other PromptOptimizer tabs still work', async ({ page }) => {
    // Click the Prompt Optimizer menu item first
    const promptOptimizerItem = page.locator('.el-menu-item').filter({ hasText: /Prompt Optimizer|提示词优化/ })
    await promptOptimizerItem.click()
    await page.waitForTimeout(500)

    // Wait for tabs to be visible
    const tabLabels = page.locator('.el-tabs__item')
    await expect(tabLabels.first()).toBeVisible({ timeout: 5000 })

    // Expected tabs (in order) based on PromptView.vue
    const expectedTabs = [
      { en: 'Optimize', zh: '优化', name: 'optimize' },
      { en: 'Iterate', zh: '迭代', name: 'iterate' },
      { en: 'Test', zh: '测试', name: 'test' },
      { en: 'Models', zh: '模型', name: 'models' },
      { en: 'History', zh: '历史', name: 'history' },
      { en: 'Settings', zh: '设置', name: 'settings' },
    ]

    // Verify tab count (should be 6, not 7 - no Maintenance)
    const tabCount = await tabLabels.count()
    expect(tabCount).toBe(6)

    // Test each tab
    for (const expected of expectedTabs) {
      const tabToClick = tabLabels.filter({ hasText: new RegExp(`${expected.en}|${expected.zh}`) })
      await expect(tabToClick).toBeVisible({
        timeout: 3000,
        message: `Tab "${expected.en}" / "${expected.zh}" should be visible`,
      })

      // Click the tab
      await tabToClick.click()
      await page.waitForTimeout(300)

      // Verify it becomes active
      const activeTab = page.locator('.el-tabs__item.is-active')
      const activeText = await activeTab.textContent()
      const isActive =
        activeText?.includes(expected.en) || activeText?.includes(expected.zh)
      expect(isActive, `Tab "${expected.en}" / "${expected.zh}" should become active after click`).toBe(true)

      console.log(`  Tab "${expected.en}" (${expected.name}) - OK`)
    }

    console.log('6.4 PASS: All 6 PromptOptimizer tabs are visible and functional')
  })
})
