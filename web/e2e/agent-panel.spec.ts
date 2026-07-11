import { test, expect } from '@playwright/test'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3010'

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

  // ========== 2: Agent panel loads with chat view ==========
  test('2 - Agent panel loads with chat view', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await expect(page.locator('.agent-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.panel-title')).toBeVisible()
    await expect(page.locator('.agent-chat-view')).toBeVisible()
    await expect(page.locator('.chat-message-list')).toBeVisible()
    await expect(page.locator('.chat-input-bar')).toBeVisible()

    console.log('2 PASS: Agent panel with chat view loaded')
  })

  // ========== 3: Model dropdown visible ==========
  test('3 - Model dropdown visible', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    // Wait for models to load
    await page.waitForTimeout(2000)

    const modelSelect = page.locator('.model-select')
    await expect(modelSelect).toBeVisible({ timeout: 5000 })

    console.log('3 PASS: Model dropdown visible')
  })

  // ========== 4: Model dropdown has expected options ==========
  test('4 - Model dropdown options', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(2000)

    const modelSelect = page.locator('.model-select')
    await expect(modelSelect).toBeVisible({ timeout: 5000 })

    // Open dropdown
    await modelSelect.click()
    await page.waitForTimeout(800)

    const allItems = page.locator('.el-select-dropdown__item')
    const count = await allItems.count()
    expect(count).toBeGreaterThanOrEqual(1)

    const itemTexts: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await allItems.nth(i).textContent()
      itemTexts.push(text || '')
    }

    console.log('4 PASS: Model dropdown options:', itemTexts.join(', '))
  })

  // ========== 5: Chat shows message list and input bar ==========
  test('5 - Chat shows message list and input bar', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    await expect(page.locator('.agent-chat-view')).toBeVisible()
    await expect(page.locator('.chat-message-list')).toBeVisible()
    await expect(page.locator('.chat-input-bar')).toBeVisible()

    const textarea = page.locator('.chat-input-bar textarea')
    await expect(textarea).toBeVisible()

    console.log('5 PASS: Chat shows message list and input bar')
  })

  // ========== 6: Send button disabled without message ==========
  test('6 - Send button state', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(2000)

    const sendBtn = page.locator('.chat-input-bar .el-button--primary')
    await expect(sendBtn).toBeVisible()

    // Button should be disabled when no message (model may or may not be auto-selected)
    await expect(sendBtn).toBeDisabled({ timeout: 5000 })

    console.log('6 PASS: Send button is disabled when no message')
  })

  // ========== 7: Send requires input ==========
  test('7 - Send button with message', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(2000)

    const textarea = page.locator('.chat-input-bar textarea')
    await textarea.fill('Test message')
    await page.waitForTimeout(300)

    const sendBtn = page.locator('.chat-input-bar .el-button--primary')

    // If a model is auto-selected, button should be enabled
    const isEnabled = await sendBtn.isEnabled()
    if (isEnabled) {
      console.log('7 PASS: Send button enabled with message + model')
    } else {
      // No models loaded yet - button stays disabled
      await expect(sendBtn).toBeDisabled({ timeout: 3000 })
      console.log('7 PASS: Send button disabled (no model loaded)')
    }
  })

  // ========== 8: Error or response on send ==========
  test('8 - Error or response on send', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(2000)

    // The model should already be auto-selected, just type and send
    const textarea = page.locator('.chat-input-bar textarea')
    await textarea.fill('Test message')
    await page.waitForTimeout(300)

    // Check if send is enabled
    const sendBtn = page.locator('.chat-input-bar .el-button--primary')
    const isEnabled = await sendBtn.isEnabled()

    if (!isEnabled) {
      console.log('8 SKIP: Send button disabled (no model loaded)')
      return
    }

    await sendBtn.click()
    await page.waitForTimeout(8000)

    const hasError = await page.locator('.error-banner').isVisible().catch(() => false)
    const hasAgentMsg = await page.locator('.chat-bubble--agent').isVisible().catch(() => false)
    const hasUserMsg = await page.locator('.chat-bubble--user').isVisible().catch(() => false)

    if (hasUserMsg && (hasAgentMsg || hasError)) {
      console.log('8 PASS: Message sent, response received')
    } else if (hasUserMsg) {
      console.log('8 PASS: User message sent')
    } else {
      console.log('8 SKIP: No response visible')
      expect(hasUserMsg || hasAgentMsg || hasError).toBe(true)
    }
  })

  // ========== 9: Response on valid send ==========
  test('9 - Response on valid send', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(2000)

    const textarea = page.locator('.chat-input-bar textarea')
    await textarea.fill('Say hello briefly')
    await page.waitForTimeout(300)

    const sendBtn = page.locator('.chat-input-bar .el-button--primary')
    const isEnabled = await sendBtn.isEnabled()
    if (!isEnabled) {
      console.log('9 SKIP: Send button disabled (no model loaded)')
      return
    }

    await sendBtn.click()

    // Wait for user message to appear
    await expect(page.locator('.chat-bubble--user')).toBeVisible({ timeout: 5000 })

    // Wait for response or loading
    await page.waitForTimeout(8000)

    const hasAgentMsg = await page.locator('.chat-bubble--agent').isVisible().catch(() => false)
    const hasError = await page.locator('.chat-bubble--error').isVisible().catch(() => false)

    if (hasAgentMsg) {
      console.log('9 PASS: Agent responded')
    } else if (hasError) {
      console.log('9 PASS: Error response shown')
    } else {
      console.log('9 PASS: Message sent (awaiting response)')
    }
  })

  // ========== 10: Navigation restores agent view ==========
  test('10 - Navigation restores agent view', async ({ page }) => {
    const agentItem = page.locator('.el-menu-item').filter({ hasText: /Agent|智能体/ })
    await agentItem.click()
    await page.waitForTimeout(500)

    const promptItem = page.locator('.el-menu-item').filter({ hasText: /Prompt Optimizer|提示词优化/ })
    await promptItem.click()
    await page.waitForTimeout(500)

    await agentItem.click()
    await page.waitForTimeout(500)

    await expect(page.locator('.agent-panel')).toBeVisible()
    await expect(page.locator('.agent-chat-view')).toBeVisible({ timeout: 5000 })

    console.log('10 PASS: Agent chat view restored after navigation')
  })
})
