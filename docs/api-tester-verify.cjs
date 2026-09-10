// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
/* eslint-disable no-console */
// [AGC:START] tool=Cc author=fangkun
const { chromium } = require('D:/github.io/skills/node_modules/playwright')

const BASE = 'http://localhost:3010/'
const SHOT_DIR = 'D:/github.io/skills/docs'
const CHROME_EXE = 'C:/Users/ThinkPad/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'

const results = []

function report(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

// Large nested JSON object exercising all token types (strings, numbers,
// booleans, null, nested arrays/objects).
function buildLargeObject() {
  const items = []
  for (let i = 0; i < 120; i++) {
    items.push({
      id: i,
      name: `item-${i}-with-some-lengthy-text-to-make-it-very-long`,
      active: i % 2 === 0,
      score: Math.random() * 1000,
      ratio: i / 7,
      tags: ['alpha', 'beta', 'gamma', 'delta', `tag-${i}`],
      nested: {
        level: 2,
        ok: i % 3 === 0,
        nothing: null,
        big: 123456789012345,
        small: -42.75,
        exp: 1.5e10,
      },
    })
  }
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content:
            'This is a very long assistant response that contains lots of text to force the panel to scroll internally. '.repeat(40),
        },
        finish_reason: 'stop',
        index: 0,
      },
    ],
    usage: { prompt_tokens: 1520, completion_tokens: 4987, total_tokens: 6507, cache_read_input_tokens: null },
    model: 'qwen3.5-plus',
    system_fingerprint: null,
    items,
    enabled: true,
    debug: false,
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_EXE,
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text())
  })

  // ---------- 1. NAVIGATION ----------
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // Click sidebar menu item "API 调用" (zh-CN). Locale appears to be zh-CN.
  let clicked = false
  const sidebarMenu = page.locator('.el-menu-item', { hasText: 'API 调用' })
  if (await sidebarMenu.count()) {
    await sidebarMenu.first().click()
    clicked = true
  }
  if (!clicked) {
    const apiTesterAlt = page.locator('.el-menu-item', { hasText: 'API Tester' })
    if (await apiTesterAlt.count()) {
      await apiTesterAlt.first().click()
      clicked = true
    }
  }
  report('Navigate via sidebar "API 调用"/"API Tester"', clicked, clicked ? 'menu item clicked' : 'menu item NOT found')

  // Wait for the API tester page to render.
  await page.locator('.api-tester').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(800)

  // Model dropdown prefilled.
  const modelSelect = page.locator('.api-tester .model-select')
  const modelText = (await modelSelect.innerText().catch(() => '')).trim()
  report('Model dropdown prefilled', modelText.length > 0, `model select text: "${modelText}"`)

  // Buttons present.
  for (const label of ['加载示例', '格式化', '清空', '发送', '复制']) {
    const btn = page.locator('.api-tester button', { hasText: label }).first()
    report(`Button "${label}" present`, (await btn.count()) > 0, '')
  }

  // Request textarea auto-loaded example JSON.
  const textarea = page.locator('.api-tester .el-textarea__inner').first()
  await textarea.waitFor({ state: 'visible', timeout: 10000 })
  const initialVal = await textarea.inputValue()
  report('Request textarea auto-loads example JSON', initialVal.trim().length > 0, `length=${initialVal.length}`)

  await page.screenshot({ path: `${SHOT_DIR}/api-tester-1-initial.png`, fullPage: false })

  // ---------- 2. STYLING (computed styles) ----------
  const style = await page.evaluate(() => {
    const ta = document.querySelector('.api-tester .el-textarea__inner')
    const rd = document.querySelector('.api-tester .response-display')
    if (!ta || !rd) return { err: 'missing elements' }
    const tcs = getComputedStyle(ta)
    const rcs = getComputedStyle(rd)
    return {
      taBg: tcs.backgroundColor,
      taColor: tcs.color,
      taFont: tcs.fontFamily,
      rdBg: rcs.backgroundColor,
    }
  })
  if (style.err) {
    report('Textarea dark code-editor background', false, style.err)
    report('Textarea monospace text color', false, style.err)
    report('Response display dark background', false, style.err)
  } else {
    report('Request textarea bg is rgb(30,30,30)', style.taBg === 'rgb(30, 30, 30)', style.taBg)
    report('Request textarea color is rgb(212,212,212)', style.taColor === 'rgb(212, 212, 212)', style.taColor)
    report(
      'Request textarea font is monospace/Consolas',
      /Consolas|monospace/i.test(style.taFont),
      style.taFont
    )
    report('Response display bg is rgb(30,30,30)', style.rdBg === 'rgb(30, 30, 30)', style.rdBg)
  }

  // ---------- 3. SYNTAX HIGHLIGHTING (inject long JSON via store) ----------
  const bigJson = JSON.stringify(buildLargeObject(), null, 2)
  const inject = await page.evaluate((jsonStr) => {
    const app = document.querySelector('#app').__vue_app__
    if (!app) return { ok: false, why: 'no __vue_app__' }
    let pinia =
      (app._context && app._context.provides && (app._context.provides[Symbol.for('pinia')] || app._context.provides.pinia)) ||
      null
    if (!pinia && app.config && app.config.globalProperties && app.config.globalProperties.$pinia) {
      pinia = app.config.globalProperties.$pinia
    }
    if (!pinia) return { ok: false, why: 'no pinia provider' }
    const store = pinia._s && pinia._s.get('prompt')
    if (!store) return { ok: false, why: 'no prompt store' }
    store.apiTesterResponse = jsonStr
    return { ok: true, why: '' }
  }, bigJson)
  report('Inject long JSON into store.apiTesterResponse', inject.ok, inject.ok ? '' : inject.why)

  if (inject.ok) {
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOT_DIR}/api-tester-2-long-response.png`, fullPage: false })

    // Count token spans & colors.
    const hl = await page.evaluate(() => {
      const pre = document.querySelector('.response-display pre')
      if (!pre) return { err: 'no <pre> in response panel' }
      const count = (sel) => pre.querySelectorAll(sel).length
      const key = pre.querySelector('.tok-key')
      return {
        hasPre: true,
        tokKey: count('.tok-key'),
        tokString: count('.tok-string'),
        tokNumber: count('.tok-number'),
        tokKeyword: count('.tok-keyword'),
        keyColor: key ? getComputedStyle(key).color : null,
      }
    })
    if (hl.err) {
      report('Syntax highlighting spans rendered', false, hl.err)
    } else {
      report(
        'Token spans rendered (tok-key/string/number/keyword)',
        hl.tokKey > 0 && hl.tokString > 0 && hl.tokNumber > 0 && hl.tokKeyword > 0,
        `key=${hl.tokKey} str=${hl.tokString} num=${hl.tokNumber} kw=${hl.tokKeyword}`
      )
      report('tok-key color is rgb(156,220,254)', hl.keyColor === 'rgb(156, 220, 254)', String(hl.keyColor))
    }
  }

  // ---------- 4. OVERFLOW FIX (most important) ----------
  const overflow = await page.evaluate(() => {
    const sendBtn = document.querySelector('.api-tester .send-bar .el-button')
    const rd = document.querySelector('.api-tester .response-display')
    const ta = document.querySelector('.api-tester .el-textarea__inner')
    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const sr = r(sendBtn)
    const rr = r(rd)
    const innerH = window.innerHeight
    const docScrollH = document.documentElement.scrollHeight
    const rdStyle = rd ? getComputedStyle(rd) : null
    return {
      sendBtnVisible: sr ? sr.bottom <= innerH && sr.top >= 0 : false,
      sendRect: sr ? { top: Math.round(sr.top), bottom: Math.round(sr.bottom) } : null,
      innerHeight: innerH,
      rdOverflowY: rdStyle ? rdStyle.overflowY : null,
      rdScrollH: rd ? rd.scrollHeight : 0,
      rdClientH: rd ? rd.clientHeight : 0,
      rdRect: rr ? { top: Math.round(rr.top), bottom: Math.round(rr.bottom) } : null,
      taScrollH: ta ? ta.scrollHeight : 0,
      taClientH: ta ? ta.clientHeight : 0,
      docScrollH,
      docEqualsViewport: Math.abs(docScrollH - innerH) <= 2,
    }
  })

  const rdScrollsInternally =
    overflow.rdOverflowY === 'auto' && overflow.rdScrollH > overflow.rdClientH
  const rdHeightBounded = overflow.rdClientH < innerHeightMinus100(overflow.innerHeight)

  report('Send button fully visible (long response)', overflow.sendBtnVisible, JSON.stringify(overflow.sendRect))
  report('Response panel scrolls internally (overflow-y auto)', overflow.rdOverflowY === 'auto', String(overflow.rdOverflowY))
  report('Response panel has internal overflow (scrollH>clientH)', rdScrollsInternally, `scrollH=${overflow.rdScrollH} clientH=${overflow.rdClientH}`)
  report('Response panel height bounded (< innerHeight-100)', rdHeightBounded, `clientH=${overflow.rdClientH} innerH=${overflow.innerHeight}`)
  report(
    'Page container not growing (doc scrollH ~ viewport)',
    overflow.docEqualsViewport,
    `docScrollH=${overflow.docScrollH} innerH=${overflow.innerHeight}`
  )

  // Scroll the response panel to the bottom to prove internal scrolling works.
  await page.evaluate(() => {
    const rd = document.querySelector('.api-tester .response-display')
    if (rd) rd.scrollTop = rd.scrollHeight
  })
  await page.waitForTimeout(300)
  const afterScroll = await page.evaluate(() => {
    const rd = document.querySelector('.api-tester .response-display')
    const sendBtn = document.querySelector('.api-tester .send-bar .el-button')
    const r = sendBtn.getBoundingClientRect()
    return { scrollTop: rd ? rd.scrollTop : 0, sendVisible: r.bottom <= window.innerHeight && r.top >= 0 }
  })
  report('Response panel scrolls to bottom (scrollTop>0)', afterScroll.scrollTop > 0, `scrollTop=${Math.round(afterScroll.scrollTop)}`)
  report('Send button still visible after scrolling response', afterScroll.sendVisible, '')
  await page.screenshot({ path: `${SHOT_DIR}/api-tester-3-scrolled-response.png`, fullPage: false })

  // ---------- Fill textarea with a large payload & re-check ----------
  const largePayload = JSON.stringify(
    { items: buildLargeObject().items, nested: buildLargeObject(), extra: 'x'.repeat(3000) },
    null,
    2
  )
  await textarea.fill(largePayload)
  await page.waitForTimeout(300)

  const overflowTa = await page.evaluate(() => {
    const ta = document.querySelector('.api-tester .el-textarea__inner')
    const sendBtn = document.querySelector('.api-tester .send-bar .el-button')
    const r = sendBtn.getBoundingClientRect()
    return {
      taScrollH: ta.scrollHeight,
      taClientH: ta.clientHeight,
      taOverflowY: getComputedStyle(ta).overflowY,
      sendVisible: r.bottom <= window.innerHeight && r.top >= 0,
      docScrollH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
    }
  })
  report(
    'Textarea scrolls internally with large payload (scrollH>clientH)',
    overflowTa.taScrollH > overflowTa.taClientH,
    `scrollH=${overflowTa.taScrollH} clientH=${overflowTa.taClientH}`
  )
  report('Send button still visible with large request payload', overflowTa.sendVisible, '')
  report(
    'Page not growing with large request payload',
    Math.abs(overflowTa.docScrollH - overflowTa.innerH) <= 2,
    `docScrollH=${overflowTa.docScrollH} innerH=${overflowTa.innerH}`
  )
  await page.screenshot({ path: `${SHOT_DIR}/api-tester-4-large-payload.png`, fullPage: false })

  // ---------- summary ----------
  console.log('\n===== SUMMARY =====')
  let pass = 0
  let fail = 0
  for (const r of results) {
    if (r.ok) pass++
    else fail++
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}`)
  }
  console.log(`TOTAL: ${pass} passed, ${fail} failed`)
  if (errors.length) {
    console.log('\nBrowser errors captured:')
    for (const e of errors.slice(0, 10)) console.log('  ' + e)
  }

  await browser.close()
  process.exit(fail ? 1 : 0)
}

function innerHeightMinus100(h) {
  return h - 100
}

main().catch((e) => {
  console.error('SCRIPT ERROR:', e)
  process.exit(2)
})
// [AGC:END]
