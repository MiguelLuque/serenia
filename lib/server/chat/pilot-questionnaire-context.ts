import type { loadQuestionnaireFacts } from '@/lib/server/assessments/questionnaire-facts'

/** A recurring snapshot of actual scored instances, not a delivery receipt.
 * Deliberately no timestamps or "latest only" gate: concurrent scoring will
 * appear on the next admitted turn even if another assistant finished first. */
export function renderPilotQuestionnaireFacts(facts: Awaited<ReturnType<typeof loadQuestionnaireFacts>>): string {
  if (!facts.length) return ''
  return `[CUESTIONARIOS PUNTUADOS DISPONIBLES — PILOTO]
Datos canónicos de todas las instancias puntuadas de esta sesión:
${JSON.stringify(facts.map(({ instanceId, report }) => ({ instanceId, ...report })))}
Su presencia no acredita que el resultado se haya explicado. Lee el historial: devuelve lo pendiente cuando sea pertinente y no repitas una devolución ya realizada. Si pregunta por un resultado, utiliza estos datos.
No se incluyen respuestas de ítems en este bloque: no atribuyas síntomas concretos a un total ni inventes respuestas. Las puntuaciones no establecen diagnósticos. Integra relato, funcionamiento y discrepancias con una aclaración útil. Un flag exige atención contextual de seguridad, no que inventes un acto o intención. No sustituyas la señal nueva actual por un resultado anterior negativo.
---
`
}
