import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database>

/**
 * Plan 7 T3a — anti-repetición de safety check.
 *
 * Heurística para detectar si en la sesión actual ya se ha emitido un check
 * de seguridad por parte del asistente. Inspecciona los últimos N mensajes
 * `assistant` y busca cualquiera de las frases canónicas con las que el
 * prompt instruye al modelo a comprobar riesgo (Línea 024, "estás a salvo",
 * "hacerte daño", "pensando en suicidarte", etc.).
 *
 * Diseño: prefiere FALSO POSITIVO ("ya hice check") sobre falso negativo —
 * es preferible que el LLM peque de no-insistir que de insistir. Por eso
 * matchea también menciones informativas como "Línea 024".
 */

const SAFETY_CHECK_PATTERNS: RegExp[] = [
  /L[ií]nea\s*024/i,
  /hacerte\s+da[ñn]o/i,
  /est[áa]s\s+a\s+salvo/i,
  /pensando\s+en\s+suicid/i,
  /pensando\s+en\s+hacerte/i,
  /quiero\s+asegurarme\s+de\s+que\s+est[áa]s\s+a\s+salvo/i,
]

const LOOKBACK = 5

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

export function textContainsSafetyCheck(text: string): boolean {
  if (!text) return false
  for (const pattern of SAFETY_CHECK_PATTERNS) {
    if (pattern.test(text)) return true
  }
  return false
}

/**
 * Returns true iff any of the last `LOOKBACK` assistant messages in the
 * given session contains a safety-check phrase.
 *
 * Errors are swallowed and the function returns `false` — the caller
 * (route.ts) treats this as "no previous check" and falls back to the
 * imperative crisisNotice. This mirrors the existing buildPatientContext
 * try/catch contract: a DB hiccup must never 500 /api/chat.
 */
export async function hasPriorSafetyCheck(
  supabase: Supabase,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('messages')
    .select('parts')
    .eq('session_id', sessionId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(LOOKBACK)

  if (error || !data) return false

  for (const row of data) {
    const text = extractTextFromParts(row.parts)
    if (textContainsSafetyCheck(text)) return true
  }
  return false
}
