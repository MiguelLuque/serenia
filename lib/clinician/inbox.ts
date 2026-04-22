import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

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
}

// Higher value = more severe, used to pick the max severity per session.
const SEVERITY_RANK: Record<RiskSeverity, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
}

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
 * risk-event summary. Relies on RLS to scope to sessions the clinician
 * can see.
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

  const [assessmentsRes, profilesRes, riskRes] = await Promise.all([
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
    supabase
      .from('risk_events')
      .select('session_id, severity')
      .in('session_id', sessionIds),
  ])

  if (assessmentsRes.error) throw assessmentsRes.error
  if (profilesRes.error) throw profilesRes.error
  if (riskRes.error) throw riskRes.error

  // Latest non-superseded assessment per session. Query is already sorted
  // by created_at desc, so the first entry we see per session wins.
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

  const topRiskBySession = new Map<string, RiskSeverity>()
  for (const r of riskRes.data ?? []) {
    if (!r.session_id) continue
    const current = topRiskBySession.get(r.session_id)
    if (!current || SEVERITY_RANK[r.severity] > SEVERITY_RANK[current]) {
      topRiskBySession.set(r.session_id, r.severity)
    }
  }

  const rows: InboxRow[] = sessions.map((s) => ({
    sessionId: s.id,
    userId: s.user_id,
    displayName: nameByUser.get(s.user_id) ?? null,
    closedAt: s.closed_at,
    closureReason: s.closure_reason,
    assessmentStatus: assessmentBySession.get(s.id) ?? null,
    hasCrisis: s.closure_reason === 'crisis_detected',
    topRisk: topRiskBySession.get(s.id) ?? null,
  }))

  return sortInboxRows(rows)
}
