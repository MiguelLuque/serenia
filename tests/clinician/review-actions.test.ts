import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createAuthenticatedClientMock, revalidatePathMock } = vi.hoisted(
  () => ({
    createAuthenticatedClientMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
)

vi.mock('@/lib/server/supabase/server', () => ({
  createAuthenticatedClient: createAuthenticatedClientMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

import {
  markReviewedAction,
  rejectAssessmentAction,
} from '@/app/app/clinica/sesion/[sessionId]/actions'

// ── Shared summary fixture ─────────────────────────────────────────────────

const validSummary = {
  chief_complaint: 'Tristeza persistente',
  presenting_issues: ['ánimo bajo'],
  mood_affect: 'deprimido',
  cognitive_patterns: ['rumiación'],
  risk_assessment: {
    suicidality: 'none' as const,
    self_harm: 'none' as const,
    notes: '',
  },
  questionnaires: [],
  areas_for_exploration: ['antecedentes'],
  preliminary_impression: 'Sintomatología consistente con ánimo bajo leve.',
  recommended_actions_for_clinician: ['seguimiento en 1 semana'],
  patient_facing_summary: 'Gracias por compartir esto hoy.',
  proposed_tasks: [
    { descripcion: 'Practicar respiración diafragmática', nota: 'Al menos 5 minutos al día' },
    { descripcion: 'Registro de pensamientos automáticos', nota: null },
  ],
}


const rpc = vi.fn()
let summary: unknown
beforeEach(() => {
  vi.clearAllMocks()
  summary = validSummary
  rpc.mockResolvedValue({ data: 'assessment-1', error: null })
  const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: { user_id: 'patient-1', summary_json: summary }, error: null }) }
  createAuthenticatedClientMock.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'clinician-1' } } }) }, from: () => chain, rpc })
})
const input = { assessmentId: 'assessment-1', sessionId: 'session-1' }
describe('review actions atomic contract', () => {
  it('confirms the expected session and assessment in one transaction', async () => {
    expect(await markReviewedAction(input)).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('review_assessment_atomic', { p_session_id: 'session-1', p_assessment_id: 'assessment-1', p_action: 'confirm' })
    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
  })
  it('rejects with a trimmed reason in one transaction', async () => {
    expect(await rejectAssessmentAction({ ...input, reason: '  Revisar el riesgo  ' })).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('review_assessment_atomic', { p_session_id: 'session-1', p_assessment_id: 'assessment-1', p_action: 'reject', p_reason: 'Revisar el riesgo' })
  })
  it('rejects a malformed persisted summary before confirmation', async () => {
    summary = {}
    expect((await markReviewedAction(input)).ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects blank reasons without DB access', async () => {
    expect(await rejectAssessmentAction({ ...input, reason: '  ' })).toEqual({ ok: false, error: 'Motivo requerido' })
    expect(createAuthenticatedClientMock).not.toHaveBeenCalled()
  })
  it.each(['confirm', 'reject'])('surfaces %s transaction failure without revalidation', async action => {
    rpc.mockResolvedValue({ error: { message: 'Assessment already changed; reload' } })
    const result = action === 'confirm' ? await markReviewedAction(input) : await rejectAssessmentAction({ ...input, reason: 'Revisar' })
    expect(result).toEqual({ ok: false, error: 'Assessment already changed; reload' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
  it.each(['confirm', 'reject'])('requires authentication for %s', async action => {
    createAuthenticatedClientMock.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) }, rpc })
    const result = action === 'confirm' ? await markReviewedAction(input) : await rejectAssessmentAction({ ...input, reason: 'Revisar' })
    expect(result).toEqual({ ok: false, error: 'No autenticado' })
    expect(rpc).not.toHaveBeenCalled()
  })
})
