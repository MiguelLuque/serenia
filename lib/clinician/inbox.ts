import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  derivePatientRiskState,
  type PatientRiskState,
} from '@/lib/clinical/risk-rules'
import { AssessmentSchema } from '@/lib/assessments/generator'

type AssessmentStatus = Database['public']['Enums']['assessment_status']
type RiskSeverity = Database['public']['Enums']['risk_severity']

export type InboxRow = {
  sessionId: string
  userId: string
  displayName: string | null
  closedAt: string | null
  closureReason: string | null
  assessmentStatus: AssessmentStatus | null
  hasCrisis: boolean
  topRisk: RiskSeverity | null
  // T11 longitudinal fields
  sessionNumber: number
  daysSincePrevious: number | null
  phq9Trend: number[]
  gad7Trend: number[]
  openTasksCount: number
  riskState: PatientRiskState
}

// Higher value = more severe, used to pick the max severity per session.
const SEVERITY_RANK: Record<RiskSeverity, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Sort inbox rows so unreviewed assessments (draft_ai or missing) appear
 * first, then by closed_at desc within each group.
 *
 * Exported for unit testing.
 */
export function sortInboxRows(rows: InboxRow[]): InboxRow[] {
  const isUnreviewed = (row: InboxRow): boolean =>
    row.assessmentStatus === null || row.assessmentStatus === 'draft_ai'

  return [...rows].sort((a, b) => {
    const aUnreviewed = isUnreviewed(a) ? 1 : 0
    const bUnreviewed = isUnreviewed(b) ? 1 : 0
    if (aUnreviewed !== bUnreviewed) {
      return bUnreviewed - aUnreviewed
    }
    // closed_at desc — nulls last
    const aTime = a.closedAt ? new Date(a.closedAt).getTime() : -Infinity
    const bTime = b.closedAt ? new Date(b.closedAt).getTime() : -Infinity
    return bTime - aTime
  })
}

/**
 * Fetch the clinician's inbox: closed sessions joined with the latest
 * non-superseded closure assessment per session, plus patient name and
 * risk-event summary, enriched with T11 longitudinal per-patient info
 * (session ordinal, trend scores, open tasks, derived risk state).
 *
 * All enrichments are O(1) queries scoped by userId; iteration happens
 * in JS. Relies on RLS to scope the clinician's visibility.
 */
