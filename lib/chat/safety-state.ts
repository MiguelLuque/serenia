import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { textContainsSafetyCheck } from './safety-check-history'

type Supabase = SupabaseClient<Database>

/**
 * Plan 7 T3a v2 — modelo tipado del estado del cribado de seguridad
 * en la sesión actual.
 *
 * El bug que motivó este módulo: tras un ASQ con todos los items "No"
 * (severity_band='negative'), la IA volvía a preguntar textualmente por
 * seguridad 5 turnos después porque el prompt no tenía regla explícita
 * que dijera "el ASQ ya cubrió esto, no repitas". El detector léxico
 * tampoco triggeaba en el turno donde reaparecía la pregunta — el LLM
 * la disparaba mirando memoria del chat sin que nada le frenara.
 *
 * Solución: derivar un `SafetyState` discriminado a partir de BD primero
 * (questionnaire_instances + questionnaire_results + questionnaire_answers)
 * y caer al fallback heurístico léxico solo si BD no aporta nada. El
 * caller (`buildCrisisNotice`) traduce ese estado a la variante de
 * notice apropiada.
 *
 * Failsafe: cualquier error de BD se traga (console.error) y devuelve
 * `never_assessed`. La función NUNCA lanza — el chat no se rompe por un
 * fallo aquí. Mismo contrato que `hasPriorSafetyCheck`.
 */
export type SafetyState =
  | { kind: 'never_assessed' }
  | { kind: 'asq_proposed_pending'; proposedAt: string }
  | { kind: 'asq_negative'; scoredAt: string; coversAcuteIdeation: boolean }
  | { kind: 'asq_positive_non_acute'; scoredAt: string; flags: unknown[] }
  | { kind: 'asq_acute_risk'; scoredAt: string; flags: unknown[] }
  | {
      kind: 'textual_check_completed'
      lastAssistantCheckAt: string
      lastPatientResponseAt: string | null
    }

interface QuestionnaireFlag {
  reason: string
  itemOrder: number
}

/**
 * Normalize the JSON `flags_json` blob (which Supabase exposes as `Json`)
 * to a typed array we can iterate. Anything we can't parse becomes `[]`.
 */
function parseFlags(raw: unknown): QuestionnaireFlag[] {
  if (!Array.isArray(raw)) return []
  const out: QuestionnaireFlag[] = []
  for (const entry of raw) {
    if (
      entry &&
      typeof entry === 'object' &&
      'reason' in entry &&
      typeof (entry as { reason: unknown }).reason === 'string'
    ) {
      const reason = (entry as { reason: string }).reason
      const itemOrderRaw = (entry as { itemOrder?: unknown }).itemOrder
      const itemOrder = typeof itemOrderRaw === 'number' ? itemOrderRaw : 0
      out.push({ reason, itemOrder })
    }
  }
  return out
}

/**
 * Type guard for the small subset of UIMessage parts we care about
 * (text-shaped entries inside `messages.parts` JSON).
 */
function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return ''
  const chunks: string[] = []
  for (const part of parts) {
    if (
      part &&
      typeof part === 'object' &&
      'type' in part &&
      (part as { type: unknown }).type === 'text' &&
      'text' in part &&
      typeof (part as { text: unknown }).text === 'string'
    ) {
      chunks.push((part as { text: string }).text)
    }
  }
  return chunks.join('\n')
}

/**
 * Fallback heurístico: BD no aportó nada. Buscamos el último mensaje
 * `assistant` que matchee `textContainsSafetyCheck` en la sesión, y
 * exigimos al menos un mensaje `user` posterior para considerar el
 * check "completado" (si no, fue abandonado y no cuenta).
 */
async function deriveTextualCheckState(
  supabase: Supabase,
  sessionId: string,
): Promise<SafetyState> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, parts, created_at')
    .eq('session_id', sessionId)
    .in('role', ['assistant', 'user'])
    .order('created_at', { ascending: true })

  if (error || !data) return { kind: 'never_assessed' }

  let lastAssistantCheckAt: string | null = null
  let lastPatientResponseAt: string | null = null

  for (const row of data) {
    if (row.role === 'assistant') {
      const text = extractTextFromParts(row.parts)
      if (textContainsSafetyCheck(text)) {
        lastAssistantCheckAt = row.created_at
        // Reset patient response: a new assistant check resets the cycle.
        lastPatientResponseAt = null
      }
    } else if (row.role === 'user' && lastAssistantCheckAt) {
      // First user message AFTER the most recent assistant check.
      if (!lastPatientResponseAt) {
        lastPatientResponseAt = row.created_at
      }
    }
  }

  if (lastAssistantCheckAt && lastPatientResponseAt) {
    return {
      kind: 'textual_check_completed',
      lastAssistantCheckAt,
      lastPatientResponseAt,
    }
  }

  // Asistente preguntó pero el paciente no respondió → check abandonado,
  // tratamos como `never_assessed` (no contamos checks colgando).
  return { kind: 'never_assessed' }
}

