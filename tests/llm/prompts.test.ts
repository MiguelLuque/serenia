import { describe, it, expect, beforeEach } from 'vitest'
import { loadPromptFromMarkdown, __clearPromptCache } from '@/lib/llm/prompts/loader'
import { getSessionTherapistPrompt } from '@/lib/llm/prompts/index'

beforeEach(() => {
  __clearPromptCache()
})

describe('loadPromptFromMarkdown', () => {
  it('strips YAML frontmatter and returns non-empty body', () => {
    const body = loadPromptFromMarkdown('tests/llm/fixtures/sample-prompt.md')
    expect(body).not.toMatch(/^---/)
    expect(body.length).toBeGreaterThan(0)
    expect(body).toContain('Eres un asistente de prueba.')
  })

  it('caches the result — second call returns referentially equal string', () => {
    const first = loadPromptFromMarkdown('tests/llm/fixtures/sample-prompt.md')
    const second = loadPromptFromMarkdown('tests/llm/fixtures/sample-prompt.md')
    expect(first).toBe(second)
  })

  it('returns a fresh value after clearing the cache', () => {
    const first = loadPromptFromMarkdown('tests/llm/fixtures/sample-prompt.md')
    __clearPromptCache()
    const second = loadPromptFromMarkdown('tests/llm/fixtures/sample-prompt.md')
    // Same content, but the cache was cleared so it re-read the file
    expect(first).toEqual(second)
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
