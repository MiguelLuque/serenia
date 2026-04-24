import { generateObject } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/types'
import { llm } from '@/lib/llm/models'
import { loadPromptFromMarkdown } from '@/lib/llm/prompts/loader'

type Supabase = SupabaseClient<Database>
type AssessmentRow = Database['public']['Tables']['assessments']['Row']

const MIN_USER_MESSAGES = 3
const MAX_TRANSCRIPT_MESSAGES = 60

export const ProposedTaskSchema = z.object({
  descripcion: z.string().min(3).max(500),
  // `nullable` (not `optional`) so the JSON schema emits `nota` inside
  // `required` — OpenAI structured-output strict mode rejects schemas where
  // `required` does not list every property in `properties`.
  nota: z.string().max(300).nullable(),
})
export type ProposedTask = z.infer<typeof ProposedTaskSchema>

const AssessmentCore = z.object({
  chief_complaint: z.string(),
  presenting_issues: z.array(z.string()),
  mood_affect: z.string(),
  cognitive_patterns: z.array(z.string()),
  risk_assessment: z.object({
    suicidality: z.enum(['none', 'passive', 'active', 'acute']),
    self_harm: z.enum(['none', 'historic', 'current']),
    notes: z.string(),
  }),
  questionnaires: z.array(
    z.object({
      code: z.string(),
      score: z.number(),
      band: z.string(),
      flags: z.array(
        z.object({ itemOrder: z.number(), reason: z.string() }),
      ),
    }),
  ),
  areas_for_exploration: z.array(z.string()),
  preliminary_impression: z.string(),
  recommended_actions_for_clinician: z.array(z.string()),
  patient_facing_summary: z.string(),
})

// Schema used by `generateObject` for OpenAI strict structured outputs: every
// property must appear in `required`, so `proposed_tasks` has NO default here.
// The LLM is instructed to emit an empty array when no tasks are proposed.
export const AssessmentGenerationSchema = AssessmentCore.extend({
  proposed_tasks: z.array(ProposedTaskSchema),
})

// Schema used at load boundaries (parsing stored `summary_json`). Legacy rows
// that predate Plan 6 lack `proposed_tasks`; default to [] so those rows
// continue to parse.
export const AssessmentSchema = AssessmentCore.extend({
  proposed_tasks: z.array(ProposedTaskSchema).default([]),
})

export type AssessmentSummary = z.infer<typeof AssessmentSchema>

export class AssessmentSkippedError extends Error {
  constructor(public reason: 'session_too_short' | 'no_session' | 'already_exists') {
    super(`Assessment skipped: ${reason}`)
  }
}

export async function generateAssessment(
  supabase: Supabase,
  sessionId: string,
): Promise<AssessmentRow> {
  const { data: session, error: sessionError } = await supabase
    .from('clinical_sessions')
    .select('id, user_id, conversation_id, opened_at, closed_at, closure_reason')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    throw new AssessmentSkippedError('no_session')
  }

  const { data: existing } = await supabase
    .from('assessments')
    .select('id')
    .eq('session_id', sessionId)
    .eq('assessment_type', 'closure')
    .maybeSingle()

  if (existing) {
    throw new AssessmentSkippedError('already_exists')
  }

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
    throw new AssessmentSkippedError('session_too_short')
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
    .eq('session_id', sessionId)
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
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const riskBlocks = (riskRows ?? []).map(
    (r) =>
      `- ${r.created_at}: ${r.risk_type} (${r.severity}) from ${r.source_type}`,
  )

  const closureNote = session.closure_reason
    ? `Cierre de sesión: ${session.closure_reason}.`
    : 'Sesión sin motivo de cierre registrado.'

  const userPrompt = [
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
  ].join('\n')

  const systemPrompt = loadPromptFromMarkdown(
    'docs/agents/prompts/clinical-report.md',
  )

  const { object: summary, usage } = await generateObject({
    model: llm.structured(),
    schema: AssessmentGenerationSchema,
    system: systemPrompt,
    prompt: userPrompt,
  })

  console.info('[assessment] generated', {
    sessionId,
    usage,
  })

  const { data: inserted, error: insertError } = await supabase
    .from('assessments')
    .insert({
      user_id: session.user_id,
      session_id: session.id,
      assessment_type: 'closure',
      status: 'draft_ai',
      generated_by: 'ai',
      summary_json: summary as unknown as Json,
    })
    .select()
    .single()

  if (insertError) throw insertError
  return inserted
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
