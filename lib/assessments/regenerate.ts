import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { RejectionContext } from '@/lib/workflows/generate-assessment'

type Supabase = SupabaseClient<Database>

export type PrepareRegenerationResult = {
  sessionId: string
  rejectionContext: RejectionContext
}

/**
 * Prepare a rejected closure assessment for regeneration.
 *
 * Steps:
 *   1. Read the assessment by id.
 *   2. Validate that it exists and `status='rejected'`. Any other status is
 *      a programmer error — the UI only exposes "Regenerar" on rejected
 *      drafts — so we throw with a clear message instead of silently
 *      no-op'ing.
 *   3. Capture `rejection_reason` and `clinical_notes` for the workflow's
 *      `rejectionContext`.
 *   4. UPDATE the rejected row to `status='superseded'` so the next
 *      `assessmentExistsStep` check (filtered by NOT IN
 *      ('superseded','rejected')) sees no live row and lets the regenerated
 *      draft persist.
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

  if (row.status !== 'rejected') {
    throw new Error(
      `Solo se pueden regenerar informes con estado 'rejected' (actual: '${row.status}').`,
    )
  }

  if (!row.session_id) {
    // Defensive: closure assessments always have session_id, but the column
    // is nullable in the schema (assessments_session_id_fkey ON DELETE SET
    // NULL) so we guard against the orphaned case explicitly.
    throw new Error(
      'El informe rechazado no está vinculado a una sesión; no se puede regenerar.',
    )
  }

  const { error: updateError } = await supabase
    .from('assessments')
    .update({ status: 'superseded' })
    .eq('id', assessmentId)

  if (updateError) {
    throw new Error(
      `No se pudo marcar el informe rechazado como superseded: ${updateError.message}`,
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
