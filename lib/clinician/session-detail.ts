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
    /**
     * Validated assessment summary. Null when `status='requires_manual_review'`
     * because the row's `summary_json` holds a `{ generation_failure }`
     * payload that does NOT validate against `AssessmentSchema`. The view
     * branches on this and renders the failure UI instead of the editor.
     */
    summary: AssessmentSummary | null
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
  /**
   * True when no live assessment exists but a `superseded` row was touched
   * recently — indicates the clinician just clicked "Regenerar" and the
   * background workflow hasn't produced the new draft yet. The view renders
   * a "regenerating…" state instead of the terminal-failure copy.
   *
   * Only set when `assessment === null`.
   */
  regenerationInProgress: boolean
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
 * Window during which a recently-superseded row signals "regeneration in
 * progress" rather than a permanent absence. Tuned to the realistic LLM
 * latency of `generateAssessmentWorkflow` (~10–30s) plus retries (~3×).
 */
const REGENERATION_IN_PROGRESS_WINDOW_MS = 5 * 60 * 1000

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

  const [profileRes, assessmentRes, latestSupersededRes, messagesRes, inheritedTasksRes] = await Promise.all([
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
    // Used only when the live-row query returns null: detect "regeneration
    // in progress" by checking whether the most recent superseded closure
    // row was touched within REGENERATION_IN_PROGRESS_WINDOW_MS. Cheaper to
    // always fetch in parallel than to issue a second roundtrip when the
    // first comes back empty.
    supabase
      .from('assessments')
      .select('id, updated_at, created_at')
      .eq('session_id', sessionId)
      .eq('assessment_type', 'closure')
      .eq('status', 'superseded')
      .order('updated_at', { ascending: false })
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
  if (latestSupersededRes.error) throw latestSupersededRes.error
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

  const assessmentRow = assessmentRes.data
  let assessment: SessionDetail['assessment'] = null
  if (assessmentRow) {
    // `requires_manual_review` rows hold a `{ generation_failure }` payload
    // in `summary_json` that doesn't match `AssessmentSchema`. Skip the
    // parse and surface `summary: null`; the view renders the failure UI
    // (and the regenerate CTA) instead of trying to read summary fields.
    const summary =
      assessmentRow.status === 'requires_manual_review'
        ? null
        : AssessmentSchema.parse(assessmentRow.summary_json)
    assessment = {
      id: assessmentRow.id,
      status: assessmentRow.status,
      summary,
      generatedBy: assessmentRow.generated_by,
      createdAt: assessmentRow.created_at,
      clinicalNotes: assessmentRow.clinical_notes ?? null,
      rejectionReason: assessmentRow.rejection_reason ?? null,
    }
  }

  // "Regeneration in progress" iff: no live assessment AND a superseded row
  // was touched recently (within REGENERATION_IN_PROGRESS_WINDOW_MS). We use
  // `updated_at` (set by trg_assessments_updated_at on every UPDATE) so the
  // window is anchored to the moment `prepareRegeneration` flipped the row
  // to `superseded`, not to row creation. Falls back to `created_at` if
  // `updated_at` is missing for any reason.
  let regenerationInProgress = false
  if (!assessment && latestSupersededRes.data) {
    const stamp =
      latestSupersededRes.data.updated_at ?? latestSupersededRes.data.created_at
    if (stamp) {
      const ageMs = Date.now() - new Date(stamp).getTime()
      regenerationInProgress =
        ageMs >= 0 && ageMs <= REGENERATION_IN_PROGRESS_WINDOW_MS
    }
  }

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
    assessment,
    regenerationInProgress,
    messages,
    inheritedTasks,
  }
}
