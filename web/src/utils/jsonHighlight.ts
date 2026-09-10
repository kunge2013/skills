// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// web/src/utils/jsonHighlight.ts

// [AGC:START] tool=Cc author=fangkun
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const isBracket = (ch: string): boolean => ch === '{' || ch === '}' || ch === '[' || ch === ']'

// Build a bidirectional map of matching bracket indices, ignoring brackets
// inside string literals (handles escaped quotes).
export function buildBracketMap(text: string): Map<number, number> {
  const map = new Map<number, number>()
  const stack: number[] = []
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{' || ch === '[') {
      stack.push(i)
    } else if (ch === '}' || ch === ']') {
      const open = stack.pop()
      if (open !== undefined) {
        map.set(open, i)
        map.set(i, open)
      }
    }
  }
  return map
}

// Render a slice of raw JSON with the two matched brackets (`pair`) marked and
// the enclosed region tinted. Char-by-char runs keep the spans sparse.
function renderGap(json: string, start: number, end: number, lo: number, hi: number): string {
  if (start >= end) return ''
  const highlight = lo >= 0 && hi >= 0
  let out = ''
  let buf = ''
  let bufCls = ''
  const flush = () => {
    if (!buf) return
    out += bufCls ? `<span class="${bufCls}">${escapeHtml(buf)}</span>` : escapeHtml(buf)
    buf = ''
    bufCls = ''
  }
  for (let i = start; i < end; i++) {
    let cls = ''
    if (highlight) {
      if (i === lo || i === hi) cls = 'tok-bracket'
      else if (i > lo && i < hi) cls = 'tok-bracket-region'
    }
    if (cls !== bufCls) { flush(); bufCls = cls }
    buf += json[i]
  }
  flush()
  return out
}

// Highlight JSON tokens for the viewer. Content is escaped before wrapping, so
// the injected spans never carry unescaped user/server data. When `pair` is
// given, the brackets and the region between them are highlighted too.
export function highlightJson(json: string, pair: [number, number] | null = null): string {
  const regex =
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  const lo = pair ? Math.min(pair[0], pair[1]) : -1
  const hi = pair ? Math.max(pair[0], pair[1]) : -1
  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(json)) !== null) {
    result += renderGap(json, lastIndex, match.index, lo, hi)
    let tokenHtml: string
    if (match[1]) {
      if (match[2]) {
        tokenHtml = `<span class="tok-key">${escapeHtml(match[1])}</span>${escapeHtml(match[2])}`
      } else {
        tokenHtml = `<span class="tok-string">${escapeHtml(match[1])}</span>`
      }
    } else {
      const token = match[0]
      const cls = /^(?:true|false|null)$/.test(token) ? 'tok-keyword' : 'tok-number'
      tokenHtml = `<span class="${cls}">${escapeHtml(token)}</span>`
    }
    const interior = lo >= 0 && hi >= 0 && match.index >= lo && regex.lastIndex <= hi
    result += interior ? `<span class="tok-bracket-region">${tokenHtml}</span>` : tokenHtml
    lastIndex = regex.lastIndex
  }
  result += renderGap(json, lastIndex, json.length, lo, hi)
  return result
}
// [AGC:END]
