import { chromium } from 'playwright'

const RESPONSE = JSON.stringify(
  {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1677652288,
    model: 'gpt-3.5-turbo',
    choices: [
      { index: 0, message: { role: 'assistant', content: 'Hello world' }, finish_reason: 'stop' },
      { index: 1, message: { role: 'assistant', content: 'Hello again' }, finish_reason: 'stop' },
    ],
    usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
  },
  null,
  2
)

const results = []
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' | ' + extra : ''}`)
  console.log(results[results.length - 1])
}

const browser = await chromium.launch({ channel: 'chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { try { check('no page errors', false, String(e).slice(0, 200)) } catch {} })

await page.goto('http://localhost:3010/', { waitUntil: 'networkidle' })

const menuItem = page.locator('.el-menu-item', { hasText: 'API' }).first()
await menuItem.waitFor({ state: 'visible', timeout: 15000 })
await menuItem.click()
await page.waitForTimeout(500)

const ta = page.locator('.editor-input')
await ta.waitFor({ state: 'visible', timeout: 10000 })

// dump initial payload + input overlay html
const initState = await page.evaluate(() => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.globalProperties.$pinia
  const store = pinia._s.get('prompt')
  const el = document.querySelector('.editor-input')
  return {
    payloadLen: el?.value?.length,
    payloadStart: el?.value?.slice(0, 30),
    preHtmlLen: document.querySelector('.json-editor .editor-highlight')?.innerHTML?.length,
    preHtmlStart: document.querySelector('.json-editor .editor-highlight')?.innerHTML?.slice(0, 120),
  }
})
console.log('INIT STATE:', JSON.stringify(initState, null, 2))

const geo = await page.evaluate(() => {
  const pre = document.querySelector('.json-editor .editor-highlight')
  const input = document.querySelector('.json-editor .editor-input')
  const container = document.querySelector('.json-editor')
  const rp = pre.getBoundingClientRect()
  const ri = input.getBoundingClientRect()
  return {
    same: Math.abs(rp.left - ri.left) < 1 && Math.abs(rp.top - ri.top) < 1 && Math.abs(rp.width - ri.width) < 1 && Math.abs(rp.height - ri.height) < 1,
    inputColor: getComputedStyle(input).color,
    containerBg: getComputedStyle(container).backgroundColor,
  }
})
check('overlay pre + textarea aligned', geo.same)
check('input text transparent', geo.inputColor === 'rgba(0, 0, 0, 0)', geo.inputColor)
check('editor container dark bg', geo.containerBg === 'rgb(30, 30, 30)', geo.containerBg)

const inputKeySpans = await page.locator('.json-editor .editor-highlight .tok-key').count()
check('input has syntax highlighted keys', inputKeySpans > 0, `keys=${inputKeySpans}`)

// --- INPUT bracket match: caret after index 0 ('{') ---
await ta.focus()
await page.evaluate(() => {
  const el = document.querySelector('.editor-input')
  el.setSelectionRange(1, 1)
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
})
await page.waitForTimeout(300)
const inAfter = await page.evaluate(() => ({
  brackets: document.querySelectorAll('.json-editor .editor-highlight .tok-bracket').length,
  region: document.querySelectorAll('.json-editor .editor-highlight .tok-bracket-region').length,
  selStart: document.querySelector('.editor-input').selectionStart,
}))
check('input highlights 2 matching brackets', inAfter.brackets === 2, JSON.stringify(inAfter))
check('input tints enclosed region', inAfter.region > 0, `regionSpans=${inAfter.region}`)

// --- INPUT clear: caret at index 0 (before '{', so selectionStart 0 -> checks index 0 which IS '{'... use a middle char instead)
await page.evaluate(() => {
  const el = document.querySelector('.editor-input')
  const mid = Math.floor(el.value.length / 2)
  el.setSelectionRange(mid, mid)
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
})
await page.waitForTimeout(300)
const inCleared = await page.evaluate(() => document.querySelectorAll('.json-editor .editor-highlight .tok-bracket').length)
check('input highlight clears on non-bracket caret', inCleared === 0, `brackets=${inCleared}`)

// --- OUTPUT: inject response ---
await page.evaluate((resp) => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.globalProperties.$pinia
  const store = pinia._s.get('prompt')
  store.apiTesterResponse = resp
}, RESPONSE)
await page.waitForTimeout(300)
const outKeys = await page.locator('.response-display .tok-key').count()
check('output renders syntax highlighted JSON', outKeys > 0, `keys=${outKeys}`)

// --- OUTPUT bracket match via real click ---
const clickPt = await page.evaluate(() => {
  const pre = document.querySelector('.response-display pre')
  const text = pre.textContent
  const needle = '  "choices": [\n    {'
  const pos = text.indexOf(needle)
  const bracketPos = pos + needle.length - 1
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT)
  let offset = bracketPos
  let node = walker.nextNode()
  while (node) {
    const len = node.length
    if (offset <= len) break
    offset -= len
    node = walker.nextNode()
  }
  const range = document.createRange()
  range.setStart(node, offset)
  range.setEnd(node, offset + 1)
  const rect = range.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, bracketPos }
})
console.log('CLICK PT:', JSON.stringify(clickPt))
await page.mouse.click(clickPt.x, clickPt.y)
await page.waitForTimeout(300)
const outAfter = await page.evaluate(() => ({
  brackets: document.querySelectorAll('.response-display .tok-bracket').length,
  region: document.querySelectorAll('.response-display .tok-bracket-region').length,
}))
check('output highlights 2 matching brackets on click', outAfter.brackets === 2, JSON.stringify(outAfter))
check('output tints enclosed region', outAfter.region > 0, `regionSpans=${outAfter.region}`)

// --- Overflow: inject a genuinely LARGE response and verify bounded layout ---
const BIG = JSON.stringify({
  id: 'big',
  items: Array.from({ length: 400 }, (_, i) => ({ index: i, name: 'item-' + i, tags: ['a', 'b', 'c'], nested: { value: i * 100, ok: true, nothing: null } })),
}, null, 2)
await page.evaluate((resp) => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.globalProperties.$pinia
  const store = pinia._s.get('prompt')
  store.apiTesterResponse = resp
}, BIG)
await page.waitForTimeout(300)
const bigCheck = await page.evaluate(() => {
  const d = document.querySelector('.response-display')
  const btn = document.querySelector('.send-bar .el-button')
  const br = btn.getBoundingClientRect()
  return {
    responseScrollable: d.scrollHeight > d.clientHeight,
    responseClientH: d.clientHeight,
    sendVisible: br.bottom <= window.innerHeight && br.top >= 0,
    pageScrollH: document.documentElement.scrollHeight,
    viewportH: window.innerHeight,
  }
})
check('large response: response panel scrolls internally', bigCheck.responseScrollable, `clientH=${bigCheck.responseClientH}`)
check('large response: send button visible', bigCheck.sendVisible)
check('large response: page not growing', bigCheck.pageScrollH <= bigCheck.viewportH + 2, `pageH=${bigCheck.pageScrollH} vsH=${bigCheck.viewportH}`)

// --- large payload in INPUT textarea: scrolls internally, send button visible ---
const BIG_PAYLOAD = JSON.stringify({ data: Array.from({ length: 300 }, (_, i) => ({ key: 'k' + i, value: 'v' + i })) }, null, 2)
await page.evaluate((p) => {
  const app = document.querySelector('#app').__vue_app__
  const pinia = app.config.globalProperties.$pinia
  const store = pinia._s.get('prompt')
  const el = document.querySelector('.editor-input')
  // set payload through the v-model by dispatching input
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(el, p)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}, BIG_PAYLOAD)
await page.waitForTimeout(300)
const inputBig = await page.evaluate(() => {
  const el = document.querySelector('.editor-input')
  const btn = document.querySelector('.send-bar .el-button')
  const br = btn.getBoundingClientRect()
  return {
    textareaScrollable: el.scrollHeight > el.clientHeight,
    sendVisible: br.bottom <= window.innerHeight && br.top >= 0,
  }
})
check('large payload: input textarea scrolls internally', inputBig.textareaScrollable)
check('large payload: send button visible', inputBig.sendVisible)

await page.screenshot({ path: 'docs/api-tester-brackets.png', fullPage: false })
await browser.close()
console.log('\n=== SUMMARY ===')
console.log(results.join('\n'))
