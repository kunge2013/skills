// [AGC:START] tool=Cc author=fangkun
import type { LinkedFileReference } from '../types/skill'

/**
 * Parse file references from markdown content.
 * Supports: markdown images, markdown links, and include syntax.
 * Only resolves relative paths (starting with ./ or ../).
 */
export function parseReferences(markdown: string, basePath: string): LinkedFileReference[] {
  const refs: LinkedFileReference[] = []
  const seen = new Set<string>()

  // Unified pattern for all relative paths (./path or ../path)
  const relPath = String.raw`\.(?:\.)?/[^)]+`

  // Markdown image: ![alt](./path) or ![alt](../path)
  const imageRegex = new RegExp(String.raw`!\[([^\]]*)\]\((${relPath})\)`, 'g')
  let match
  while ((match = imageRegex.exec(markdown)) !== null) {
    const relativePath = match[2]
    if (seen.has(relativePath)) continue
    seen.add(relativePath)
    refs.push({ type: 'image', altText: match[1], relativePath, resolvedPath: resolvePath(relativePath, basePath), originalLine: match[0] })
  }

  // Markdown link: [text](./path) or [text](../path) — exclude images
  const linkRegex = new RegExp(String.raw`(?<!!)\[([^\]]*)\]\((${relPath})\)`, 'g')
  while ((match = linkRegex.exec(markdown)) !== null) {
    const relativePath = match[2]
    if (seen.has(relativePath)) continue
    seen.add(relativePath)
    refs.push({ type: 'link', altText: match[1], relativePath, resolvedPath: resolvePath(relativePath, basePath), originalLine: match[0] })
  }

  // Include: {{include:./path}} or {{include:../path}}
  const includeRegex = /\{\{include:(\.(?:\.)?\/[^}]+)\}\}/g
  while ((match = includeRegex.exec(markdown)) !== null) {
    const relativePath = match[1]
    if (seen.has(relativePath)) continue
    seen.add(relativePath)
    refs.push({ type: 'include', relativePath, resolvedPath: resolvePath(relativePath, basePath), originalLine: match[0] })
  }

  return refs
}

/**
 * Resolve a relative path against a base path.
 * Browser-compatible replacement for path.resolve/path.dirname.
 */
function resolvePath(relativePath: string, basePath: string): string {
  // Determine the directory of the base path
  let dir = basePath
  // If basePath looks like a file (has extension), use its directory
  const lastSlash = basePath.lastIndexOf('/')
  const lastDot = basePath.lastIndexOf('.')
  if (lastDot > lastSlash) {
    dir = basePath.substring(0, lastSlash + 1)
  } else if (!basePath.endsWith('/')) {
    dir = basePath + '/'
  }

  // Normalize: split and resolve segments
  const parts = (dir + relativePath).split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      resolved.pop()
    } else {
      resolved.push(part)
    }
  }
  return '/' + resolved.join('/')
}
// [AGC:END]
