import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const cache = new Map<string, Readonly<PromptArtifact>>()

interface PromptArtifact {
  body: string
  path: string
  version: string
  sourceSha256: string
  bodySha256: string
}

// Literal read paths let Next trace exactly the supported clinical assets.
// Do not accept caller-selected paths, fixtures or unsigned draft prompts.
function readSupportedPrompt(path: string): string {
  switch (path) {
    case 'docs/agents/prompts/session-therapist.md':
      return readFileSync(join(process.cwd(), 'docs/agents/prompts/session-therapist.md'), 'utf-8')
    case 'docs/agents/prompts/clinical-report.md':
      return readFileSync(join(process.cwd(), 'docs/agents/prompts/clinical-report.md'), 'utf-8')
    case 'docs/agents/prompts/session-therapist.pilot.md':
      return readFileSync(join(process.cwd(), 'docs/agents/prompts/session-therapist.pilot.md'), 'utf-8')
    case 'docs/agents/prompts/clinical-report.pilot.md':
      return readFileSync(join(process.cwd(), 'docs/agents/prompts/clinical-report.pilot.md'), 'utf-8')
    default:
      throw new Error('Unsupported prompt path')
  }
}

export function getPromptArtifact(relativePath: string): Readonly<PromptArtifact> {
  if (cache.has(relativePath)) return cache.get(relativePath)!
  const raw = readSupportedPrompt(relativePath)
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
  if (!body) throw new Error(`Prompt body empty after frontmatter strip: ${relativePath}`)
  const version = raw.match(/^---\n[\s\S]*?\nversion: ([^\n]+)\n/)?.[1]
  if (!version) throw new Error(`Prompt version missing: ${relativePath}`)
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const artifact = Object.freeze({ body, path: relativePath, version, sourceSha256: hash(raw), bodySha256: hash(body) })
  cache.set(relativePath, artifact)
  return artifact
}

export function loadPromptFromMarkdown(relativePath: string): string {
  return getPromptArtifact(relativePath).body
}

// For tests only
export function __clearPromptCache(): void {
  cache.clear()
}
