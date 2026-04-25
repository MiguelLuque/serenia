import { generateObject } from 'ai'
import { FatalError } from 'workflow'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/types'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { llm } from '@/lib/llm/models'
import { loadPromptFromMarkdown } from '@/lib/llm/prompts/loader'
import {
  AssessmentGenerationSchema,
  type AssessmentSummary,
} from '@/lib/assessments/generator'

type Supabase = SupabaseClient<Database>

const MIN_USER_MESSAGES = 3
const MAX_TRANSCRIPT_MESSAGES = 60

export type RejectionContext = {
  rejectionReason: string
  clinicalNotes: string | null
}

export type GenerateAssessmentInput = {
  sessionId: string
  rejectionContext?: RejectionContext
}

type LoadedSession = {
  id: string
  user_id: string
  conversation_id: string
  closure_reason: string | null
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

/**
 * Background generation of the closure assessment for a clinical session.
 *
 * Pipeline:
 *   1. loadClosedSessionStep    → confirm session is closed; bail if missing.
 *   2. assessmentExistsStep     → idempotency: bail if a closure row exists.
 *   3. generateAssessmentStep   → build prompt + call LLM. Retried on errors.
 *   4. persistAssessmentStep    → insert row with status='draft_ai'.
 *
 * On final failure of (3) after retries, the catch block invokes
 * `recordManualReviewStep` to insert a row with status='requires_manual_review'
 * so the clinician can regenerate from the inbox.
 */
export async function generateAssessmentWorkflow(
  input: GenerateAssessmentInput,
) {
  'use workflow'

  const { sessionId, rejectionContext } = input

  console.info('[assessment-workflow]', {
    sessionId,
    step: 'workflow_started',
    hasRejectionContext: Boolean(rejectionContext),
  })

  const session = await loadClosedSessionStep(sessionId)
  if (!session) {
    console.info('[assessment-workflow]', {
      sessionId,
      step: 'session_not_found_or_open',
      action: 'terminate',
    })
    return { status: 'skipped' as const, reason: 'no_session' as const }
  }

  const exists = await assessmentExistsStep(sessionId)
  if (exists) {
    console.info('[assessment-workflow]', {
      sessionId,
      step: 'already_exists',
      action: 'terminate',
    })
    return { status: 'skipped' as const, reason: 'already_exists' as const }
  }

  let summary: AssessmentSummary
  try {
    summary = await generateAssessmentStep(session, rejectionContext)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[assessment-workflow]', {
      sessionId,
      step: 'generate_failed_final',
      error: message,
    })
    await recordManualReviewStep(session, message)
    return { status: 'manual_review' as const, error: message }
  }

  await persistAssessmentStep(session, summary)
  console.info('[assessment-workflow]', {
    sessionId,
    step: 'completed',
  })
  return { status: 'completed' as const }
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/**
 * Reads the clinical session by id using service-role. Returns null if the
 * session does not exist or is still open.
 *
 * Marked retryable for transient DB hiccups but `FatalError` on missing rows
 * to avoid 3 retries when the session simply was not found.
 */
export async function loadClosedSessionStep(
  sessionId: string,
): Promise<LoadedSession | null> {
  'use step'

  const supabase = serviceClient()
  const { data, error } = await supabase
    .from('clinical_sessions')
    .select('id, user_id, conversation_id, status, closure_reason')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  if (data.status !== 'closed') {
    // Don't retry — the workflow was enqueued before close was committed,
    // or the row got reopened. Either way, generating an assessment would be
    // wrong. Treat as a soft skip.
    console.info('[assessment-workflow]', {
      sessionId,
      step: 'session_not_closed',
      status: data.status,
    })
    return null
  }
  return {
    id: data.id,
    user_id: data.user_id,
    conversation_id: data.conversation_id,
    closure_reason: data.closure_reason,
  }
}

/**
 * Idempotency check: returns true if a "live" closure assessment already
 * exists for this session.
 *
 * "Live" means status NOT IN ('superseded', 'rejected') — i.e. only rows
 * that should block a regeneration. This MUST stay in sync with the partial
 * unique index `assessments_session_closure_live_unique` defined in
 * migration 20260424000004, which enforces at-most-one-live row per session
 * at the BD level. The persist step traps 23505 as a safety net.
 *
 * Why filter out `rejected` and `superseded`:
 *  - When a clinician rejects a draft, T-B's regenerate flow marks it as
 *    `superseded` and enqueues this workflow. If we counted rejected /
 *    superseded rows here, the workflow would short-circuit on
 *    `already_exists` and never produce the new draft — bug that closes the
 *    rejection-regeneration loop.
 *  - Plan 5's edit flow already uses `superseded` as the audit-history
 *    marker for prior versions; we never want a superseded row to block a
 *    new live draft.
 */
