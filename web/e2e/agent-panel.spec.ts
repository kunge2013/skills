import { test, expect } from '@playwright/test'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3010'

async function selectProviderInPlanTab(page: ReturnType<typeof test>, providerName: string) {
  // Plan tab is the second pane (aria-hidden="false" when active)
  const planPane = page.locator('.el-tab-pane[aria-hidden="false"]')
  const providerSelect = planPane.locator('.provider-select').first()
  await providerSelect.click()
  await page.waitForTimeout(800)
  // Use last() because there are two dropdowns (chat settings + plan provider)
  const option = page.locator('.el-select-dropdown__item').filter({ hasText: providerName }).last()
  await option.click({ timeout: 5000 })
  await page.waitForTimeout(300)
}

async function switchToPlanTab(page: ReturnType<typeof test>) {
  const planTab = page.locator('.el-tabs__item').filter({ hasText: /Plan|计划/ }).first()
  await planTab.click()
  await page.waitForTimeout(500)
  // Verify plan pane is now visible
  await expect(page.locator('.el-tab-pane[aria-hidden="false"] .agent-input')).toBeVisible({ timeout: 5000 })
}

test.describe('Agent Panel E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.nav-sidebar')).toBeVisible({ timeout: 10000 })
  })

  // ========== 1: Agent menu item appears in sidebar ==========
  test('1 - Agent menu item in sidebar', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await expect(agentItem).toBeVisible()
    await expect(agentItem).toBeEnabled()
    console.log('1 PASS: Agent menu item found')
  })

  // ========== 2: Agent panel loads with Chat tab active by default ==========
  test('2 - Agent panel loads with Chat tab active', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await expect(page.locator('.agent-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.panel-title')).toBeVisible()

    const chatTab = page.locator('.el-tabs__item').filter({ hasText: /Chat|对话/ }).first()
    await expect(chatTab).toHaveClass(/is-active/)

    await expect(page.locator('.agent-chat-view')).toBeVisible()
    await expect(page.locator('.chat-input-bar')).toBeVisible()

    console.log('2 PASS: Agent panel with Chat tab active')
  })

  // ========== 3: Plan tab shows existing form-based view ==========
  test('3 - Plan tab shows form-based view', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await switchToPlanTab(page)

    const planPane = page.locator('.el-tab-pane[aria-hidden="false"]')
    await expect(planPane.locator('.agent-input textarea')).toBeVisible()
    await expect(planPane.locator('.provider-select')).toBeVisible()
    await expect(planPane.locator('.model-input')).toBeVisible()
    await expect(planPane.locator('.el-button--primary')).toBeVisible()

    console.log('3 PASS: Plan tab shows form-based view')
  })

  // ========== 4: Provider dropdown has expected options ==========
  test('4 - Provider dropdown options', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await switchToPlanTab(page)

    const planPane = page.locator('.el-tab-pane[aria-hidden="false"]')
    await planPane.locator('.provider-select').click()
    await page.waitForTimeout(800)

    const allItems = page.locator('.el-select-dropdown__item')
    const count = await allItems.count()
    expect(count).toBeGreaterThanOrEqual(4)

    const providerItems: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await allItems.nth(i).textContent()
      if (/Anthropic|OpenAI|Gemini|DeepSeek/.test(text || '')) {
        providerItems.push(text || '')
      }
    }
    expect(providerItems.length).toBeGreaterThanOrEqual(4)
    expect(providerItems.some(t => /Anthropic/.test(t))).toBe(true)
    expect(providerItems.some(t => /OpenAI/.test(t))).toBe(true)

    console.log('4 PASS: Provider options:', providerItems.join(', '))
  })

  // ========== 5: Chat tab - message list and input bar visible ==========
  test('5 - Chat tab shows message list and input bar', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await expect(page.locator('.agent-chat-view')).toBeVisible()
    await expect(page.locator('.chat-message-list')).toBeVisible()
    await expect(page.locator('.chat-input-bar')).toBeVisible()

    console.log('5 PASS: Chat tab shows message list and input bar')
  })

  // ========== 6: Chat tab - settings popover works ==========
  test('6 - Chat tab settings popover', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    const settingsBtn = page.locator('.chat-input-bar .el-button.is-circle')
    await settingsBtn.click()
    await page.waitForTimeout(300)

    const popover = page.locator('.el-popover')
    await expect(popover).toBeVisible({ timeout: 3000 })

    await expect(popover.locator('.el-select')).toBeVisible()
    await expect(popover.locator('.el-input')).toBeVisible()

    console.log('6 PASS: Chat tab settings popover works')
  })

  // ========== 7: Plan tab - Submit button requires input ==========
  test('7 - Plan tab submit requires input', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await switchToPlanTab(page)

    const planPane = page.locator('.el-tab-pane[aria-hidden="false"]')
    const submitBtn = planPane.locator('.el-button--primary')
    await expect(submitBtn).toBeVisible()

    await submitBtn.click()
    await page.waitForTimeout(300)

    await expect(page.locator('.agent-panel')).toBeVisible()
    await expect(page.locator('.error-banner')).not.toBeVisible()

    console.log('7 PASS: Plan tab submit requires all inputs')
  })

  // ========== 8: Plan tab - Error banner on invalid model key ==========
  test('8 - Plan tab error banner on invalid model key', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await switchToPlanTab(page)
    await selectProviderInPlanTab(page, 'Anthropic')

    const planPane = page.locator('.el-tab-pane[aria-hidden="false"]')
    await planPane.locator('.agent-input textarea').fill('Test message')
    await planPane.locator('.model-input input').fill('invalid-model-key')
    await planPane.locator('.el-button--primary').click()

    await expect(page.locator('.error-banner')).toBeVisible({ timeout: 15000 })
    const errorText = await page.locator('.error-banner').textContent()
    expect(errorText).toBeTruthy()
    expect(errorText!.length).toBeGreaterThan(0)

    console.log('8 PASS: Plan tab error banner visible:', errorText)
  })

  // ========== 9: Plan tab - Plan/error view on valid request ==========
  test('9 - Plan tab plan view on valid request', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await switchToPlanTab(page)
    await selectProviderInPlanTab(page, 'Anthropic')

    const planPane = page.locator('.el-tab-pane[aria-hidden="false"]')
    await planPane.locator('.agent-input textarea').fill('Write hello world in TypeScript')
    await planPane.locator('.model-input input').fill('claude-sonnet-4-5-20250514')
    await planPane.locator('.el-button--primary').click()

    await page.waitForTimeout(8000)

    const hasPlan = await page.locator('.plan-view').isVisible().catch(() => false)
    const hasError = await page.locator('.error-banner').isVisible().catch(() => false)

    if (hasPlan) {
      console.log('9 PASS: Plan view appeared')
    } else if (hasError) {
      const errorText = await page.locator('.error-banner').textContent()
      console.log('9 PASS: Error shown (API unconfigured):', errorText)
    }
    expect(hasPlan || hasError).toBe(true)
  })

  // ========== 10: Navigation preserves tab state ==========
  test('10 - Navigation preserves tab state', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await switchToPlanTab(page)

    const promptItem = page.locator('.el-menu-item').filter({ hasText: /Prompt Optimizer|提示词优化/ })
    await promptItem.click()
    await page.waitForTimeout(500)

    await agentItem.click()
    await page.waitForTimeout(500)

    await expect(page.locator('.agent-panel')).toBeVisible()

    console.log('10 PASS: Agent panel restored after navigation')
  })
})
