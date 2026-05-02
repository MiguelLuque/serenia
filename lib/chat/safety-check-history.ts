/**
 * Plan 7 T3a — anti-repetición de safety check (heurística textual).
 *
 * `textContainsSafetyCheck` matchea frases canónicas con las que el prompt
 * instruye al modelo a comprobar riesgo (Línea 024, "estás a salvo",
 * "hacerte daño", "pensando en suicidarte", etc.). Lo consume
 * `lib/chat/safety-state.ts` como fallback cuando no hay datos clínicos
 * en BD (ASQ no scored).
 *
 * Diseño: prefiere FALSO POSITIVO ("ya hice check") sobre falso negativo —
 * es preferible que el LLM peque de no-insistir que de insistir.
 */

const SAFETY_CHECK_PATTERNS: RegExp[] = [
  /L[ií]nea\s*024/i,
  /hacerte\s+da[ñn]o/i,
  /est[áa]s\s+a\s+salvo/i,
  /pensando\s+en\s+suicid/i,
  /pensando\s+en\s+hacerte/i,
  /quiero\s+asegurarme\s+de\s+que\s+est[áa]s\s+a\s+salvo/i,
]

export function textContainsSafetyCheck(text: string): boolean {
  if (!text) return false
  for (const pattern of SAFETY_CHECK_PATTERNS) {
    if (pattern.test(text)) return true
  }
  return false
}
