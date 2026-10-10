import 'server-only'
import { requireOwnedSession } from '@/lib/server/sessions/authorization'
import { validateAnswers } from './validation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/shared/supabase/types'
import type { AnswerInput, ScoringResult } from '@/lib/shared/questionnaires/types'
import { getDefinition, type QuestionnaireCode } from '@/lib/shared/questionnaires/registry'

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
  requestId?: string
  turnToken?: string
}

/**
 * Create a questionnaire instance with status='proposed', triggered_by='ai'.
 * Looks up the questionnaire_definition by code first.
 */
export async function createInstance(
  supabase: Supabase,
  input: CreateInstanceInput,
): Promise<QuestionnaireInstanceRow> {
  const { user, service } = await requireOwnedSession(supabase, input.sessionId, input.conversationId)
  if (input.userId !== user.id) throw new Error('Unauthorized')
  const { data, error } = await service.rpc('create_questionnaire_atomic', {
    p_session_id: input.sessionId, p_user_id: user.id, p_conversation_id: input.conversationId,
    p_code: input.questionnaireCode, p_reason: input.triggerReason,
    ...(input.requestId ? { p_request_id: input.requestId, p_token: input.turnToken } : {}),
  })
  if (error || !data) throw error ?? new Error('Questionnaire not created')
  return data
}

/**
 * Transition an instance from 'proposed' to 'in_progress'.
 */
export async function startInstance(
  supabase: Supabase,
  instanceId: string,
): Promise<void> {
  const { data: instance, error: fetchError } = await supabase.from('questionnaire_instances').select().eq('id', instanceId).single()
  if (fetchError || !instance || !instance.session_id) throw fetchError ?? new Error('Instance not found')
  const { user, service } = await requireOwnedSession(supabase, instance.session_id, instance.conversation_id ?? undefined)
  if (instance.user_id !== user.id) throw new Error('Unauthorized')
  const { error } = await service.rpc('start_questionnaire_atomic', { p_instance_id: instanceId, p_user_id: user.id })
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
    .in('status', ['proposed', 'in_progress'])
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

  if (!instance.session_id || !instance.conversation_id) throw new Error('Instance parent missing')
  const { user, service } = await requireOwnedSession(supabase, instance.session_id, instance.conversation_id)
  if (instance.user_id !== user.id || definition.is_clinician_rated) throw new Error('Unauthorized questionnaire')
  const code = definition.code as QuestionnaireCode
  const normalized = validateAnswers(code, items ?? [], input.answers)
  const scorer = getDefinition(code)
  if (!scorer) throw new Error('Unsupported questionnaire')
  const scoringResult = scorer.scorer(normalized.map(a => a.valueNumeric))
  const acute = scoringResult.flags.some(f => f.reason === 'acute_risk')
  const suicidality = scoringResult.flags.some(f => f.reason === 'suicidality') || (code === 'CSSRS' && scoringResult.severityBand === 'high_risk')
  const { error } = await service.rpc('submit_questionnaire_atomic', {
    p_instance_id: instance.id, p_user_id: user.id,
    p_answers: normalized as unknown as Json, p_result: scoringResult as unknown as Json,
    p_risk_severity: acute ? 'critical' : suicidality ? 'high' : null,
  })
  if (error) throw error
  return scoringResult
}
