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
  /**
   * Original status of the row before it was marked `superseded`. Returned
   * so the action layer can roll back the row to its previous state if
   * `enqueueAssessmentGeneration` fails after this prepare succeeded.
   */
  originalStatus: AssessmentStatus
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
 *   4. UPDATE the row to `status='superseded'` **conditional on the
 *      original status**. This makes the operation idempotent under race:
 *      if two clinicians click "Regenerar" simultaneously, the second
 *      UPDATE returns zero rows, we throw, and the second enqueue never
 *      happens. Without the `.in('status', …)` guard the row would flip
 *      twice and two LLM calls would burn tokens for the same session.
 *
 * The caller is expected to then enqueue the workflow with the returned
 * `rejectionContext`. The split exists so the action layer can stay thin,
 * tests can verify the BD side independently, and so the action can roll
 * back the status flip when the enqueue fails (using `originalStatus`).
 *
 * **Atomicity caveat**: marking the row as `superseded` and enqueueing the
 * workflow is NOT a single transaction across BD + WDK. The action layer
 * compensates by rolling back the status if the enqueue throws. The
 * worst-case remaining race is the workflow being enqueued twice for the
 * same session (e.g. cron + manual). That is covered by:
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

  const originalStatus = row.status

  // Conditional UPDATE — only flips the row when its status is still the
  // one we observed during the read. If a concurrent regenerate already
  // moved the row to `superseded`, `data` comes back empty and we abort
  // without enqueueing a second workflow. `.select('id')` forces the rows
  // to round-trip so we can branch on the result length.
  const { data: updated, error: updateError } = await supabase
    .from('assessments')
    .update({ status: 'superseded' })
    .eq('id', assessmentId)
    .in('status', REGENERABLE_STATUSES)
    .select('id')

  if (updateError) {
    throw new Error(
      `No se pudo marcar el informe a regenerar como superseded: ${updateError.message}`,
    )
  }

  if (!updated || updated.length === 0) {
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

/**
 * Roll back a `superseded` flip when the workflow enqueue fails afterwards.
 * Restores the original status (`rejected` or `requires_manual_review`) so
 * the clinician can retry without the row being orphaned. Conditional on
 * the row currently being `superseded` — if some other process already
 * touched it (extremely unlikely in practice), we don't clobber the new
 * state.
 *
 * Best-effort: if the rollback itself errors, we log and surface the
 * original enqueue failure to the user. The orphan-row case is rare enough
 * that operationally we'd rather not suppress the actionable error.
 */
export async function rollbackRegeneration(
  supabase: Supabase,
  assessmentId: string,
  originalStatus: AssessmentStatus,
): Promise<void> {
  const { error } = await supabase
    .from('assessments')
    .update({ status: originalStatus })
    .eq('id', assessmentId)
    .eq('status', 'superseded')

  if (error) {
    console.error('[regenerate-rollback] failed', {
      assessmentId,
      originalStatus,
      error: error.message,
    })
  }
}
