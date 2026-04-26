import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  createAuthenticatedClientMock,
  revalidatePathMock,
  prepareRegenerationMock,
  rollbackRegenerationMock,
  enqueueAssessmentGenerationMock,
} = vi.hoisted(() => ({
  createAuthenticatedClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  prepareRegenerationMock: vi.fn(),
  rollbackRegenerationMock: vi.fn(),
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
  rollbackRegeneration: rollbackRegenerationMock,
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
  rollbackRegenerationMock.mockReset()
  enqueueAssessmentGenerationMock.mockReset()
})

describe('regenerateAssessmentAction', () => {
  it('happy path: prepares regeneration, enqueues workflow with rejectionContext, returns runId', async () => {
    const supabase = makeAuthSupabase('reviewer-1')
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    prepareRegenerationMock.mockResolvedValue({
      sessionId: 'session-7',
      originalStatus: 'rejected',
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
    // Happy path must not roll back
    expect(rollbackRegenerationMock).not.toHaveBeenCalled()
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
    // No rollback when prepare itself rejected — nothing to rollback
    expect(rollbackRegenerationMock).not.toHaveBeenCalled()
  })

  it('rolls back the row and returns a friendly error when the workflow enqueue fails', async () => {
    const supabase = makeAuthSupabase('reviewer-1')
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    prepareRegenerationMock.mockResolvedValue({
      sessionId: 'session-9',
      originalStatus: 'rejected',
      rejectionContext: {
        rejectionReason: 'motivo',
        clinicalNotes: null,
      },
    })
    enqueueAssessmentGenerationMock.mockRejectedValue(
      new Error('queue_unavailable'),
    )
    rollbackRegenerationMock.mockResolvedValue(undefined)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await regenerateAssessmentAction({ assessmentId: 'a-1' })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toMatch(
      /informe queda como estaba.*intenta de nuevo/i,
    )
    // Salvedad #2: the row must be restored to its original status so the
    // clinician can retry without an orphaned superseded row.
    expect(rollbackRegenerationMock).toHaveBeenCalledWith(
      supabase,
      'a-1',
      'rejected',
    )
    expect(revalidatePathMock).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('rolls back to requires_manual_review when that was the original status', async () => {
    const supabase = makeAuthSupabase('reviewer-1')
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    prepareRegenerationMock.mockResolvedValue({
      sessionId: 'session-mr-2',
      originalStatus: 'requires_manual_review',
      rejectionContext: {
        rejectionReason: '',
        clinicalNotes: null,
      },
    })
    enqueueAssessmentGenerationMock.mockRejectedValue(
      new Error('queue_unavailable'),
    )
    rollbackRegenerationMock.mockResolvedValue(undefined)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await regenerateAssessmentAction({ assessmentId: 'a-mr' })

    expect(result.ok).toBe(false)
    expect(rollbackRegenerationMock).toHaveBeenCalledWith(
      supabase,
      'a-mr',
      'requires_manual_review',
    )
    consoleSpy.mockRestore()
  })
})
