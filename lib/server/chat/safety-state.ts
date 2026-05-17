import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { textContainsSafetyCheck } from '@/lib/shared/chat/safety-check-history'
import type { SafetyState } from '@/lib/shared/chat/safety-state'

export type { SafetyState }

type Supabase = SupabaseClient<Database>

/**
 * Plan 7 T3a v2 (original) + Plan 8 Fase 2 (2026-05-17, rename ASQ→C-SSRS).
 *
 * Deriva el `SafetyState` discriminado a partir de BD
 * (questionnaire_instances + questionnaire_results) o, si no hay cribado
 * estructurado, cae al fallback heurístico léxico sobre `messages`.
 *
 * El bug original (Plan 7): tras un cribado con todos los items "No", la
 * IA volvía a preguntar por seguridad 5 turnos después porque el prompt
 * no tenía regla explícita que dijera "el cribado ya cubrió esto, no
 * repitas". Solución: estado tipado que el caller (`buildCrisisNotice`)
 * traduce a la variante de notice apropiada.
 *
 * En Plan 8 Fase 2 reemplazamos ASQ por C-SSRS con 5 bandas y override
 * behaviorRecent (ítem 6b). ASQ sigue en BD durante T1.4 + Fase 2; T1.7
 * lo borra. Mientras coexistan, este módulo solo branchea en CSSRS — una
 * instancia ASQ residual caería al fallback textual (defensivo).
 *
 * Failsafe: cualquier error de BD se traga (console.error) y devuelve
 * `never_assessed`. La función NUNCA lanza — el chat no se rompe por un
 * fallo aquí.
 */
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
 *     `created_at >= openedAt` (descendente). El C-SSRS más reciente gana
 *     y se mapea a la variante apropiada según su scoring (severity_band
 *     + flag `acute_risk` para detectar override behaviorRecent).
 *  2. Si no hay C-SSRS relevante, caemos al fallback heurístico textual
 *     sobre `messages` (último assistant que dijo "Línea 024" / "estás
 *     a salvo" + al menos una respuesta user posterior).
 *  3. Cualquier error → `never_assessed` con `console.error`.
 *
 * Decisión deliberada: NO contemplamos `phq9_item9_clean` ni una variante
 * "PHQ-9 item 9 ≥ 1 → low_risk". El bug observado era de cribado dedicado.
 * Si reaparece, abrimos tarea aparte.
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
      // Definition lookup (necesitamos el `code` para distinguir C-SSRS).
      const { data: definition, error: defError } = await supabase
        .from('questionnaire_definitions')
        .select('code')
        .eq('id', instances.questionnaire_id)
        .single()

      if (defError || !definition) {
        console.error('[safety-state] questionnaire_definitions query failed', defError)
        // Caemos al fallback textual por si C-SSRS no es identificable.
        return await deriveTextualCheckState(supabase, sessionId)
      }

      // Pending (proposed / in_progress) — solo nos importa para C-SSRS.
      if (instances.status !== 'scored') {
        if (definition.code === 'CSSRS') {
          return {
            kind: 'cssrs_pending',
            proposedAt: instances.created_at,
          }
        }
        // PHQ-9 / GAD-7 / otros propuestos sin contestar no afectan al
        // cribado de seguridad — caemos al fallback textual.
        return await deriveTextualCheckState(supabase, sessionId)
      }

      // status === 'scored'
      if (definition.code === 'CSSRS') {
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
        const scoredAt = instances.scored_at ?? instances.created_at

        // Override behaviorRecent: flag con reason=acute_risk e itemOrder=7
        // (ítem 6b). Distingue del flag suicidality del 5/6 lifetime.
        const behaviorRecent = flags.some(
          (f) => f.reason === 'acute_risk' && f.itemOrder === 7,
        )

        switch (result.severity_band) {
          case 'acute_risk':
            return {
              kind: 'cssrs_acute_risk',
              scoredAt,
              flags,
              behaviorRecent,
            }
          case 'high_risk':
            return { kind: 'cssrs_high_risk', scoredAt }
          case 'moderate_risk':
            return { kind: 'cssrs_moderate_risk', scoredAt }
          case 'low_risk':
            return { kind: 'cssrs_low_risk', scoredAt }
          case 'negative':
            return { kind: 'cssrs_negative', scoredAt }
          default:
            // Banda inesperada → tratar como negativo conservador.
            return { kind: 'cssrs_negative', scoredAt }
        }
      }

      // Cualquier otro cuestionario scored (PHQ-9, GAD-7, BDI-II, BAI)
      // cae al fallback textual: pueden coexistir con un check textual.
      return await deriveTextualCheckState(supabase, sessionId)
    }

    // 2. Sin instancia relevante → fallback heurístico textual.
    return await deriveTextualCheckState(supabase, sessionId)
  } catch (err) {
    console.error('[safety-state] unexpected error', err)
    return { kind: 'never_assessed' }
  }
}
