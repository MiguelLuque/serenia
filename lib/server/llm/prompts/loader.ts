import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const cache = new Map<string, string>()

export function loadPromptFromMarkdown(relativePath: string): string {
  if (cache.has(relativePath)) return cache.get(relativePath)!
  const abs = join(process.cwd(), relativePath)
  const raw = readFileSync(abs, 'utf-8')
  // Strip YAML frontmatter if present (between two lines of ---)
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
  if (!body) throw new Error(`Prompt body empty after frontmatter strip: ${relativePath}`)
  cache.set(relativePath, body)
  return body
}

// For tests only
export function __clearPromptCache(): void {
  cache.clear()
}
