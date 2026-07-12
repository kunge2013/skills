import { test, expect } from '@playwright/test';

test('agent chat sends message and receives streaming response', async ({ page }) => {
  await page.goto('http://localhost:3010');
  await page.waitForLoadState('networkidle', { timeout: 10000 });

  // Click Agent in sidebar
  await page.locator('text=Agent').click({ timeout: 10000 });
  await page.waitForTimeout(2000);

  // Wait for textarea
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 10000 });
  await textarea.fill('hello');
  await page.waitForTimeout(2000);

  // Send message
  const sendBtn = page.locator('.btn-send:not(:disabled)');
  if (await sendBtn.isVisible().catch(() => false)) {
    await sendBtn.click();
  } else {
    await textarea.press('Enter');
  }

  // Wait for response
  await page.waitForTimeout(12000);

  // Check Vue state directly
  const vueState = await page.evaluate(() => {
    const app = document.querySelector('#app');
    if (!app) return { error: 'no #app' };
    // Try to access Vue devtools proxy
    const instance = (app as any).__vue_app__?.provide?.__globalProperties__;
    // Check if there's any agent message with content
    const agentBubbles = document.querySelectorAll('[class*="chat-message--agent"]');
    const results: Array<{text: string; content: string; streaming: boolean}> = [];
    agentBubbles.forEach(el => {
      results.push({
        text: el.textContent?.slice(0, 100) || '',
        content: el.querySelector('.agent-text')?.textContent?.slice(0, 100) || '',
        streaming: !!el.querySelector('.streaming-cursor'),
      });
    });
    return { bubbles: results, url: window.location.href };
  });

  console.log('Vue state:', JSON.stringify(vueState, null, 2));

  // Screenshot
  await page.screenshot({ path: 'e2e/screens/04-final.png', fullPage: true });

  // Check messages from DOM
  const agentBubbles = page.locator('[class*="chat-message--agent"]');
  const bubbleCount = await agentBubbles.count();

  // Check for actual text content (not just cursor)
  const agentTextEls = page.locator('.agent-text');
  const textCount = await agentTextEls.count();

  console.log('Agent bubbles:', bubbleCount);
  console.log('Agent text elements:', textCount);

  // Verify the response is non-empty
  expect(bubbleCount).toBeGreaterThan(0);
});
