import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import type { RejectionContext } from '@/lib/server/workflows/generate-assessment'

type Supabase = SupabaseClient<Database>
type AssessmentStatus = Database['public']['Enums']['assessment_status']

/**
 * Statuses from which an assessment can be regenerated:
 *   - `rejected`: clinician explicitly rejected the AI draft.
 *   - `requires_manual_review`: workflow exhausted retries and persisted
 *     a placeholder row (T6). The clinician needs an explicit retry path.
 */
const REGENERABLE_STATUSES: readonly AssessmentStatus[] = [
  'rejected',
  'requires_manual_review',
]

export type PrepareRegenerationResult = {
  sessionId: string
  rejectionContext: RejectionContext
  /**
   * Original status of the row before it was marked `superseded`. Returned
   * so the action layer can roll back the row to its previous state if
   * `enqueueAssessmentGeneration` fails after this prepare succeeded.
   */
  originalStatus: AssessmentStatus
}

/**
 * Capture regeneration context, then claim the expected version through an
 * authenticated clinician RPC. SQL locks the session and assessment together;
 * a lost race returns false and must not enqueue a second workflow.
 * Enqueue remains an external operation; the action requests compensation on
 * failure. Persistent recovery of a process crash is a separate outbox gate.
 */
export async function prepareRegeneration(
  supabase: Supabase,
  assessmentId: string,
): Promise<PrepareRegenerationResult> {
  const { data: row, error: fetchError } = await supabase
    .from('assessments')
    .select('id, session_id, status, rejection_reason, clinical_notes')
    .eq('id', assessmentId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(
      `No se pudo leer el informe a regenerar: ${fetchError.message}`,
    )
  }

  if (!row) {
    throw new Error('El informe a regenerar no existe.')
  }

  if (!REGENERABLE_STATUSES.includes(row.status)) {
    throw new Error(
      `Solo se puede regenerar un informe con estado 'rejected' o 'requires_manual_review' (actual: '${row.status}').`,
    )
  }

  if (!row.session_id) {
    // Defensive: closure assessments always have session_id, but the column
    // is nullable in the schema (assessments_session_id_fkey ON DELETE SET
    // NULL) so we guard against the orphaned case explicitly.
    throw new Error(
      'El informe a regenerar no está vinculado a una sesión; no se puede regenerar.',
    )
  }

  const originalStatus = row.status

  const { data: updated, error: updateError } = await supabase.rpc('regenerate_assessment_atomic', {
    p_assessment_id: assessmentId,
    p_expected_status: originalStatus,
  })

  if (updateError) {
    throw new Error(
      `No se pudo marcar el informe a regenerar como superseded: ${updateError.message}`,
    )
  }

  if (!updated) {
    throw new Error('El informe ya fue actualizado. Recarga la página.')
  }

  return {
    sessionId: row.session_id,
    originalStatus,
    rejectionContext: {
      rejectionReason: row.rejection_reason ?? '',
      clinicalNotes: row.clinical_notes,
    },
  }
}

/** Restore only the captured status, provided no replacement has appeared. */
export async function rollbackRegeneration(
  supabase: Supabase,
  assessmentId: string,
  originalStatus: AssessmentStatus,
): Promise<void> {
  const { error } = await supabase.rpc('regenerate_assessment_atomic', {
    p_assessment_id: assessmentId,
    p_expected_status: originalStatus,
    p_restore: true,
  })

  if (error) {
    console.error('[regenerate-rollback] failed', {
      assessmentId,
      originalStatus,
      error: error.message,
    })
  }
}
