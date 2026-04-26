'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { AssessmentSchema } from '@/lib/assessments/generator'
import {
  prepareRegeneration,
  rollbackRegeneration,
} from '@/lib/assessments/regenerate'
import { enqueueAssessmentGeneration } from '@/lib/workflows'
import type { Json } from '@/lib/supabase/types'

const InheritedTaskUpdateSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(['pendiente', 'cumplida', 'parcial', 'no_realizada', 'no_abordada']),
  nota: z.string().max(300).optional(),
})
const InheritedUpdatesSchema = z.array(InheritedTaskUpdateSchema)

type SaveAssessmentInput = {
  assessmentId: string
  sessionId: string
  userId: string
  summary: unknown
  /**
   * Free-text clinician notes attached to the new revision. Persisted in
   * `assessments.clinical_notes` (T-B). Independent from `rejection_reason`
   * — these are notes the clinician adds while reviewing/editing, NOT a
   * rejection justification. May be null/empty to clear or skip.
   */
  clinical_notes?: string | null
  inherited_task_updates?: Array<{
    id: string
    estado: 'pendiente' | 'cumplida' | 'parcial' | 'no_realizada' | 'no_abordada'
    nota?: string
  }>
}

type SaveAssessmentResult =
  | { ok: true; assessmentId: string }
  | { ok: false; error: string }

/**
 * Persist a clinician-edited assessment. Creates a new `reviewed_modified`
 * row that supersedes the previous one and marks the previous row as
 * `superseded`. Zod-validates the summary payload with the same schema the
 * AI generator uses. Returns a discriminated result instead of throwing so
 * the client form can surface errors inline.
 */
export async function saveAssessmentAction(
  input: SaveAssessmentInput,
): Promise<SaveAssessmentResult> {
  const parsed = AssessmentSchema.safeParse(input.summary)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const path = first?.path.join('.') ?? ''
    const message = first?.message ?? 'Payload inválido'
    return {
      ok: false,
      error: path ? `${path}: ${message}` : message,
    }
  }

  const parsedUpdates = InheritedUpdatesSchema.safeParse(
    input.inherited_task_updates ?? [],
  )
  if (!parsedUpdates.success) {
    const first = parsedUpdates.error.issues[0]
    const path = first?.path.join('.') ?? ''
    const message = first?.message ?? 'Actualizaciones de tareas inválidas'
    return {
      ok: false,
      error: path ? `inherited_task_updates.${path}: ${message}` : message,
    }
  }

  const supabase = await createAuthenticatedClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { ok: false, error: 'No autenticado' }
  }
  const reviewerId = userData.user.id

  const now = new Date().toISOString()

  // Normalize clinical_notes: trim, collapse empty → null. We store null
  // for "no note" rather than empty string so the agent's context-injection
  // tier (Plan 7 T-1) can do simple truthy checks.
  const trimmedNotes =
    typeof input.clinical_notes === 'string' ? input.clinical_notes.trim() : ''
  const clinicalNotes = trimmedNotes.length > 0 ? trimmedNotes : null

  const { data: inserted, error: insertError } = await supabase
    .from('assessments')
    .insert({
      user_id: input.userId,
      session_id: input.sessionId,
      assessment_type: 'closure',
      status: 'reviewed_modified',
      generated_by: 'clinician',
      summary_json: parsed.data as unknown as Json,
      supersedes_assessment_id: input.assessmentId,
      reviewed_by: reviewerId,
      reviewed_at: now,
      clinical_notes: clinicalNotes,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? 'No se pudo crear el informe',
    }
  }

  const { error: updateError } = await supabase
    .from('assessments')
    .update({ status: 'superseded' })
    .eq('id', input.assessmentId)

  if (updateError) {
    return {
      ok: false,
      error: `Informe guardado pero no se pudo marcar el anterior como superseded: ${updateError.message}`,
    }
  }

  // Delete open tasks from prior revisions of this same session so re-saving
  // doesn't duplicate rows. Open tasks from this session can only have come
  // from an earlier revision of this exact assessment flow.
  const { error: cleanupError } = await supabase
    .from('patient_tasks')
    .delete()
    .eq('acordada_en_session_id', input.sessionId)
    .is('closed_at', null)

  if (cleanupError) {
    console.error('[T4] patient_tasks cleanup failed — assessment already saved, skipping task materialization', cleanupError)
    return {
      ok: false,
      error: `Informe guardado pero no se pudo limpiar tareas previas: ${cleanupError.message}`,
    }
  }

  // Apply inherited_task_updates: update estado/nota and stamp closed_at when
  // the new estado is terminal so the task lifecycle is properly closed.
  const terminalStates = new Set(['cumplida', 'no_realizada', 'no_abordada'])
  const updateResults = await Promise.all(
    parsedUpdates.data.map(({ id, estado, nota }) => {
      const isTerminal = terminalStates.has(estado)
      return supabase
        .from('patient_tasks')
        .update({
          estado,
          nota: nota === '' ? null : (nota ?? null),
          closed_at: isTerminal ? new Date().toISOString() : null,
          closed_by_assessment_id: isTerminal ? inserted.id : null,
        })
        .eq('id', id)
        .eq('user_id', input.userId)
    }),
  )

  const failedUpdate = updateResults.find((r) => r.error)
  if (failedUpdate?.error) {
    console.error('[T4] patient_tasks update failed — assessment already saved', failedUpdate.error)
    return {
      ok: false,
      error: `Informe guardado pero no se pudo actualizar tareas heredadas: ${failedUpdate.error.message}`,
    }
  }

  // Materialize proposed_tasks as new patient_tasks rows.
  const inserts = parsed.data.proposed_tasks.map((t) => ({
    user_id: input.userId,
    acordada_en_session_id: input.sessionId,
    acordada_en_assessment_id: inserted.id,
    descripcion: t.descripcion,
    nota: t.nota ?? null,
    estado: 'pendiente' as const,
  }))

  if (inserts.length > 0) {
    const { error: insertTasksError } = await supabase.from('patient_tasks').insert(inserts)
    if (insertTasksError) {
      console.error('[T4] patient_tasks insert failed — assessment already saved', insertTasksError)
      return {
        ok: false,
        error: `Informe guardado pero no se pudieron crear las tareas: ${insertTasksError.message}`,
      }
    }
  }

  revalidatePath('/app')
  revalidatePath(`/app/clinica/sesion/${input.sessionId}`)

  return { ok: true, assessmentId: inserted.id }
}

