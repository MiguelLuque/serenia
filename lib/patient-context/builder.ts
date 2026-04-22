import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { AssessmentSchema, type AssessmentSummary } from '@/lib/assessments/generator'
import { type PatientRiskState, derivePatientRiskState } from '@/lib/clinical/risk-rules'

export type PatientContextTier = 'none' | 'historic' | 'tierB' | 'tierA'

export type PatientContext = {
  tier: PatientContextTier
  isFirstSession: boolean
  patient: { displayName: string | null; age: number | null }
  validated: {
    reviewedAt: string
    summary: Pick<
      AssessmentSummary,
      'chief_complaint' | 'presenting_issues' | 'areas_for_exploration' | 'risk_assessment' | 'questionnaires'
    >
    ageInDays: number
  } | null
  tierBDraft: {
    closedAt: string
    summary: Pick<AssessmentSummary, 'chief_complaint' | 'presenting_issues' | 'questionnaires'>
  } | null
  recentQuestionnaires: Array<{
    code: 'PHQ9' | 'GAD7' | 'ASQ'
    score: number
    band: string
    scoredAt: string
    deltaVsPrevious: number | null
  }>
  openRiskEvents: Array<{ severity: string; createdAt: string; riskType: string }>
  previousSession: { closedAt: string; closureReason: string | null; daysAgo: number } | null
  pendingTasks: Array<{
    id: string
    descripcion: string
    estado: 'pendiente' | 'parcial'
    acordadaEn: string
  }>
  sessionNumber: number
  riskState: PatientRiskState
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const TIER_A_WINDOW_DAYS = 90

function floorDays(nowMs: number, dateStr: string): number {
  return Math.floor((nowMs - new Date(dateStr).getTime()) / MS_PER_DAY)
}

function computeAge(birthDate: string | null, now: Date): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  let age = now.getFullYear() - birth.getFullYear()
  const hadBirthday =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  if (!hadBirthday) age -= 1
  return age
}

