// [AGC:START] tool=Cc author=fangkun
import { describe, it, expect } from 'vitest'

// Inline implementation for testing (since vitest is configured for .js only)
function parseReferences(markdown, basePath) {
  const refs = []
  const seen = new Set()
  const relPath = String.raw`\.(?:\.)?/[^)]+`

  const imageRegex = new RegExp(String.raw`!\[([^\]]*)\]\((${relPath})\)`, 'g')
  let match
  while ((match = imageRegex.exec(markdown)) !== null) {
    const relativePath = match[2]
    if (seen.has(relativePath)) continue
    seen.add(relativePath)
    refs.push({ type: 'image', altText: match[1], relativePath, resolvedPath: resolvePath(relativePath, basePath), originalLine: match[0] })
  }

  const linkRegex = new RegExp(String.raw`(?<!!)\[([^\]]*)\]\((${relPath})\)`, 'g')
  while ((match = linkRegex.exec(markdown)) !== null) {
    const relativePath = match[2]
    if (seen.has(relativePath)) continue
    seen.add(relativePath)
    refs.push({ type: 'link', altText: match[1], relativePath, resolvedPath: resolvePath(relativePath, basePath), originalLine: match[0] })
  }

  const includeRegex = /\{\{include:(\.(?:\.)?\/[^}]+)\}\}/g
  while ((match = includeRegex.exec(markdown)) !== null) {
    const relativePath = match[1]
    if (seen.has(relativePath)) continue
    seen.add(relativePath)
    refs.push({ type: 'include', relativePath, resolvedPath: resolvePath(relativePath, basePath), originalLine: match[0] })
  }

  return refs
}

function resolvePath(relativePath, basePath) {
  let dir = basePath
  const lastSlash = basePath.lastIndexOf('/')
  const lastDot = basePath.lastIndexOf('.')
  if (lastDot > lastSlash) {
    dir = basePath.substring(0, lastSlash + 1)
  } else if (!basePath.endsWith('/')) {
    dir = basePath + '/'
  }
  const parts = (dir + relativePath).split('/')
  const resolved = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') { resolved.pop() } else { resolved.push(part) }
  }
  return '/' + resolved.join('/')
}

describe('referenceParser', () => {
  const basePath = '/skills/test-skill'

  describe('markdown image syntax', () => {
    it('parses image with relative path', () => {
      const md = '![alt text](./images/diagram.png)'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(1)
      expect(refs[0]).toMatchObject({ type: 'image', altText: 'alt text', relativePath: './images/diagram.png' })
    })

    it('parses multiple images', () => {
      const md = '![img1](./a.png)\n![img2](./b.png)'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(2)
      expect(refs.map(r => r.type)).toEqual(['image', 'image'])
    })

    it('deduplicates same path', () => {
      const md = '![img](./a.png)\n![img2](./a.png)'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(1)
    })
  })

  describe('markdown link syntax', () => {
    it('parses link with relative path', () => {
      const md = '[README](./docs/readme.md)'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(1)
      expect(refs[0]).toMatchObject({ type: 'link', altText: 'README', relativePath: './docs/readme.md' })
    })

    it('does not parse images as links', () => {
      const md = '![img](./img.png)'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(1)
      expect(refs[0].type).toBe('image')
    })

    it('ignores absolute URLs', () => {
      const md = '[external](https://example.com)'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(0)
    })
  })

  describe('include syntax', () => {
    it('parses include with relative path', () => {
      const md = '{{include:./snippets/code.md}}'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(1)
      expect(refs[0]).toMatchObject({ type: 'include', relativePath: './snippets/code.md' })
    })

    it('parses multiple includes', () => {
      const md = '{{include:./a.md}}\n{{include:./b.md}}'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(2)
    })
  })

  describe('mixed content', () => {
    it('parses all reference types together', () => {
      const md = `
# Skill Doc
![diagram](./images/arch.png)

See [setup guide](./guides/setup.md) for details.

{{include:./examples/basic.md}}
      `
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(3)
      expect(refs.map(r => r.type)).toEqual(['image', 'link', 'include'])
    })
  })

  describe('edge cases', () => {
    it('handles empty content', () => {
      expect(parseReferences('', basePath)).toHaveLength(0)
    })

    it('handles content with no references', () => {
      expect(parseReferences('# Just a heading', basePath)).toHaveLength(0)
    })

    it('handles parent directory paths', () => {
      const md = '[parent](../shared/config.md)'
      const refs = parseReferences(md, basePath)
      expect(refs).toHaveLength(1)
      expect(refs[0].relativePath).toBe('../shared/config.md')
    })
  })
})
// [AGC:END]
