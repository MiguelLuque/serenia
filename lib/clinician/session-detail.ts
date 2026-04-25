import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  AssessmentSchema,
  type AssessmentSummary,
} from '@/lib/assessments/generator'

type AssessmentStatus = Database['public']['Enums']['assessment_status']
type GeneratedBy = Database['public']['Enums']['generated_by_source']
type PatientTaskStatus = Database['public']['Enums']['patient_task_status']

export type SessionDetail = {
  session: {
    id: string
    userId: string
    openedAt: string
    closedAt: string | null
    closureReason: string | null
    conversationId: string | null
  }
  patient: {
    userId: string
    displayName: string | null
  } | null
  assessment: {
    id: string
    status: AssessmentStatus
    summary: AssessmentSummary
    generatedBy: GeneratedBy
    createdAt: string
    /**
     * Free-text clinician notes attached to this revision (Plan 7 T-B).
     * Distinct from `rejectionReason`. Visible to the AI agent in future
     * sessions per Plan 7 T-1 (context Tier A).
     */
    clinicalNotes: string | null
    /**
     * Reason captured when this row was rejected (status='rejected'). Null
     * for any other status. Used by the regenerate flow to seed the LLM's
     * `rejectionContext`.
     */
    rejectionReason: string | null
  } | null
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    text: string
    createdAt: string
  }>
  inheritedTasks: Array<{
    id: string
    descripcion: string
    nota: string | null
    estado: PatientTaskStatus
    createdAt: string
    originSessionId: string
    originAssessmentId: string
  }>
}

/**
 * Extract plain text from the `parts` JSON column of a message, which is
 * an AI SDK UIMessagePart[] structure. We concatenate all text parts and
 * ignore tool / reasoning parts — the clinician transcript should read
 * like a conversation.
 */
function extractText(parts: unknown): string {
  if (!Array.isArray(parts)) return ''
  return parts
    .filter(
      (p): p is { type: 'text'; text: string } =>
        typeof p === 'object' &&
        p !== null &&
        (p as { type?: unknown }).type === 'text' &&
        typeof (p as { text?: unknown }).text === 'string',
    )
    .map((p) => p.text)
    .join('')
}

/**
 * Fetch everything the clinician needs to review a single session:
 * session meta, patient name, the "vigente" (latest non-superseded)
 * closure assessment if present, and the user/assistant transcript in
 * chronological order. RLS already scopes access to sessions the
 * clinician can see. Returns `null` when the session doesn't exist so
 * the page can fall through to `notFound()`.
 */
export async function getSessionDetail(
  supabase: SupabaseClient<Database>,
  sessionId: string,
): Promise<SessionDetail | null> {
  const { data: sessionRow, error: sessionError } = await supabase
    .from('clinical_sessions')
    .select(
      'id, user_id, opened_at, closed_at, closure_reason, conversation_id',
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) throw sessionError
  if (!sessionRow) return null

  const [profileRes, assessmentRes, messagesRes, inheritedTasksRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('user_id, display_name')
      .eq('user_id', sessionRow.user_id)
      .maybeSingle(),
    // "Vigente" = the latest closure assessment whose status isn't
    // `superseded`. We pick created_at desc + limit 1 rather than
    // filtering by `supersedes_assessment_id` FK because when an
    // assessment is superseded the DB transitions its status to
    // `superseded`, which is the same signal used in inbox / patient
    // views elsewhere in the codebase.
    supabase
      .from('assessments')
      .select(
        'id, status, summary_json, generated_by, created_at, clinical_notes, rejection_reason',
      )
      .eq('session_id', sessionId)
      .eq('assessment_type', 'closure')
      .neq('status', 'superseded')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sessionRow.conversation_id
      ? supabase
          .from('messages')
          .select('id, role, parts, created_at')
          .eq('conversation_id', sessionRow.conversation_id)
          .in('role', ['user', 'assistant'])
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null } as const),
    supabase
      .from('patient_tasks')
      .select(
        'id, descripcion, nota, estado, created_at, acordada_en_session_id, acordada_en_assessment_id',
      )
      .eq('user_id', sessionRow.user_id)
      .in('estado', ['pendiente', 'parcial'])
      .neq('acordada_en_session_id', sessionId)
      .order('created_at', { ascending: false }),
  ])

  if (profileRes.error) throw profileRes.error
  if (assessmentRes.error) throw assessmentRes.error
  if (messagesRes.error) throw messagesRes.error
  if (inheritedTasksRes.error) throw inheritedTasksRes.error

  const messages: SessionDetail['messages'] = (messagesRes.data ?? []).flatMap(
    (m) => {
      if (m.role !== 'user' && m.role !== 'assistant') return []
      const text = extractText(m.parts)
      if (!text) return []
      return [
        {
          id: m.id,
          role: m.role,
          text,
          createdAt: m.created_at,
        },
      ]
    },
  )

  const inheritedTasks: SessionDetail['inheritedTasks'] = (
    inheritedTasksRes.data ?? []
  ).map((t) => ({
    id: t.id,
    descripcion: t.descripcion,
    nota: t.nota,
    estado: t.estado,
    createdAt: t.created_at,
    originSessionId: t.acordada_en_session_id,
    originAssessmentId: t.acordada_en_assessment_id,
  }))

  return {
    session: {
      id: sessionRow.id,
      userId: sessionRow.user_id,
      openedAt: sessionRow.opened_at,
      closedAt: sessionRow.closed_at,
      closureReason: sessionRow.closure_reason,
      conversationId: sessionRow.conversation_id,
    },
    patient: profileRes.data
      ? {
          userId: profileRes.data.user_id,
          displayName: profileRes.data.display_name ?? null,
        }
      : { userId: sessionRow.user_id, displayName: null },
    assessment: assessmentRes.data
      ? {
          id: assessmentRes.data.id,
          status: assessmentRes.data.status,
          summary: AssessmentSchema.parse(assessmentRes.data.summary_json),
          generatedBy: assessmentRes.data.generated_by,
          createdAt: assessmentRes.data.created_at,
          clinicalNotes: assessmentRes.data.clinical_notes ?? null,
          rejectionReason: assessmentRes.data.rejection_reason ?? null,
        }
      : null,
    messages,
    inheritedTasks,
  }
}