export async function buildPatientContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<PatientContext> {
  const nowMs = now.getTime()

  const [
    validatedRow,
    tierBRow,
    questionnaireRows,
    riskRows,
    prevSessionRow,
    pendingTaskRows,
    sessionCountRow,
    profileRow,
  ] = await Promise.all([
    // Q1: latest validated assessment
    supabase
      .from('assessments')
      .select('id, reviewed_at, summary_json')
      .in('status', ['reviewed_confirmed', 'reviewed_modified'])
      .eq('user_id', userId)
      .order('reviewed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Q2: latest draft assessment from a closed session
    supabase
      .from('assessments')
      .select('summary_json, clinical_sessions!inner(closed_at, status)')
      .in('status', ['draft_ai', 'rejected'])
      .eq('user_id', userId)
      .eq('clinical_sessions.status', 'closed')
      .order('closed_at', { referencedTable: 'clinical_sessions', ascending: false })
      .limit(1)
      .maybeSingle(),

    // Q3: recent questionnaires
    supabase
      .from('questionnaire_results')
      .select(
        'total_score, severity_band, created_at, questionnaire_instances!inner(user_id, questionnaire_definitions!inner(code))',
      )
      .eq('questionnaire_instances.user_id', userId)
      .in('questionnaire_instances.questionnaire_definitions.code', ['PHQ9', 'GAD7', 'ASQ'])
      .order('created_at', { ascending: false })
      .limit(18),

    // Q4: open risk events
    supabase
      .from('risk_events')
      .select('risk_type, severity, created_at')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(10),

    // Q5: previous closed session
    supabase
      .from('clinical_sessions')
      .select('closed_at, closure_reason')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Q6: open pending tasks
    supabase
      .from('patient_tasks')
      .select('id, descripcion, estado, created_at')
      .eq('user_id', userId)
      .in('estado', ['pendiente', 'parcial'])
      .order('created_at', { ascending: false })
      .limit(10),

    // Q7: count of closed sessions
    supabase
      .from('clinical_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'closed'),

    // Patient profile (displayName, birth_date)
    supabase
      .from('user_profiles')
      .select('display_name, birth_date')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (validatedRow.error) throw validatedRow.error
  if (tierBRow.error) throw tierBRow.error
  if (questionnaireRows.error) throw questionnaireRows.error
  if (riskRows.error) throw riskRows.error
  if (prevSessionRow.error) throw prevSessionRow.error
  if (pendingTaskRows.error) throw pendingTaskRows.error
  if (sessionCountRow.error) throw sessionCountRow.error
  if (profileRow.error) throw profileRow.error

  // ── Patient profile ──────────────────────────────────────────────────────
  const displayName = profileRow.data?.display_name ?? null
  const age = computeAge(profileRow.data?.birth_date ?? null, now)

  // ── Tier + validated assessment ──────────────────────────────────────────
  let tier: PatientContextTier = 'none'
  let validated: PatientContext['validated'] = null

  const vRow = validatedRow.data
  if (vRow && vRow.reviewed_at) {
    const ageInDays = floorDays(nowMs, vRow.reviewed_at)
    const parsed = AssessmentSchema.safeParse(vRow.summary_json)
    if (!parsed.success) {
      console.error('[buildPatientContext] AssessmentSchema parse failed for validated assessment', {
        assessmentId: vRow.id,
        error: parsed.error,
      })
      // Fall through: treat as if no validated assessment — tier stays 'none', check tier B below
    } else {
      tier = ageInDays <= TIER_A_WINDOW_DAYS ? 'tierA' : 'historic'
      validated = {
        reviewedAt: vRow.reviewed_at,
        summary: {
          chief_complaint: parsed.data.chief_complaint,
          presenting_issues: parsed.data.presenting_issues,
          areas_for_exploration: parsed.data.areas_for_exploration,
          risk_assessment: parsed.data.risk_assessment,
          questionnaires: parsed.data.questionnaires,
        },
        ageInDays,
      }
    }
  }

  // ── Tier B draft ─────────────────────────────────────────────────────────
  // Only populated when no tier-A or historic validated assessment exists.
  // Historic assessments block tier B because the clinician has already
  // reviewed the patient — a stale review beats an AI draft.
  let tierBDraft: PatientContext['tierBDraft'] = null
  if (tier === 'none') {
    const bRow = tierBRow.data
    if (bRow) {
      const closedAt = bRow.clinical_sessions?.closed_at ?? null
      if (closedAt) {
        const parsed = AssessmentSchema.safeParse(bRow.summary_json)
        if (!parsed.success) {
          console.error(
            '[buildPatientContext] AssessmentSchema parse failed for tier-B draft assessment',
            { error: parsed.error },
          )
          // Skip tier B — leave tier as 'none'
        } else {
          tier = 'tierB'
          tierBDraft = {
            closedAt,
            summary: {
              chief_complaint: parsed.data.chief_complaint,
              presenting_issues: parsed.data.presenting_issues,
              questionnaires: parsed.data.questionnaires,
            },
          }
        }
      }
    }
  }

  // ── Recent questionnaires ────────────────────────────────────────────────
  type QRow = {
    total_score: number
    severity_band: string
    created_at: string
    questionnaire_instances: {
      questionnaire_definitions: { code: string } | { code: string }[] | null
    } | null
  }

  const allowedCodes = new Set(['PHQ9', 'GAD7', 'ASQ'])
  const byCode = new Map<string, Array<{ score: number; band: string; scoredAt: string }>>()

  for (const row of (questionnaireRows.data ?? []) as QRow[]) {
    const qi = row.questionnaire_instances
    if (!qi) continue
    const defRaw = qi.questionnaire_definitions
    const code = Array.isArray(defRaw) ? defRaw[0]?.code : defRaw?.code
    if (!code || !allowedCodes.has(code)) continue

    const existing = byCode.get(code) ?? []
    existing.push({ score: row.total_score, band: row.severity_band, scoredAt: row.created_at })
    byCode.set(code, existing)
  }

  const recentQuestionnaires: PatientContext['recentQuestionnaires'] = []
  for (const [code, entries] of byCode.entries()) {
    if (entries.length === 0) continue
    const latest = entries[0]!
    const previous = entries[1] ?? null
    recentQuestionnaires.push({
      code: code as 'PHQ9' | 'GAD7' | 'ASQ',
      score: latest.score,
      band: latest.band,
      scoredAt: latest.scoredAt,
      deltaVsPrevious: previous !== null ? latest.score - previous.score : null,
    })
  }

  // ── Open risk events ─────────────────────────────────────────────────────
  const openRiskEvents: PatientContext['openRiskEvents'] = (riskRows.data ?? []).map((r) => ({
    severity: r.severity,
    createdAt: r.created_at,
    riskType: r.risk_type,
  }))

  // ── Previous closed session ──────────────────────────────────────────────
  let previousSession: PatientContext['previousSession'] = null
  if (prevSessionRow.data?.closed_at) {
    previousSession = {
      closedAt: prevSessionRow.data.closed_at,
      closureReason: prevSessionRow.data.closure_reason,
      daysAgo: floorDays(nowMs, prevSessionRow.data.closed_at),
    }
  }

  // ── Pending tasks ────────────────────────────────────────────────────────
  const pendingTasks: PatientContext['pendingTasks'] = (pendingTaskRows.data ?? [])
    .filter(
      (t): t is typeof t & { estado: 'pendiente' | 'parcial' } =>
        t.estado === 'pendiente' || t.estado === 'parcial',
    )
    .map((t) => ({
      id: t.id,
      descripcion: t.descripcion,
      estado: t.estado,
      acordadaEn: t.created_at,
    }))

  // ── Session number ───────────────────────────────────────────────────────
  const closedCount = sessionCountRow.count ?? 0
  const sessionNumber = closedCount + 1

  // ── isFirstSession ───────────────────────────────────────────────────────
  // True only when there is absolutely no prior history: no assessment and no
  // prior closed sessions. A patient with closed sessions but no assessment
  // is returning, not first-time.
  const isFirstSession = tier === 'none' && sessionNumber === 1

  // ── Risk state ───────────────────────────────────────────────────────────
  // Only tier-A validated assessments feed the risk derivation. Historic
  // assessments are too old to represent current clinician judgment.
  const riskState = derivePatientRiskState({
    lastValidatedAssessment:
      tier === 'tierA' && validated
        ? { reviewedAt: validated.reviewedAt, suicidality: validated.summary.risk_assessment.suicidality }
        : null,
    openRiskEvents: openRiskEvents.map((e) => ({ severity: e.severity, createdAt: e.createdAt })),
    previousSession: previousSession
      ? { closedAt: previousSession.closedAt, closureReason: previousSession.closureReason }
      : null,
    now,
  })

  return {
    tier,
    isFirstSession,
    patient: { displayName, age },
    validated,
    tierBDraft,
    recentQuestionnaires,
    openRiskEvents,
    previousSession,
    pendingTasks,
    sessionNumber,
    riskState,
  }
}
