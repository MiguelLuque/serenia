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
