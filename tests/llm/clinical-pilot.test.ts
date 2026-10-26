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

const reviewUser = '11111111-1111-4111-8111-111111111111'
const otherUser = '22222222-2222-4222-8222-222222222222'
it('allows a hosted review only for explicitly enrolled authenticated IDs on Vercel', () => {
  const env = { NODE_ENV: 'production', VERCEL: '1', FEATURE_CLINICAL_CONVERSATION_PILOT: 'on', CLINICAL_PILOT_REVIEW_USER_IDS: reviewUser }
  expect(clinicalPilotEnabled(env, reviewUser)).toBe(true)
  expect(clinicalPilotEnabled(env, otherUser)).toBe(false)
  expect(clinicalPilotEnabled(env)).toBe(false)
  expect(() => clinicalPilotEnabled({ ...env, VERCEL: '0' }, reviewUser)).toThrow('pilot')
})

it.each(['', '*', 'all', 'not-a-user-id', `${reviewUser},*`])('rejects an absent or invalid hosted review allowlist: %s', ids => {
  expect(() => clinicalPilotEnabled({ NODE_ENV: 'production', VERCEL: '1', FEATURE_CLINICAL_CONVERSATION_PILOT: 'on', CLINICAL_PILOT_REVIEW_USER_IDS: ids }, reviewUser)).toThrow('pilot')
})

it('selects conversation and report variants using the same verified owner identity', () => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('VERCEL', '1')
  vi.stubEnv('FEATURE_CLINICAL_CONVERSATION_PILOT', 'on'); vi.stubEnv('CLINICAL_PILOT_REVIEW_USER_IDS', reviewUser)
  expect(getSessionTherapistPrompt(reviewUser)).toBe(loadPromptFromMarkdown('docs/agents/prompts/session-therapist.pilot.md'))
  expect(getClinicalReportPrompt(reviewUser)).toBe(loadPromptFromMarkdown('docs/agents/prompts/clinical-report.pilot.md'))
  expect(getSessionTherapistPrompt(otherUser)).toBe(loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md'))
  expect(getClinicalReportPrompt(otherUser)).toBe(loadPromptFromMarkdown('docs/agents/prompts/clinical-report.md'))
})

it('keeps unpublished drafts and arbitrary paths outside the loader allowlist', () => {
  expect(() => loadPromptFromMarkdown('docs/agents/prompts/session-therapist.draft-v2.md')).toThrow('Unsupported prompt path')
  expect(() => loadPromptFromMarkdown('../private.md')).toThrow('Unsupported prompt path')
})
