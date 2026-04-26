import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { RejectionContext } from '@/lib/workflows/generate-assessment'

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
}

/**
 * Prepare a regenerable closure assessment for regeneration.
 *
 * Steps:
 *   1. Read the assessment by id.
 *   2. Validate that it exists and is in a regenerable status (`rejected`
 *      or `requires_manual_review`). Any other status is a programmer
 *      error — the UI only exposes "Regenerar" on those statuses — so we
 *      throw with a clear message instead of silently no-op'ing.
 *   3. Capture `rejection_reason` and `clinical_notes` for the workflow's
 *      `rejectionContext`. (Both may be empty/null on
 *      `requires_manual_review`; that's expected.)
 *   4. UPDATE the row to `status='superseded'` so the next
 *      `assessmentExistsStep` check (filtered by NOT IN
 *      ('superseded','rejected')) sees no live row and lets the regenerated
 *      draft persist. NB: a `requires_manual_review` row is "live" by that
 *      filter, so the flip-to-superseded is what unblocks the workflow.
 *
 * The caller is expected to then enqueue the workflow with the returned
 * `rejectionContext`. This split exists so the action layer can stay thin
 * and so tests can verify the BD side independently of the workflow side.
 *
 * **Atomicity caveat**: marking the row as `superseded` and enqueueing the
 * workflow is NOT a single transaction across BD + WDK. The worst-case
 * race is the workflow being enqueued twice for the same session (e.g. if
 * the clinician double-clicks the button before the first response). That
 * is covered by:
 *   - `assessmentExistsStep` filtering by live status, AND
 *   - the partial unique index `assessments_session_closure_live_unique`
 *     (migration 20260424000004) which makes the second insert fail with
 *     23505, which `persistAssessmentStep` traps as "duplicate ignored".
 *
 * Net effect: at most one new live draft per session, even under
 * concurrent regenerate requests.
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

  const { error: updateError } = await supabase
    .from('assessments')
    .update({ status: 'superseded' })
    .eq('id', assessmentId)

  if (updateError) {
    throw new Error(
      `No se pudo marcar el informe a regenerar como superseded: ${updateError.message}`,
    )
  }

  return {
    sessionId: row.session_id,
    rejectionContext: {
      rejectionReason: row.rejection_reason ?? '',
      clinicalNotes: row.clinical_notes,
    },
  }
}
