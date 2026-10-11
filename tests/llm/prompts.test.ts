import { describe, it, expect, beforeEach } from 'vitest'
import { loadPromptFromMarkdown, getPromptArtifact, __clearPromptCache } from '@/lib/server/llm/prompts/loader'
import { getSessionTherapistPrompt } from '@/lib/server/llm/prompts/index'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

beforeEach(() => {
  __clearPromptCache()
})

describe('loadPromptFromMarkdown', () => {
  it('strips YAML frontmatter and returns non-empty body', () => {
    const body = loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md')
    expect(body).not.toMatch(/^---/)
    expect(body.length).toBeGreaterThan(0)
    expect(body).toContain('Serenia')
  })

  it('caches the result — second call returns referentially equal string', () => {
    const first = loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md')
    const second = loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md')
    expect(first).toBe(second)
  })

  it('returns a fresh value after clearing the cache', () => {
    const first = loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md')
    __clearPromptCache()
    const second = loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md')
    // Same content, but the cache was cleared so it re-read the file
    expect(first).toEqual(second)
  })

  it('rejects unsupported files before reading them, including a clinical draft', () => {
    for (const path of ['tests/llm/fixtures/sample-prompt.md', '../outside.md', 'docs/agents/prompts/clinical-report.draft-v2.md']) {
      expect(() => loadPromptFromMarkdown(path)).toThrow('Unsupported prompt path')
    }
  })

  it.each(['session-therapist', 'clinical-report'])('preserves the loaded %s clinical body', (name) => {
    const path = `docs/agents/prompts/${name}.md`
    const raw = readFileSync(path, 'utf8')
    const expected = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
    expect(createHash('sha256').update(loadPromptFromMarkdown(path)).digest('hex'))
      .toBe(createHash('sha256').update(expected).digest('hex'))
    expect(getPromptArtifact(path)).toMatchObject({ version: '1.1.0', path, sourceSha256: createHash('sha256').update(raw).digest('hex'), bodySha256: createHash('sha256').update(expected).digest('hex') })
    expect(Object.isFrozen(getPromptArtifact(path))).toBe(true)
  })
})

describe('getSessionTherapistPrompt', () => {
  it('returns a string containing "Serenia"', () => {
    const prompt = getSessionTherapistPrompt()
    expect(prompt).toContain('Serenia')
  })

  it('does not start with --- (frontmatter removed)', () => {
    const prompt = getSessionTherapistPrompt()
    expect(prompt).not.toMatch(/^---/)
  })

  it('returns a non-empty string', () => {
    const prompt = getSessionTherapistPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})