/**
 * Deriva el `SafetyState` actual de la sesión.
 *
 * Lógica:
 *  1. Query a `questionnaire_instances` filtrada por la sesión y por
 *     `created_at >= openedAt` (descendente). El ASQ más reciente gana
 *     y se mapea a la variante apropiada según su scoring.
 *  2. Si no hay ASQ relevante, caemos al fallback heurístico textual
 *     sobre `messages` (último assistant que dijo "Línea 024" / "estás
 *     a salvo" + al menos una respuesta user posterior).
 *  3. Cualquier error → `never_assessed` con `console.error`.
 *
 * Decisión deliberada: NO contemplamos `phq9_item9_clean` ni una
 * variante "PHQ-9 item 9 ≥ 1 → positive_non_acute". El bug observado
 * es solo de ASQ. YAGNI: si el smoke vuelve a destapar el problema con
 * PHQ-9, abrimos tarea aparte.
 */
export async function getSessionSafetyState(
  supabase: Supabase,
  sessionId: string,
  openedAt: string,
): Promise<SafetyState> {
  try {
    // 1. Buscamos el cuestionario más reciente (cualquier estado relevante)
    //    de la sesión actual.
    const { data: instances, error: instancesError } = await supabase
      .from('questionnaire_instances')
      .select(
        'id, questionnaire_id, status, created_at, scored_at',
      )
      .eq('session_id', sessionId)
      .gte('created_at', openedAt)
      .in('status', ['proposed', 'in_progress', 'scored'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (instancesError) {
      console.error('[safety-state] questionnaire_instances query failed', instancesError)
      return { kind: 'never_assessed' }
    }

    if (instances) {
      // Definition lookup (necesitamos el `code` para distinguir ASQ).
      const { data: definition, error: defError } = await supabase
        .from('questionnaire_definitions')
        .select('code')
        .eq('id', instances.questionnaire_id)
        .single()

      if (defError || !definition) {
        console.error('[safety-state] questionnaire_definitions query failed', defError)
        // Caemos al fallback textual por si ASQ no es identificable.
        return await deriveTextualCheckState(supabase, sessionId)
      }

      // Pending (proposed / in_progress) — solo nos importa para ASQ.
      if (instances.status !== 'scored') {
        if (definition.code === 'ASQ') {
          return {
            kind: 'asq_proposed_pending',
            proposedAt: instances.created_at,
          }
        }
        // PHQ-9 / GAD-7 propuestos sin contestar no afectan al cribado
        // de seguridad — caemos al fallback textual.
        return await deriveTextualCheckState(supabase, sessionId)
      }

      // status === 'scored'
      if (definition.code === 'ASQ') {
        const { data: result, error: resultError } = await supabase
          .from('questionnaire_results')
          .select('severity_band, flags_json')
          .eq('instance_id', instances.id)
          .single()

        if (resultError || !result) {
          console.error('[safety-state] questionnaire_results query failed', resultError)
          return { kind: 'never_assessed' }
        }

        const flags = parseFlags(result.flags_json)
        const acute = flags.some((f) => f.reason === 'acute_risk')
        const scoredAt = instances.scored_at ?? instances.created_at

        if (acute) {
          return {
            kind: 'asq_acute_risk',
            scoredAt,
            flags,
          }
        }

        if (result.severity_band === 'positive') {
          return {
            kind: 'asq_positive_non_acute',
            scoredAt,
            flags,
          }
        }

        if (result.severity_band === 'negative') {
          // ¿Cubrió el item 5 (ideación aguda)? Comprobamos si hay
          // answer para el item con order_index=5 del ASQ.
          const { data: items, error: itemsError } = await supabase
            .from('questionnaire_items')
            .select('id, order_index')
            .eq('questionnaire_id', instances.questionnaire_id)
            .eq('order_index', 5)
            .limit(1)
            .maybeSingle()

          if (itemsError) {
            console.error('[safety-state] questionnaire_items query failed', itemsError)
            return {
              kind: 'asq_negative',
              scoredAt,
              coversAcuteIdeation: false,
            }
          }

          let coversAcuteIdeation = false
          if (items?.id) {
            const { data: answer, error: answerError } = await supabase
              .from('questionnaire_answers')
              .select('id')
              .eq('instance_id', instances.id)
              .eq('item_id', items.id)
              .limit(1)
              .maybeSingle()

            if (answerError) {
              console.error('[safety-state] questionnaire_answers query failed', answerError)
            } else {
              coversAcuteIdeation = Boolean(answer?.id)
            }
          }

          return {
            kind: 'asq_negative',
            scoredAt,
            coversAcuteIdeation,
          }
        }

        // Banda inesperada → tratar como negativo conservador.
        return {
          kind: 'asq_negative',
          scoredAt,
          coversAcuteIdeation: false,
        }
      }

      // Cualquier otro cuestionario scored (PHQ-9, GAD-7) cae al
      // fallback textual: pueden coexistir con un check textual de
      // seguridad.
      return await deriveTextualCheckState(supabase, sessionId)
    }

    // 2. Sin instancia relevante → fallback heurístico textual.
    return await deriveTextualCheckState(supabase, sessionId)
  } catch (err) {
    console.error('[safety-state] unexpected error', err)
    return { kind: 'never_assessed' }
  }
}
