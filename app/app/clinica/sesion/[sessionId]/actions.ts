'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { AssessmentSchema } from '@/lib/server/assessments/generator'
import {
  prepareRegeneration,
} from '@/lib/server/assessments/regenerate'
import { enqueueAssessmentGeneration } from '@/lib/server/workflows'
import type { Json } from '@/lib/shared/supabase/types'

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
  const { data: assessmentId, error } = await supabase.rpc('review_assessment_atomic', {
    p_session_id: input.sessionId,
    p_assessment_id: input.assessmentId,
    p_action: 'modify',
    p_summary: parsed.data as unknown as Json,
    p_notes: input.clinical_notes?.trim() || null,
    p_inherited_updates: parsedUpdates.data as unknown as Json,
  })
  if (error || !assessmentId) return { ok: false, error: error?.message ?? 'No se pudo guardar el informe' }

  revalidatePath('/app')
  revalidatePath(`/app/clinica/sesion/${input.sessionId}`)

  return { ok: true, assessmentId }
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

  const { error } = await supabase.rpc('review_assessment_atomic', {
    p_session_id: input.sessionId,
    p_assessment_id: input.assessmentId,
    p_action: 'confirm',
  })
  if (error) return { ok: false, error: error.message }

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

  const { error } = await supabase.rpc('review_assessment_atomic', {
    p_session_id: input.sessionId,
    p_assessment_id: input.assessmentId,
    p_action: 'reject',
    p_reason: reason,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app')
  revalidatePath(`/app/clinica/sesion/${input.sessionId}`)

  return { ok: true }
}

type RegenerateActionResult =
  | { ok: true; runId: string }
  | { ok: false; error: string }

/**
 * Claim a rejected/manual-review assessment via the clinician RPC, then enqueue.
 * Compensation restores the captured status if enqueue fails. SQL prevents
 * concurrent claims; external dispatch durability is handled separately.
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
    // The supersession, original reason and notes already committed with
    // a durable outbox job. Recovery can retry without undoing the request.
    console.error('[regenerateAssessmentAction] enqueue failed', {
      assessmentId: input.assessmentId,
      sessionId: prepared.sessionId,
      originalStatus: prepared.originalStatus,
      error: message,
    })
    return {
      ok: false,
      error:
        'No se pudo iniciar la regeneración ahora. La solicitud y las notas se han guardado para recuperación automática; recarga más tarde para comprobar su estado.',
    }
  }

  revalidatePath('/app')
  revalidatePath(`/app/clinica/sesion/${prepared.sessionId}`)

  return { ok: true, runId }
}