export async function getClinicianInbox(
  supabase: SupabaseClient<Database>
): Promise<InboxRow[]> {
  const { data: sessions, error: sessionsError } = await supabase
    .from('clinical_sessions')
    .select('id, user_id, closed_at, closure_reason, status')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(100)

  if (sessionsError) throw sessionsError
  if (!sessions || sessions.length === 0) return []

  const sessionIds = sessions.map((s) => s.id)
  const userIds = Array.from(new Set(sessions.map((s) => s.user_id)))

  const [
    assessmentsRes,
    profilesRes,
    riskRes,
    allClosedSessionsRes,
    validatedAssessmentsRes,
    tasksRes,
    questionnairesRes,
  ] = await Promise.all([
    // Latest closure assessment per inbox session (for assessmentStatus).
    supabase
      .from('assessments')
      .select('id, session_id, status, created_at')
      .eq('assessment_type', 'closure')
      .neq('status', 'superseded')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_profiles')
      .select('user_id, display_name')
      .in('user_id', userIds),
    // Broadened to all risk events per user so we can count "open" risk
    // for the riskState derivation. Still one round-trip.
    supabase
      .from('risk_events')
      .select('session_id, user_id, severity, status, created_at')
      .in('user_id', userIds),
    // Every closed session for these users — needed to compute
    // sessionNumber + daysSincePrevious for the rows in the window.
    supabase
      .from('clinical_sessions')
      .select('id, user_id, closed_at, closure_reason')
      .in('user_id', userIds)
      .eq('status', 'closed')
      .order('closed_at', { ascending: true }),
    // Latest validated closure assessment per user → feeds riskState.
    supabase
      .from('assessments')
      .select('user_id, reviewed_at, summary_json, status')
      .in('status', ['reviewed_confirmed', 'reviewed_modified'])
      .eq('assessment_type', 'closure')
      .in('user_id', userIds)
      .order('reviewed_at', { ascending: false }),
    supabase
      .from('patient_tasks')
      .select('user_id, estado')
      .in('user_id', userIds)
      .in('estado', ['pendiente', 'parcial']),
    // PHQ-9 / GAD-7 scored results per user, newest first.
    supabase
      .from('questionnaire_instances')
      .select(
        'user_id, scored_at, questionnaire_definitions!inner(code), questionnaire_results!inner(total_score)'
      )
      .in('user_id', userIds)
      .eq('status', 'scored')
      .in('questionnaire_definitions.code', ['PHQ9', 'GAD7'])
      .order('scored_at', { ascending: false })
      .limit(100),
  ])

  if (assessmentsRes.error) throw assessmentsRes.error
  if (profilesRes.error) throw profilesRes.error
  if (riskRes.error) throw riskRes.error
  if (allClosedSessionsRes.error) throw allClosedSessionsRes.error
  if (validatedAssessmentsRes.error) throw validatedAssessmentsRes.error
  if (tasksRes.error) throw tasksRes.error
  if (questionnairesRes.error) throw questionnairesRes.error

  // Latest non-superseded assessment per inbox session.
  const assessmentBySession = new Map<string, AssessmentStatus>()
  for (const a of assessmentsRes.data ?? []) {
    if (!a.session_id) continue
    if (!assessmentBySession.has(a.session_id)) {
      assessmentBySession.set(a.session_id, a.status)
    }
  }

  const nameByUser = new Map<string, string | null>()
  for (const p of profilesRes.data ?? []) {
    nameByUser.set(p.user_id, p.display_name ?? null)
  }

  // Top severity per inbox session (from the broadened risk-event set).
  const topRiskBySession = new Map<string, RiskSeverity>()
  // Open risk events per user for riskState derivation.
  const openRiskByUser = new Map<
    string,
    Array<{ severity: string; createdAt: string }>
  >()
  for (const r of riskRes.data ?? []) {
    if (r.session_id && sessionIds.includes(r.session_id)) {
      const current = topRiskBySession.get(r.session_id)
      if (!current || SEVERITY_RANK[r.severity] > SEVERITY_RANK[current]) {
        topRiskBySession.set(r.session_id, r.severity)
      }
    }
    if (r.status === 'open') {
      const list = openRiskByUser.get(r.user_id) ?? []
      list.push({ severity: r.severity, createdAt: r.created_at })
      openRiskByUser.set(r.user_id, list)
    }
  }

  // sessionNumber + daysSincePrevious per inbox sessionId.
  const sessionNumberById = new Map<string, number>()
  const daysSincePreviousById = new Map<string, number | null>()
  // Group closed sessions per user (already ordered ASC).
  const closedByUser = new Map<
    string,
    Array<{ id: string; closedAt: string | null; closureReason: string | null }>
  >()
  for (const s of allClosedSessionsRes.data ?? []) {
    const list = closedByUser.get(s.user_id) ?? []
    list.push({
      id: s.id,
      closedAt: s.closed_at,
      closureReason: s.closure_reason,
    })
    closedByUser.set(s.user_id, list)
  }
  for (const [, list] of closedByUser) {
    list.forEach((entry, idx) => {
      sessionNumberById.set(entry.id, idx + 1)
      if (idx === 0) {
        daysSincePreviousById.set(entry.id, null)
      } else {
        const prev = list[idx - 1]!
        if (entry.closedAt && prev.closedAt) {
          const diff =
            new Date(entry.closedAt).getTime() -
            new Date(prev.closedAt).getTime()
          daysSincePreviousById.set(entry.id, Math.floor(diff / MS_PER_DAY))
        } else {
          daysSincePreviousById.set(entry.id, null)
        }
      }
    })
  }

  // Latest validated assessment per user → parsed suicidality. Mirrors the
  // pattern in lib/patient-context/builder.ts without re-exporting its logic.
  const validatedByUser = new Map<
    string,
    { reviewedAt: string; suicidality: 'none' | 'passive' | 'active' | 'acute' }
  >()
  for (const a of validatedAssessmentsRes.data ?? []) {
    if (!a.user_id || !a.reviewed_at) continue
    if (validatedByUser.has(a.user_id)) continue
    const parsed = AssessmentSchema.safeParse(a.summary_json)
    if (!parsed.success) continue
    validatedByUser.set(a.user_id, {
      reviewedAt: a.reviewed_at,
      suicidality: parsed.data.risk_assessment.suicidality,
    })
  }

  // Open tasks count per user.
  const openTasksByUser = new Map<string, number>()
  for (const t of tasksRes.data ?? []) {
    openTasksByUser.set(t.user_id, (openTasksByUser.get(t.user_id) ?? 0) + 1)
  }

  // Trends: take last 3 per (user, code). Query is ordered DESC → take the
  // first 3 seen per code, reverse to oldest→newest.
  type QRow = {
    user_id: string
    scored_at: string | null
    questionnaire_definitions:
      | { code: string }
      | { code: string }[]
      | null
    questionnaire_results:
      | { total_score: number }
      | { total_score: number }[]
      | null
  }
  const phqByUser = new Map<string, number[]>()
  const gadByUser = new Map<string, number[]>()
  for (const row of (questionnairesRes.data ?? []) as QRow[]) {
    const defRaw = row.questionnaire_definitions
    const code = Array.isArray(defRaw) ? defRaw[0]?.code : defRaw?.code
    const resRaw = row.questionnaire_results
    const score = Array.isArray(resRaw)
      ? resRaw[0]?.total_score
      : resRaw?.total_score
    if (code === undefined || score === undefined) continue
    const target = code === 'PHQ9' ? phqByUser : code === 'GAD7' ? gadByUser : null
    if (!target) continue
    const list = target.get(row.user_id) ?? []
    if (list.length < 3) {
      list.push(score)
      target.set(row.user_id, list)
    }
  }
  // Reverse each to oldest→newest.
  for (const [u, list] of phqByUser) phqByUser.set(u, [...list].reverse())
  for (const [u, list] of gadByUser) gadByUser.set(u, [...list].reverse())

  const rows: InboxRow[] = sessions.map((s) => {
    // previousSession for this row = the closed session for this user
    // immediately BEFORE this one in chronological order.
    const userSessions = closedByUser.get(s.user_id) ?? []
    const idx = userSessions.findIndex((e) => e.id === s.id)
    const prev = idx > 0 ? userSessions[idx - 1]! : null

    const riskState = derivePatientRiskState({
      lastValidatedAssessment: validatedByUser.get(s.user_id) ?? null,
      openRiskEvents: openRiskByUser.get(s.user_id) ?? [],
      previousSession:
        prev && prev.closedAt
          ? { closedAt: prev.closedAt, closureReason: prev.closureReason }
          : null,
    })

    return {
      sessionId: s.id,
      userId: s.user_id,
      displayName: nameByUser.get(s.user_id) ?? null,
      closedAt: s.closed_at,
      closureReason: s.closure_reason,
      assessmentStatus: assessmentBySession.get(s.id) ?? null,
      hasCrisis: s.closure_reason === 'crisis_detected',
      topRisk: topRiskBySession.get(s.id) ?? null,
      sessionNumber: sessionNumberById.get(s.id) ?? 1,
      daysSincePrevious: daysSincePreviousById.get(s.id) ?? null,
      phq9Trend: phqByUser.get(s.user_id) ?? [],
      gad7Trend: gadByUser.get(s.user_id) ?? [],
      openTasksCount: openTasksByUser.get(s.user_id) ?? 0,
      riskState,
    }
  })

  return sortInboxRows(rows)
}