type ReviewActionResult = { ok: true } | { ok: false; error: string }

/**
 * Mark the AI-generated assessment as reviewed without changes. Updates
 * the row in place — no supersede, no new row — because there is nothing
 * to diff against the original AI draft. Stamps `reviewed_by` /
 * `reviewed_at` with the current clinician. Materializes proposed_tasks
 * using the existing assessmentId (no new row created).
 */
export async function markReviewedAction(input: {
  assessmentId: string
  sessionId: string
}): Promise<ReviewActionResult> {
  const supabase = await createAuthenticatedClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { ok: false, error: 'No autenticado' }
  }

  const { data: assessmentRow, error: fetchError } = await supabase
    .from('assessments')
    .select('user_id, summary_json')
    .eq('id', input.assessmentId)
    .single()

  if (fetchError || !assessmentRow) {
    return {
      ok: false,
      error: fetchError?.message ?? 'No se pudo obtener el informe',
    }
  }

  const parsed = AssessmentSchema.safeParse(assessmentRow.summary_json)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'El resumen del informe no es válido y no se pueden materializar las tareas',
    }
  }

  const { error: updateError } = await supabase
    .from('assessments')
    .update({
      status: 'reviewed_confirmed',
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', input.assessmentId)

  if (updateError) {
    return {
      ok: false,
      error: updateError.message ?? 'No se pudo marcar como revisado',
    }
  }

  // Idempotent cleanup: rare in practice but guards against re-confirm after an
  // edit path was taken before mark-reviewed.
  const { error: cleanupError } = await supabase
    .from('patient_tasks')
    .delete()
    .eq('acordada_en_session_id', input.sessionId)
    .is('closed_at', null)

  if (cleanupError) {
    console.error('[T4] markReviewed patient_tasks cleanup failed — assessment already confirmed', cleanupError)
    return {
      ok: false,
      error: `Revisión confirmada pero no se pudo limpiar tareas previas: ${cleanupError.message}`,
    }
  }

  const inserts = parsed.data.proposed_tasks.map((t) => ({
    user_id: assessmentRow.user_id,
    acordada_en_session_id: input.sessionId,
    acordada_en_assessment_id: input.assessmentId,
    descripcion: t.descripcion,
    nota: t.nota ?? null,
    estado: 'pendiente' as const,
  }))

  if (inserts.length > 0) {
    const { error: insertTasksError } = await supabase.from('patient_tasks').insert(inserts)
    if (insertTasksError) {
      console.error('[T4] markReviewed patient_tasks insert failed — assessment already confirmed', insertTasksError)
      return {
        ok: false,
        error: `Revisión confirmada pero no se pudieron crear las tareas: ${insertTasksError.message}`,
      }
    }
  }

  revalidatePath('/app')
  revalidatePath(`/app/clinica/sesion/${input.sessionId}`)

  return { ok: true }
}

/**
 * Reject the AI-generated assessment. Updates the row to
 * `status='rejected'` and persists the clinician's reason. The reason
 * is required — a blank rejection would not give us anything to audit
 * against later, so we enforce a 3-char minimum after trim.
 */
export async function rejectAssessmentAction(input: {
  assessmentId: string
  sessionId: string
  reason: string
}): Promise<ReviewActionResult> {
  const reason = input.reason.trim()
  if (reason.length < 3) {
    return { ok: false, error: 'Motivo requerido' }
  }

  const supabase = await createAuthenticatedClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { ok: false, error: 'No autenticado' }
  }

  const { error: updateError } = await supabase
    .from('assessments')
    .update({
      status: 'rejected',
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', input.assessmentId)

  if (updateError) {
    return {
      ok: false,
      error: updateError.message ?? 'No se pudo rechazar el informe',
    }
  }

  revalidatePath('/app')
  revalidatePath(`/app/clinica/sesion/${input.sessionId}`)

  return { ok: true }
}

type RegenerateActionResult =
  | { ok: true; runId: string }
  | { ok: false; error: string }

/**
 * Regenerate a rejected closure assessment.
 *
 * Pipeline:
 *   1. Authenticate the caller (RLS handles role enforcement — only
 *      clinicians can UPDATE assessments per migration
 *      20260423000001_rls_clinician_write).
 *   2. `prepareRegeneration` fetches the rejected row, captures
 *      `rejection_reason` + `clinical_notes`, and marks the row as
 *      `superseded` so the next `assessmentExistsStep` check sees no live
 *      row.
 *   3. Enqueue `generateAssessmentWorkflow` with a `rejectionContext` so
 *      the LLM has the clinician's reasons + notes when producing the
 *      new draft.
 *
 * The new draft starts with `clinical_notes=null`. The clinician can add
 * notes again in the new revision — notes apply to the specific assessment
 * version, not the session globally. Decision recorded in T-B spec.
 *
 * Idempotency: `prepareRegeneration` + the live-status filter +
 * `assessments_session_closure_live_unique` together guarantee at most one
 * live draft per session even under concurrent regenerate requests. See
 * `prepareRegeneration` JSDoc for the atomicity contract.
 */
export async function regenerateAssessmentAction(input: {
  assessmentId: string
}): Promise<RegenerateActionResult> {
  const supabase = await createAuthenticatedClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { ok: false, error: 'No autenticado' }
  }

  let prepared
  try {
    prepared = await prepareRegeneration(supabase, input.assessmentId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }

  let runId: string
  try {
    const result = await enqueueAssessmentGeneration({
      sessionId: prepared.sessionId,
      rejectionContext: prepared.rejectionContext,
    })
    runId = result.runId
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // The row is now `superseded` but the workflow never started. Without
    // rollback the row would be orphaned — `prepareRegeneration` would
    // reject any retry because status is no longer regenerable. Restore
    // the original status so the next click can succeed.
    await rollbackRegeneration(
      supabase,
      input.assessmentId,
      prepared.originalStatus,
    )
    console.error('[regenerateAssessmentAction] enqueue failed', {
      assessmentId: input.assessmentId,
      sessionId: prepared.sessionId,
      originalStatus: prepared.originalStatus,
      error: message,
    })
    return {
      ok: false,
      error:
        'No se pudo encolar la regeneración. El informe queda como estaba; intenta de nuevo en unos segundos.',
    }
  }

  revalidatePath('/app')
  revalidatePath(`/app/clinica/sesion/${prepared.sessionId}`)

  return { ok: true, runId }
}
