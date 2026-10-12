import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createAuthenticatedClientMock, revalidatePathMock } = vi.hoisted(() => ({
  createAuthenticatedClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/server/supabase/server', () => ({
  createAuthenticatedClient: createAuthenticatedClientMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

import { saveAssessmentAction } from '@/app/app/clinica/sesion/[sessionId]/actions'

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
const input = { assessmentId: 'assessment-1', sessionId: 'session-1', userId: 'user-1', summary: validSummary }
beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: 'revision-2', error: null })
  createAuthenticatedClientMock.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'clinician-1' } } }) }, rpc })
})

describe('saveAssessmentAction atomic contract', () => {
  it('returns the committed revision and delegates task replacement with review', async () => {
    expect(await saveAssessmentAction({ ...input, clinical_notes: '  Nota clínica  ' })).toEqual({ ok: true, assessmentId: 'revision-2' })
    expect(rpc).toHaveBeenCalledWith('review_assessment_atomic', expect.objectContaining({ p_session_id: 'session-1', p_assessment_id: 'assessment-1', p_action: 'modify', p_notes: 'Nota clínica', p_summary: expect.objectContaining({ proposed_tasks: validSummary.proposed_tasks }), p_inherited_updates: [] }))
    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
  })
  it('returns transaction failures without reporting a partial save or revalidating', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Inherited task unavailable or foreign' } })
    expect(await saveAssessmentAction(input)).toEqual({ ok: false, error: 'Inherited task unavailable or foreign' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
  it('rejects an invalid summary before DB access', async () => {
    expect((await saveAssessmentAction({ ...input, summary: {} })).ok).toBe(false)
    expect(createAuthenticatedClientMock).not.toHaveBeenCalled()
  })
  it('rejects invalid inherited task updates before DB access', async () => {
    const result = await saveAssessmentAction({ ...input, inherited_task_updates: [{ id: 'invalid', estado: 'pendiente' }] })
    expect(result.ok).toBe(false)
    expect(createAuthenticatedClientMock).not.toHaveBeenCalled()
  })
  it('rejects unauthenticated callers', async () => {
    createAuthenticatedClientMock.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) }, rpc })
    expect(await saveAssessmentAction(input)).toEqual({ ok: false, error: 'No autenticado' })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('passes inherited updates and normalizes whitespace-only notes', async () => {
    const updates = [{ id: '00000000-0000-4000-8000-000000000001', estado: 'cumplida' as const, nota: 'Terminado' }]
    await saveAssessmentAction({ ...input, clinical_notes: ' ', inherited_task_updates: updates })
    expect(rpc).toHaveBeenCalledWith('review_assessment_atomic', expect.objectContaining({ p_notes: undefined, p_inherited_updates: updates }))
  })
})
