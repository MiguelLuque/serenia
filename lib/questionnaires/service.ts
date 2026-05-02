import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/types'
import type { QuestionnaireCode, AnswerInput, ScoringResult } from './types'
import { getDefinition } from './registry'

type Supabase = SupabaseClient<Database>

export type QuestionnaireInstanceRow =
  Database['public']['Tables']['questionnaire_instances']['Row']
export type QuestionnaireDefinitionRow =
  Database['public']['Tables']['questionnaire_definitions']['Row']
export type QuestionnaireItemRow =
  Database['public']['Tables']['questionnaire_items']['Row']
export type QuestionnaireResultRow =
  Database['public']['Tables']['questionnaire_results']['Row']

export interface CreateInstanceInput {
  userId: string
  sessionId: string
  conversationId: string
  questionnaireCode: QuestionnaireCode
  triggerReason: string
}

/**
 * Create a questionnaire instance with status='proposed', triggered_by='ai'.
 * Looks up the questionnaire_definition by code first.
 */
export async function createInstance(
  supabase: Supabase,
  input: CreateInstanceInput,
): Promise<QuestionnaireInstanceRow> {
  const { data: definition, error: defError } = await supabase
    .from('questionnaire_definitions')
    .select()
    .eq('code', input.questionnaireCode)
    .single()

  if (defError) throw defError

  const { data: instance, error: instanceError } = await supabase
    .from('questionnaire_instances')
    .insert({
      user_id: input.userId,
      session_id: input.sessionId,
      conversation_id: input.conversationId,
      questionnaire_id: definition.id,
      triggered_by: 'ai',
      status: 'proposed',
      trigger_reason: input.triggerReason,
    })
    .select()
    .single()

  if (instanceError) throw instanceError

  return instance
}

/**
 * Transition an instance from 'proposed' to 'in_progress'.
 */
export async function startInstance(
  supabase: Supabase,
  instanceId: string,
): Promise<void> {
  const { error } = await supabase
    .from('questionnaire_instances')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', instanceId)
    .eq('status', 'proposed')

  if (error) throw error
}

/**
 * Fetch the most recent active (proposed / in_progress / scored) instance for a session,
 * along with its definition, items, and optional result.
 * Returns null if none found.
 */
export async function getActiveInstanceForSession(
  supabase: Supabase,
  sessionId: string,
): Promise<{
  instance: QuestionnaireInstanceRow
  definition: QuestionnaireDefinitionRow
  items: QuestionnaireItemRow[]
  result: QuestionnaireResultRow | null
} | null> {
  const { data: instance, error: instanceError } = await supabase
    .from('questionnaire_instances')
    .select()
    .eq('session_id', sessionId)
    .in('status', ['proposed', 'in_progress', 'scored'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (instanceError) throw instanceError
  if (!instance) return null

  const { data: definition, error: defError } = await supabase
    .from('questionnaire_definitions')
    .select()
    .eq('id', instance.questionnaire_id)
    .single()

  if (defError) throw defError

  const { data: items, error: itemsError } = await supabase
    .from('questionnaire_items')
    .select()
    .eq('questionnaire_id', instance.questionnaire_id)
    .order('order_index', { ascending: true })

  if (itemsError) throw itemsError

  const { data: result, error: resultError } = await supabase
    .from('questionnaire_results')
    .select()
    .eq('instance_id', instance.id)
    .maybeSingle()

  if (resultError) throw resultError

  return {
    instance,
    definition,
    items: items ?? [],
    result,
  }
}

/**
 * Submit answers for an instance, run scoring, persist results and risk events if needed.
 * Returns the ScoringResult.
 */
export async function submitAnswers(
  supabase: Supabase,
  input: { instanceId: string; answers: AnswerInput[] },
): Promise<ScoringResult> {
  // 1. Fetch instance + definition (for code) + items
  const { data: instance, error: instanceError } = await supabase
    .from('questionnaire_instances')
    .select()
    .eq('id', input.instanceId)
    .single()

  if (instanceError) throw instanceError

  const { data: definition, error: defError } = await supabase
    .from('questionnaire_definitions')
    .select()
    .eq('id', instance.questionnaire_id)
    .single()

  if (defError) throw defError

  const { data: items, error: itemsError } = await supabase
    .from('questionnaire_items')
    .select()
    .eq('questionnaire_id', instance.questionnaire_id)
    .order('order_index', { ascending: true })

  if (itemsError) throw itemsError

  // Build a map from order_index → item_id
  const itemByOrder = new Map<number, QuestionnaireItemRow>()
  for (const item of items ?? []) {
    itemByOrder.set(item.order_index, item)
  }

  // 2. Insert answers
  const answerRows = input.answers.map((a) => {
    const item = itemByOrder.get(a.itemOrder)
    if (!item) throw new Error(`No item found for order_index ${a.itemOrder}`)
    return {
      instance_id: input.instanceId,
      item_id: item.id,
      answer_raw: a.valueRaw,
      answer_numeric: a.valueNumeric,
    }
  })

  const { error: answersError } = await supabase
    .from('questionnaire_answers')
    .insert(answerRows)

  if (answersError) throw answersError

  // 3. Sort answers by order_index and run scoring via the registry.
  // Plan 8 ADR-017: no per-code if/else; getDefinition() resolves the
  // scorer or throws fast for unknown codes.
  const sorted = [...input.answers].sort((a, b) => a.itemOrder - b.itemOrder)
  const numericValues = sorted.map((a) => a.valueNumeric)
  const code = definition.code as QuestionnaireCode

  const def = getDefinition(code)
  if (!def) {
    throw new Error(`Unknown questionnaire code: ${code}`)
  }
  const scoringResult: ScoringResult = def.scorer(numericValues)

  // 4. Insert questionnaire_results
  const { error: resultError } = await supabase
    .from('questionnaire_results')
    .insert({
      instance_id: input.instanceId,
      total_score: scoringResult.totalScore,
      severity_band: scoringResult.severityBand,
      subscores_json: scoringResult.subscores as Json,
      flags_json: scoringResult.flags as unknown as Json,
      requires_review: scoringResult.requiresReview,
    })

  if (resultError) throw resultError

  // 5. Update instance status → scored
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('questionnaire_instances')
    .update({
      status: 'scored',
      submitted_at: now,
      scored_at: now,
    })
    .eq('id', input.instanceId)

  if (updateError) throw updateError

  // 6. Insert a single risk_event with highest applicable severity
  //    - ASQ positive with item 5 = 1  → critical
  //    - ASQ positive without acute   → high
  //    - PHQ-9 item 9 flag            → high
  const hasAcute = scoringResult.flags.some((f) => f.reason === 'acute_risk')
  const hasSuicidality =
    scoringResult.flags.some((f) => f.reason === 'suicidality') ||
    (code === 'ASQ' && scoringResult.severityBand === 'positive')

  if (hasAcute || hasSuicidality) {
    const severity = hasAcute ? 'critical' : 'high'
    const { error: riskError } = await supabase
      .from('risk_events')
      .insert({
        user_id: instance.user_id,
        session_id: instance.session_id,
        conversation_id: instance.conversation_id,
        risk_type: 'suicidal_ideation',
        severity,
        source_type: 'questionnaire',
        payload_json: {
          questionnaire_code: code,
          instance_id: input.instanceId,
          flags: scoringResult.flags as unknown as Json,
          total_score: scoringResult.totalScore,
          severity_band: scoringResult.severityBand,
        } as Json,
      })

    if (riskError) throw riskError
  }

  return scoringResult
}
