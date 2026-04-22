'use server'

import { revalidatePath } from 'next/cache'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { AssessmentSchema } from '@/lib/assessments/generator'
import type { Json } from '@/lib/supabase/types'

type SaveAssessmentInput = {
  assessmentId: string
  sessionId: string
  userId: string
  summary: unknown
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

  const supabase = await createAuthenticatedClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { ok: false, error: 'No autenticado' }
  }
  const reviewerId = userData.user.id

  const now = new Date().toISOString()

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

  revalidatePath('/app')
  revalidatePath(`/app/clinica/sesion/${input.sessionId}`)

  return { ok: true, assessmentId: inserted.id }
}

type ReviewActionResult = { ok: true } | { ok: false; error: string }

/**
 * Mark the AI-generated assessment as reviewed without changes. Updates
 * the row in place — no supersede, no new row — because there is nothing
 * to diff against the original AI draft. Stamps `reviewed_by` /
 * `reviewed_at` with the current clinician.
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
