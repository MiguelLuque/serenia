import { afterEach, expect, it, vi } from 'vitest'
import { clinicalPilotEnabled } from '@/lib/server/llm/clinical-pilot'
import { getClinicalReportPrompt, getSessionTherapistPrompt } from '@/lib/server/llm/prompts'
import { loadPromptFromMarkdown } from '@/lib/server/llm/prompts/loader'

afterEach(() => vi.unstubAllEnvs())

it('leaves the reference version selected unless the exact server flag is on', () => {
  expect(clinicalPilotEnabled({ NODE_ENV: 'test' })).toBe(false)
  expect(clinicalPilotEnabled({ NODE_ENV: 'test', FEATURE_CLINICAL_CONVERSATION_PILOT: 'true' })).toBe(false)
  vi.stubEnv('FEATURE_CLINICAL_CONVERSATION_PILOT', 'off')
  expect(getSessionTherapistPrompt()).toBe(loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md'))
  expect(getClinicalReportPrompt()).toBe(loadPromptFromMarkdown('docs/agents/prompts/clinical-report.md'))
})

it('selects both literal pilot assets for a supervised non-production test', () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('FEATURE_CLINICAL_CONVERSATION_PILOT', 'on')
  expect(clinicalPilotEnabled()).toBe(true)
  expect(getSessionTherapistPrompt()).toBe(loadPromptFromMarkdown('docs/agents/prompts/session-therapist.pilot.md'))
  expect(getClinicalReportPrompt()).toBe(loadPromptFromMarkdown('docs/agents/prompts/clinical-report.pilot.md'))
})

it('rejects enabling this unapproved clinical variant in production', () => {
  expect(() => clinicalPilotEnabled({ NODE_ENV: 'production', FEATURE_CLINICAL_CONVERSATION_PILOT: 'on' })).toThrow('pilot')
  expect(clinicalPilotEnabled({ NODE_ENV: 'production', FEATURE_CLINICAL_CONVERSATION_PILOT: 'off' })).toBe(false)
})

it('keeps unpublished drafts and arbitrary paths outside the loader allowlist', () => {
  expect(() => loadPromptFromMarkdown('docs/agents/prompts/session-therapist.draft-v2.md')).toThrow('Unsupported prompt path')
  expect(() => loadPromptFromMarkdown('../private.md')).toThrow('Unsupported prompt path')
})