export async function assessmentExistsStep(
  sessionId: string,
): Promise<boolean> {
  'use step'

  const supabase = serviceClient()
  const { data, error } = await supabase
    .from('assessments')
    .select('id')
    .eq('session_id', sessionId)
    .eq('assessment_type', 'closure')
    .not('status', 'in', '("superseded","rejected")')
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

/**
 * Build the user prompt from the transcript + questionnaires + risk events,
 * then call the LLM and return the validated structured summary.
 *
 * Retryable on any error (network, LLM 5xx, schema validation transient
 * issues). Throws `FatalError` only if there are not enough user messages —
 * retrying won't fix a too-short session.
 */
export async function generateAssessmentStep(
  session: LoadedSession,
  rejectionContext?: RejectionContext,
): Promise<AssessmentSummary> {
  'use step'

  const supabase = serviceClient()

  const { data: msgRows, error: msgError } = await supabase
    .from('messages')
    .select('role, parts, created_at')
    .eq('conversation_id', session.conversation_id)
    .eq('visible_to_user', true)
    .order('created_at', { ascending: true })

  if (msgError) throw msgError

  const messages = msgRows ?? []
  const userMessageCount = messages.filter((m) => m.role === 'user').length
  if (userMessageCount < MIN_USER_MESSAGES) {
    throw new FatalError(
      `Session ${session.id} has only ${userMessageCount} user messages; min is ${MIN_USER_MESSAGES}`,
    )
  }

  const transcript = messages
    .slice(-MAX_TRANSCRIPT_MESSAGES)
    .map((m) => {
      const text = extractText(m.parts)
      const speaker = m.role === 'user' ? 'Paciente' : 'Serenia'
      return `${speaker}: ${text}`
    })
    .filter((line) => line.length > 0)
    .join('\n')

  const { data: qInstances } = await supabase
    .from('questionnaire_instances')
    .select('id, questionnaire_id, status')
    .eq('session_id', session.id)
    .eq('status', 'scored')

  const questionnaireBlocks: string[] = []
  for (const qi of qInstances ?? []) {
    const [{ data: def }, { data: result }] = await Promise.all([
      supabase
        .from('questionnaire_definitions')
        .select('code, name')
        .eq('id', qi.questionnaire_id)
        .single(),
      supabase
        .from('questionnaire_results')
        .select('total_score, severity_band, flags_json')
        .eq('instance_id', qi.id)
        .maybeSingle(),
    ])
    if (!def || !result) continue
    const flags = Array.isArray(result.flags_json) ? result.flags_json : []
    questionnaireBlocks.push(
      `- ${def.code} (${def.name}): puntuación ${result.total_score}, banda ${result.severity_band}, flags ${JSON.stringify(flags)}`,
    )
  }

  const { data: riskRows } = await supabase
    .from('risk_events')
    .select('risk_type, severity, source_type, created_at, payload_json')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  const riskBlocks = (riskRows ?? []).map(
    (r) =>
      `- ${r.created_at}: ${r.risk_type} (${r.severity}) from ${r.source_type}`,
  )

  const closureNote = session.closure_reason
    ? `Cierre de sesión: ${session.closure_reason}.`
    : 'Sesión sin motivo de cierre registrado.'

  const sections = [
    closureNote,
    '',
    '## Transcripción (últimos mensajes)',
    transcript || '(sin transcripción)',
    '',
    '## Resultados de cuestionarios',
    questionnaireBlocks.length > 0
      ? questionnaireBlocks.join('\n')
      : '(ninguno en esta sesión)',
    '',
    '## Eventos de riesgo',
    riskBlocks.length > 0 ? riskBlocks.join('\n') : '(ninguno)',
  ]

  if (rejectionContext) {
    sections.push('', '## Contexto de regeneración (informe rechazado previamente)')
    sections.push(`Motivo del rechazo: ${rejectionContext.rejectionReason}`)
    if (rejectionContext.clinicalNotes) {
      sections.push(`Notas del clínico: ${rejectionContext.clinicalNotes}`)
    }
  }

  const userPrompt = sections.join('\n')
  const systemPrompt = loadPromptFromMarkdown(
    'docs/agents/prompts/clinical-report.md',
  )

  const { object: summary, usage } = await generateObject({
    model: llm.structured(),
    schema: AssessmentGenerationSchema,
    system: systemPrompt,
    prompt: userPrompt,
  })

  console.info('[assessment-workflow]', {
    sessionId: session.id,
    step: 'generate_succeeded',
    usage,
  })

  return summary as AssessmentSummary
}
generateAssessmentStep.maxRetries = 3

/**
 * Insert the generated assessment as a draft. If a duplicate insert race
 * occurs (e.g. a stale-session cron fired while the user-triggered close also
 * enqueued the workflow), gracefully treat it as success.
 */
export async function persistAssessmentStep(
  session: LoadedSession,
  summary: AssessmentSummary,
): Promise<void> {
  'use step'

  const supabase = serviceClient()
  const { error } = await supabase.from('assessments').insert({
    user_id: session.user_id,
    session_id: session.id,
    assessment_type: 'closure',
    status: 'draft_ai',
    generated_by: 'ai',
    summary_json: summary as unknown as Json,
  })

  if (error) {
    if (isUniqueViolation(error)) {
      console.info('[assessment-workflow]', {
        sessionId: session.id,
        step: 'persist_duplicate_ignored',
      })
      return
    }
    throw error
  }
}

/**
 * Final-failure recovery: persist a row with status='requires_manual_review'
 * so the clinician's inbox surfaces this session and can regenerate manually
 * (T-B will wire the regenerate CTA).
 */
export async function recordManualReviewStep(
  session: LoadedSession,
  errorMessage: string,
): Promise<void> {
  'use step'

  const supabase = serviceClient()
  const failurePayload = {
    generation_failure: {
      error: errorMessage,
      occurred_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase.from('assessments').insert({
    user_id: session.user_id,
    session_id: session.id,
    assessment_type: 'closure',
    status: 'requires_manual_review',
    generated_by: 'ai',
    summary_json: failurePayload as unknown as Json,
  })

  if (error) {
    if (isUniqueViolation(error)) {
      console.info('[assessment-workflow]', {
        sessionId: session.id,
        step: 'manual_review_duplicate_ignored',
      })
      return
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serviceClient(): Supabase {
  // The workflow runs outside the request scope. Always service-role.
  return createServiceRoleClient()
}

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

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const code = (err as { code?: unknown }).code
  return code === '23505'
}
