import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  createAuthenticatedClientMock,
  revalidatePathMock,
  prepareRegenerationMock,
  enqueueAssessmentGenerationMock,
} = vi.hoisted(() => ({
  createAuthenticatedClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  prepareRegenerationMock: vi.fn(),
  enqueueAssessmentGenerationMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAuthenticatedClient: createAuthenticatedClientMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock('@/lib/assessments/regenerate', () => ({
  prepareRegeneration: prepareRegenerationMock,
}))

vi.mock('@/lib/workflows', () => ({
  enqueueAssessmentGeneration: enqueueAssessmentGenerationMock,
}))

import { regenerateAssessmentAction } from '@/app/app/clinica/sesion/[sessionId]/actions'

function makeAuthSupabase(reviewerId: string | null) {
  return {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: reviewerId ? { user: { id: reviewerId } } : { user: null },
          error: null,
        }),
      ),
    },
    from: vi.fn(),
  }
}

beforeEach(() => {
  createAuthenticatedClientMock.mockReset()
  revalidatePathMock.mockReset()
  prepareRegenerationMock.mockReset()
  enqueueAssessmentGenerationMock.mockReset()
})

describe('regenerateAssessmentAction', () => {
  it('happy path: prepares regeneration, enqueues workflow with rejectionContext, returns runId', async () => {
    const supabase = makeAuthSupabase('reviewer-1')
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    prepareRegenerationMock.mockResolvedValue({
      sessionId: 'session-7',
      rejectionContext: {
        rejectionReason: 'No refleja la transcripción.',
        clinicalNotes: 'Profundizar en duelo reciente.',
      },
    })
    enqueueAssessmentGenerationMock.mockResolvedValue({ runId: 'run-abc' })

    const result = await regenerateAssessmentAction({
      assessmentId: 'a-1',
    })

    expect(result).toEqual({ ok: true, runId: 'run-abc' })

    expect(prepareRegenerationMock).toHaveBeenCalledWith(supabase, 'a-1')
    expect(enqueueAssessmentGenerationMock).toHaveBeenCalledWith({
      sessionId: 'session-7',
      rejectionContext: {
        rejectionReason: 'No refleja la transcripción.',
        clinicalNotes: 'Profundizar en duelo reciente.',
      },
    })

    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
    expect(revalidatePathMock).toHaveBeenCalledWith(
      '/app/clinica/sesion/session-7',
    )
  })

  it('returns {ok:false,"No autenticado"} when the user is not authenticated', async () => {
    const supabase = makeAuthSupabase(null)
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await regenerateAssessmentAction({ assessmentId: 'a-1' })

    expect(result).toEqual({ ok: false, error: 'No autenticado' })
    expect(prepareRegenerationMock).not.toHaveBeenCalled()
    expect(enqueueAssessmentGenerationMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('returns {ok:false} surfacing prepareRegeneration error and does not enqueue', async () => {
    const supabase = makeAuthSupabase('reviewer-1')
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    prepareRegenerationMock.mockRejectedValue(
      new Error(
        "Solo se puede regenerar un informe con estado 'rejected' o 'requires_manual_review' (actual: 'draft_ai').",
      ),
    )

    const result = await regenerateAssessmentAction({ assessmentId: 'a-1' })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toMatch(/rejected.*requires_manual_review/)
    expect(enqueueAssessmentGenerationMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('returns {ok:false} when the workflow enqueue fails (rare; row is now superseded)', async () => {
    const supabase = makeAuthSupabase('reviewer-1')
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    prepareRegenerationMock.mockResolvedValue({
      sessionId: 'session-9',
      rejectionContext: {
        rejectionReason: 'motivo',
        clinicalNotes: null,
      },
    })
    enqueueAssessmentGenerationMock.mockRejectedValue(
      new Error('queue_unavailable'),
    )

    const result = await regenerateAssessmentAction({ assessmentId: 'a-1' })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toMatch(/queue_unavailable/)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
