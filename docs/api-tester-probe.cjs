// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// [AGC:START] tool=Cc author=fangkun
const { chromium } = require('D:/github.io/skills/node_modules/playwright')
const CHROME_EXE = 'C:/Users/ThinkPad/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:3010/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.locator('.el-menu-item', { hasText: 'API 调用' }).first().click()
  await page.locator('.api-tester').first().waitFor({ state: 'visible' })
  await page.waitForTimeout(800)
  const big = { a: 1, b: 'hello', c: true, d: null, arr: [1, 2, 3], nested: { x: 1.5, y: false } }
  await page.evaluate((jsonStr) => {
    const app = document.querySelector('#app').__vue_app__
    let pinia = app._context.provides[Symbol.for('pinia')] || app._context.provides.pinia
    const store = pinia._s.get('prompt')
    store.apiTesterResponse = jsonStr
    return true
  }, JSON.stringify(big, null, 2))
  await page.waitForTimeout(400)
  const info = await page.evaluate(() => {
    const span = document.querySelector('.response-display .tok-key')
    const pre = document.querySelector('.response-display pre')
    const comp = getComputedStyle(span)
    const matched = []
    for (const sheet of Array.from(document.styleSheets)) {
      let rules
      try { rules = sheet.cssRules } catch { continue }
      for (const rule of Array.from(rules)) {
        if (rule.selectorText && rule.style && rule.style.color) {
          try { if (span.matches(rule.selectorText)) matched.push(rule.selectorText + ' => ' + rule.style.color) } catch { /* ignore */ }
        }
      }
    }
    return {
      spanColor: comp.color,
      preColor: getComputedStyle(pre).color,
      matchedRules: matched,
      preAttrs: Array.from(pre.attributes).map((a) => a.name + '=' + a.value).join(' '),
      spanAttrs: Array.from(span.attributes).map((a) => a.name + '=' + a.value).join(' '),
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
// [AGC:END]
