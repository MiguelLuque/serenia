import { describe, it, expect, vi, beforeEach } from 'vitest'

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
}))

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
}))

vi.mock('@/lib/llm/models', () => ({
  llm: { structured: () => 'openai/gpt-5.4' },
}))

vi.mock('@/lib/llm/prompts/loader', () => ({
  loadPromptFromMarkdown: () => 'SYSTEM PROMPT',
}))

import {
  generateAssessment,
  AssessmentSkippedError,
} from '@/lib/assessments/generator'

interface MockTable {
  rows?: unknown
  insertReturn?: unknown
}

function makeQueryChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'gt',
    'gte',
    'in',
    'order',
    'limit',
    'single',
    'maybeSingle',
  ]
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  ;(chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) =>
    Promise.resolve({ data: result.data, error: result.error ?? null }).then(
      resolve,
      reject,
    )
  return chain
}

function makeSupabase(tables: Record<string, MockTable>) {
  return {
    from: vi.fn((name: string) => {
      const table = tables[name] ?? {}
      if (name === 'assessments') {
        // Two shapes: select (existence check) returns maybeSingle null;
        // insert returns the new row from .select().single()
        let mode: 'read' | 'write' = 'read'
        const chain: Record<string, unknown> = {}
        const passthrough = () => chain
        chain.select = vi.fn(passthrough)
        chain.insert = vi.fn(() => {
          mode = 'write'
          return chain
        })
        chain.eq = vi.fn(passthrough)
        chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
        chain.single = vi.fn(() =>
          mode === 'write'
            ? Promise.resolve({ data: table.insertReturn, error: null })
            : Promise.resolve({ data: null, error: null }),
        )
        return chain
      }
      return makeQueryChain({ data: table.rows ?? null })
    }),
  }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    user_id: 'user-1',
    conversation_id: 'conv-1',
    opened_at: new Date().toISOString(),
    closed_at: new Date().toISOString(),
    closure_reason: 'user_request',
    ...overrides,
  }
}

function makeMessages(userCount: number) {
  return Array.from({ length: userCount * 2 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    parts: [{ type: 'text', text: `msg ${i}` }],
    created_at: new Date(Date.now() + i).toISOString(),
  }))
}

const summaryResult = {
  chief_complaint: 'Tristeza persistente',
  presenting_issues: ['ánimo bajo'],
  mood_affect: 'deprimido',
  cognitive_patterns: ['rumiación'],
  risk_assessment: { suicidality: 'none', self_harm: 'none', notes: '' },
  questionnaires: [],
  areas_for_exploration: ['antecedentes familiares'],
  preliminary_impression: 'Sintomatología consistente con ánimo bajo leve.',
  recommended_actions_for_clinician: ['seguimiento en 1 semana'],
  patient_facing_summary: 'Gracias por compartir esto hoy.',
}

beforeEach(() => {
  generateObjectMock.mockReset()
})

describe('generateAssessment', () => {
  it('skips with session_too_short when <3 user messages', async () => {
    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      messages: { rows: makeMessages(2) },
    })

    await expect(
      generateAssessment(
        supabase as unknown as Parameters<typeof generateAssessment>[0],
        'session-1',
      ),
    ).rejects.toBeInstanceOf(AssessmentSkippedError)
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('inserts a draft_ai closure assessment with the generated summary', async () => {
    generateObjectMock.mockResolvedValue({
      object: summaryResult,
      usage: { inputTokens: 100, outputTokens: 200 },
    })
    const inserted = {
      id: 'assessment-1',
      user_id: 'user-1',
      session_id: 'session-1',
      assessment_type: 'closure',
      status: 'draft_ai',
      summary_json: summaryResult,
    }
    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      messages: { rows: makeMessages(4) },
      questionnaire_instances: { rows: [] },
      risk_events: { rows: [] },
      assessments: { insertReturn: inserted },
    })

    const result = await generateAssessment(
      supabase as unknown as Parameters<typeof generateAssessment>[0],
      'session-1',
    )

    expect(generateObjectMock).toHaveBeenCalledOnce()
    expect(result.id).toBe('assessment-1')
    expect(result.status).toBe('draft_ai')
    expect(result.assessment_type).toBe('closure')
    expect(result.summary_json).toEqual(summaryResult)
  })

  it('throws no_session when session is missing', async () => {
    const supabase = makeSupabase({
      clinical_sessions: { rows: null },
    })

    await expect(
      generateAssessment(
        supabase as unknown as Parameters<typeof generateAssessment>[0],
        'session-1',
      ),
    ).rejects.toBeInstanceOf(AssessmentSkippedError)
  })
})
