import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { AssessmentSchema, type AssessmentSummary } from '@/lib/server/assessments/generator'
import { type PatientRiskState, derivePatientRiskState } from '@/lib/server/risk-rules'
import { listCodes, type QuestionnaireCode } from '@/lib/shared/questionnaires/registry'
import type { ProtocolPhase } from '@/lib/shared/protocol/render-phase'
import { computeAge } from '@/lib/shared/age'
import { PronounsSchema, type Pronouns } from '@/lib/shared/onboarding/schema'

export type PatientContextTier = 'none' | 'historic' | 'tierB' | 'tierA'

/**
 * Plan 8 T3.4 — intake clínico mínimo del paciente, capturado en el
 * onboarding (Fase 3). `null` si el paciente todavía no completó el
 * onboarding (informalName vacío y pronouns null en la BD).
 */
export type PatientIntake = {
  informalName: string
  pronouns: Pronouns | null
  birthDate: string | null
  reasonForConsulting: string | null
}

export type PatientContext = {
  tier: PatientContextTier
  isFirstSession: boolean
  patient: { displayName: string | null; age: number | null }
  intake: PatientIntake | null
  validated: {
    id: string
    reviewedAt: string
    observedAt: string
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
    code: QuestionnaireCode
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
  /**
   * Fase actual del protocolo TCC/ACT (1-8). Se pasa explícitamente desde
   * el caller (chat route) — tomada de la `SessionRow.protocol_phase` ya
   * cargada — en lugar de derivarse del session count, para evitar
   * duplicar lógica y mantener al builder testeable.
   */
  protocolPhase: ProtocolPhase
  /**
   * `true` cuando el paciente ya cerró ≥ 8 sesiones (es decir, completó el
   * protocolo y está en fase de mantenimiento). El renderer usa este flag
   * para decidir entre `renderProtocolPhaseBlock(phase)` y
   * `renderProtocolMaintenanceBlock()`.
   */
  protocolCompleted: boolean
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const TIER_A_WINDOW_DAYS = 90

function floorDays(nowMs: number, dateStr: string): number {
  return Math.floor((nowMs - new Date(dateStr).getTime()) / MS_PER_DAY)
}

/**
 * Parse the raw `pronouns` value from `user_profiles` (typed as
 * `string | null` in the generated supabase types because the column is
 * a free-form text in BD) through the canonical `PronounsSchema`. Returns
 * `null` if the value isn't one of the four allowed enum members.
 *
 * Defensive: a typo or a manual edit in the DB shouldn't break the chat
 * stream — the worst case is the intake block omits the line "Pronombres".
 */
function parsePronouns(raw: string | null): Pronouns | null {
  if (raw === null) return null
  const result = PronounsSchema.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Plan 6 T6 — build the patient context snapshot consumed by `/api/chat` when
 * `FEATURE_CROSS_SESSION_CONTEXT` is on.
 *
 * The route rebuilds this context for each admitted turn. A review, task or
 * risk event committed between turns can therefore change the tier and
 * notices in the same session. It is not a session-start cache or a live
 * subscription. The independent reads below are also not a transactional
 * snapshot; authorization and writes retain their own server/SQL fences.
 * Repeated context supplies evidence, not an instruction to repeat feedback.
 */
export type BuildPatientContextOptions = {
  supabase: SupabaseClient<Database>
  userId: string
  /**
   * ID de la sesión activa. El builder no lo usa hoy en las queries
   * (todas son por `userId`) pero forma parte del contrato Plan 8 T5.2-bis
   * para que el caller pase un snapshot consistente y los logs tengan
   * trazabilidad por sesión.
   */
  sessionId: string
  /**
   * Plan 8 T5.2-bis — la fase del protocolo TCC/ACT viene del caller a
   * partir de `SessionRow.protocol_phase` (ya cargada en el chat route)
   * en lugar de derivarse aquí. Decisión explícita: aísla el cálculo,
   * facilita los tests y evita un `Math.min(closedCount + 1, 8)` duplicado
   * que se desincronizaría con `lib/sessions/service.ts#computeProtocolPhase`.
   */
  protocolPhase: ProtocolPhase
  now?: Date
}

export async function buildPatientContext(
  options: BuildPatientContextOptions,
): Promise<PatientContext> {
  const { supabase, userId, protocolPhase, now = new Date() } = options
  // sessionId is part of the contract; reserved for future per-session queries.
  void options.sessionId
  const nowMs = now.getTime()

  const [
    validatedRow,
    tierBRow,
    questionnaireRows,
    riskRows,
    criticalRiskRow,
    highRiskRow,
    prevSessionRow,
    pendingTaskRows,
    sessionCountRow,
    profileRow,
  ] = await Promise.all([
    // Q1: latest validated closure by session observation, not signature date
    supabase
      .from('assessments')
      .select('id, session_id, reviewed_at, summary_json, observed_session:clinical_sessions!assessments_session_id_fkey!inner(id, user_id, status, closed_at)')
      .eq('assessment_type', 'closure')
      .eq('observed_session.user_id', userId)
      .eq('observed_session.status', 'closed')
      .not('observed_session.closed_at', 'is', null)
      .not('reviewed_at', 'is', null)
      .in('status', ['reviewed_confirmed', 'reviewed_modified'])
      .eq('user_id', userId)
      .order('observed_session(closed_at)', { ascending: false, nullsFirst: false })
      .order('session_id', { ascending: false })
      .order('reviewed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Q2: latest unreviewed draft from a closed session. Rejected reports
    // must not re-enter the conversation as if still awaiting review.
    supabase
      .from('assessments')
      .select('summary_json, observed_session:clinical_sessions!assessments_session_id_fkey!inner(user_id, closed_at, status)')
      .eq('assessment_type', 'closure')
      .eq('observed_session.user_id', userId)
      .eq('status', 'draft_ai')
      .eq('user_id', userId)
      .eq('observed_session.status', 'closed')
      .not('observed_session.closed_at', 'is', null)
      .order('observed_session(closed_at)', { ascending: false, nullsFirst: false })
      .order('session_id', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Q3: recent questionnaires
    supabase
      .from('questionnaire_results')
      .select(
        'total_score, severity_band, created_at, questionnaire_instances!inner(user_id, questionnaire_definitions!inner(code))',
      )
      .eq('questionnaire_instances.user_id', userId)
      .in('questionnaire_instances.questionnaire_definitions.code', listCodes() as unknown as string[])
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

    // Bounded global probes preserve policy inputs outside the ten details.
    // Details already include latestOpen; these retain anyCritical/latestHigh.
    supabase.from('risk_events').select('severity, created_at')
      .eq('user_id', userId).eq('status', 'open').eq('severity', 'critical')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('risk_events').select('severity, created_at')
      .eq('user_id', userId).eq('status', 'open').eq('severity', 'high')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),

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

    // Patient profile (displayName, birth_date, intake fields)
    supabase
      .from('user_profiles')
      .select('display_name, birth_date, informal_name, pronouns, reason_for_consulting')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (validatedRow.error) throw validatedRow.error
  if (tierBRow.error) throw tierBRow.error
  if (questionnaireRows.error) throw questionnaireRows.error
  if (riskRows.error) throw riskRows.error
  if (criticalRiskRow.error) throw criticalRiskRow.error
  if (highRiskRow.error) throw highRiskRow.error
  if (prevSessionRow.error) throw prevSessionRow.error
  if (pendingTaskRows.error) throw pendingTaskRows.error
  if (sessionCountRow.error) throw sessionCountRow.error
  if (profileRow.error) throw profileRow.error

  // ── Patient profile ──────────────────────────────────────────────────────
  const displayName = profileRow.data?.display_name ?? null
  const age = computeAge(profileRow.data?.birth_date ?? null, now)

  // ── Intake (Plan 8 T3.4) ─────────────────────────────────────────────────
  // El intake clínico se completa en el onboarding (Plan 8 Fase 3). Los
  // campos `informal_name` / `pronouns` / `reason_for_consulting` viven en
  // `user_profiles`. Si el paciente todavía no completó onboarding,
  // `informal_name` queda como '' (NOT NULL con default '') y `pronouns`
  // como NULL. En ese caso devolvemos `intake = null` y el renderer omite
  // el bloque entero — sin lógica de fallback que tape la ausencia.
  const informalNameRaw = profileRow.data?.informal_name ?? ''
  const pronounsRaw = profileRow.data?.pronouns ?? null
  const intake: PatientIntake | null =
    informalNameRaw === '' && pronounsRaw === null
      ? null
      : {
          informalName: informalNameRaw,
          pronouns: parsePronouns(pronounsRaw),
          birthDate: profileRow.data?.birth_date ?? null,
          reasonForConsulting: profileRow.data?.reason_for_consulting ?? null,
        }

  // ── Tier + validated assessment ──────────────────────────────────────────
  let tier: PatientContextTier = 'none'
  let validated: PatientContext['validated'] = null

  const vRow = validatedRow.data
  if (vRow?.reviewed_at && vRow.observed_session?.closed_at) {
    const observedAt = vRow.observed_session.closed_at
    const ageInDays = floorDays(nowMs, observedAt)
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
        id: vRow.id,
        reviewedAt: vRow.reviewed_at,
        observedAt,
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
      const closedAt = bRow.observed_session?.closed_at ?? null
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

  const allowedCodes = new Set<string>(listCodes())
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
      code: code as QuestionnaireCode,
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

  // ── Protocolo TCC/ACT (Plan 8 T5.2-bis) ──────────────────────────────────
  // `protocolPhase` viene del caller (chat route), tomado de la SessionRow
  // ya cargada — único punto de verdad. `protocolCompleted` se deriva del
  // closedCount: tras 8 sesiones cerradas el paciente entra en mantenimiento.
  const protocolCompleted = closedCount >= 8

  // ── Risk state ───────────────────────────────────────────────────────────
  // Only tier-A validated assessments feed the risk derivation. Historic
  // observations are too old to represent current patient state.
  const riskState = derivePatientRiskState({
    lastValidatedAssessment:
      tier === 'tierA' && validated
        ? { observedAt: validated.observedAt, suicidality: validated.summary.risk_assessment.suicidality }
        : null,
    openRiskEvents: [
      ...openRiskEvents.map((e) => ({ severity: e.severity, createdAt: e.createdAt })),
      ...[criticalRiskRow.data, highRiskRow.data].flatMap(e => e ? [{ severity: e.severity, createdAt: e.created_at }] : []),
    ],
    previousSession: previousSession
      ? { closedAt: previousSession.closedAt, closureReason: previousSession.closureReason }
      : null,
    now,
  })

  return {
    tier,
    isFirstSession,
    patient: { displayName, age },
    intake,
    validated,
    tierBDraft,
    recentQuestionnaires,
    openRiskEvents,
    previousSession,
    pendingTasks,
    sessionNumber,
    riskState,
    protocolPhase,
    protocolCompleted,
  }
}
