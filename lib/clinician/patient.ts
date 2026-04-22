import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { AssessmentStatus } from './assessment-labels'

type RiskSeverity = Database['public']['Enums']['risk_severity']
type RiskType = Database['public']['Enums']['risk_type']

export type PatientProfile = {
  userId: string
  displayName: string | null
  birthDate: string | null
}

export type PatientQuestionnaireResult = {
  code: string
  scoredAt: string | null
  totalScore: number
  severityBand: string
}

export type PatientRiskEvent = {
  id: string
  riskType: RiskType
  severity: RiskSeverity
  sessionId: string | null
  createdAt: string
}

export type PatientSession = {
  id: string
  openedAt: string
  closedAt: string | null
  closureReason: string | null
  assessmentStatus: AssessmentStatus | null
}

export type PatientDetail = {
  profile: PatientProfile
  questionnaireResults: PatientQuestionnaireResult[]
  riskEvents: PatientRiskEvent[]
  sessions: PatientSession[]
}

// Codes included in the "tendencias" trend table. ASQ is a risk screener,
// not a mood trend, so it's excluded by design.
const TREND_CODES = ['PHQ9', 'GAD7'] as const

/**
 * Fetch the full detail of a patient for the clinician panel: profile
 * header, historical PHQ-9 / GAD-7 scores, risk events and sessions with
 * the latest non-superseded assessment status. Returns an empty shell
 * (with null displayName) if the user profile is not visible to the
 * caller — RLS already scopes this, we just avoid throwing on a missing
 * profile row.
 */
export async function getPatientDetail(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PatientDetail> {
  const [profileRes, instancesRes, riskRes, sessionsRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('user_id, display_name, birth_date')
      .eq('user_id', userId)
      .maybeSingle(),
    // Scored instances of the trend questionnaires, joined with their result.
    supabase
      .from('questionnaire_instances')
      .select(
        'id, scored_at, questionnaire_definitions!inner(code), questionnaire_results!inner(total_score, severity_band)'
      )
      .eq('user_id', userId)
      .eq('status', 'scored')
      .in('questionnaire_definitions.code', TREND_CODES as unknown as string[])
      .order('scored_at', { ascending: false }),
    supabase
      .from('risk_events')
      .select('id, risk_type, severity, session_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('clinical_sessions')
      .select('id, opened_at, closed_at, closure_reason')
      .eq('user_id', userId)
      .order('opened_at', { ascending: false }),
  ])

  if (profileRes.error) throw profileRes.error
  if (instancesRes.error) throw instancesRes.error
  if (riskRes.error) throw riskRes.error
  if (sessionsRes.error) throw sessionsRes.error

  const profile: PatientProfile = {
    userId,
    displayName: profileRes.data?.display_name ?? null,
    birthDate: profileRes.data?.birth_date ?? null,
  }

  const questionnaireResults: PatientQuestionnaireResult[] = (
    instancesRes.data ?? []
  ).flatMap((row) => {
    // With `!inner` joins these come back as arrays of size 1; handle both
    // shapes to stay robust to PostgREST quirks.
    const def = Array.isArray(row.questionnaire_definitions)
      ? row.questionnaire_definitions[0]
      : row.questionnaire_definitions
    const result = Array.isArray(row.questionnaire_results)
      ? row.questionnaire_results[0]
      : row.questionnaire_results
    if (!def || !result) return []
    return [
      {
        code: def.code,
        scoredAt: row.scored_at,
        totalScore: result.total_score,
        severityBand: result.severity_band,
      },
    ]
  })

  const riskEvents: PatientRiskEvent[] = (riskRes.data ?? []).map((r) => ({
    id: r.id,
    riskType: r.risk_type,
    severity: r.severity,
    sessionId: r.session_id,
    createdAt: r.created_at,
  }))

  const sessionRows = sessionsRes.data ?? []
  const sessionIds = sessionRows.map((s) => s.id)

  let assessmentBySession = new Map<string, AssessmentStatus>()
  if (sessionIds.length > 0) {
    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select('session_id, status, created_at')
      .eq('assessment_type', 'closure')
      .neq('status', 'superseded')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
    if (assessmentsError) throw assessmentsError
    // Query is sorted by created_at desc, so the first row we see per
    // session is the latest non-superseded assessment.
    assessmentBySession = new Map()
    for (const a of assessments ?? []) {
      if (!a.session_id) continue
      if (!assessmentBySession.has(a.session_id)) {
        assessmentBySession.set(a.session_id, a.status)
      }
    }
  }

  const sessions: PatientSession[] = sessionRows.map((s) => ({
    id: s.id,
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    closureReason: s.closure_reason,
    assessmentStatus: assessmentBySession.get(s.id) ?? null,
  }))

  return {
    profile,
    questionnaireResults,
    riskEvents,
    sessions,
  }
}
