import type { SafetyState } from './safety-state'

/**
 * Plan 7 T3a v2 — construye el bloque `crisisNotice` que se prepende al
 * system prompt según el estado del cribado de seguridad y el resultado
 * del detector léxico.
 *
 * El módulo es función pura: no toca BD, no logea, no observa entorno.
 * Todas las decisiones se toman a partir del `SafetyState` y de
 * `crisis.detected` / `crisis.matchedTerms`.
 *
 * Variantes (ver tests para cobertura exhaustiva):
 *  1. never_assessed + sin crisis     → string vacío
 *  2. never_assessed + crisis         → "[AVISO DE SEGURIDAD — POSIBLE SEÑAL]"
 *  3. asq_negative                    → "[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]"
 *  4. asq_positive_non_acute          → "[CONTEXTO DE SEGURIDAD — ASQ POSITIVO NO AGUDO]"
 *  5. asq_acute_risk                  → "[RESULTADO DE CUESTIONARIO — ASQ — RIESGO AGUDO]"
 *  6. asq_proposed_pending            → "[ASQ PROPUESTO PENDIENTE]"
 *  7. textual_check_completed         → "[CONTEXTO DE SEGURIDAD — CHECK TEXTUAL YA REALIZADO]"
 *
 * Override `[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]`: cuando el cribado
 * está completado de forma no-aguda (asq_negative / asq_positive_non_acute /
 * textual_check_completed) PERO el detector léxico capta un término del
 * subgrupo "alta señal" (verbalización categórica e inequívoca de plan o
 * método), prependeamos el bloque RE-ESCALADA. La variante acute prevalece
 * y NO se degrada con override.
 */

export interface CrisisNoticeInput {
  safetyState: SafetyState
  crisis: { detected: boolean; matchedTerms: string[] }
}

/**
 * Subgrupo "alta señal" — labels en `lib/chat/crisis-detector.ts` que
 * corresponden a verbalización categórica de plan, método o intención
 * directa. Reaparición de palabras emocionales del registro de ánimo bajo
 * (p.ej. "acabar con todo", "desaparecer para siempre", "no quiero vivir")
 * NO entra en este subgrupo: son ambiguas y, tras un cribado negativo,
 * se quedan acknowledgeable sin re-preguntar.
 *
 * Mantenido en sincronía con `CRISIS_PATTERNS` en `crisis-detector.ts`.
 * Cualquier label nuevo "alta señal" debe añadirse aquí Y allí.
 */
const HIGH_SIGNAL_LABELS = new Set<string>([
  'suicid',
  'quitarme/quitarse la vida',
  'matar(me|se)',
  'hacerme dano',
  'autolesi(on|onarme)',
  'cortarme',
  'tirarme (desde|por)',
])

function hasHighSignalTerm(matchedTerms: string[]): boolean {
  return matchedTerms.some((label) => HIGH_SIGNAL_LABELS.has(label))
}

function reEscalationBlock(matchedTerms: string[]): string {
  return `[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]
El cribado anterior dio negativo o no agudo, pero la verbalización actual del paciente es categóricamente distinta y específica (términos detectados: ${matchedTerms.join(', ')}). Re-abre el tema de seguridad de forma focalizada, considera ofrecer la Línea 024 textualmente, y considera close_session_crisis si hay plan o medios.

---

`
}

function neverAssessedBlock(matchedTerms: string[]): string {
  return `[AVISO DE SEGURIDAD — POSIBLE SEÑAL]
El último mensaje contiene palabras que pueden indicar riesgo emocional (${matchedTerms.join(', ')}). Lee el contexto antes de decidir si hace falta un check de seguridad: si el paciente las usa hablando de estrés laboral, conflicto relacional o sobrecarga emocional general, NO conviertas eso en check de suicidio. Solo activa el protocolo de seguridad (validar, ofrecer la Línea 024 textualmente, marcar la sesión para revisión del psicólogo, considerar close_session_crisis) si la verbalización del paciente sugiere ideación suicida directa, plan, intención o medios concretos. NUNCA confirmes un cierre por crisis: es single-step.

---

`
}

function asqNegativeBlock(coversAcuteIdeation: boolean): string {
  const item5Clause = coversAcuteIdeation
    ? ' y "No" al item 5 ("¿estás pensando en suicidarte ahora mismo?")'
    : ''

  return `[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]
Hoy ya aplicaste un cribado ASQ y el paciente respondió "No" a las preguntas 1-4 (incluyendo "¿pensando en hacerte daño?" y "¿pensado en suicidarte alguna vez?")${item5Clause}. El cribado clínico ha cubierto la duda en esta sesión.

Reglas vinculantes:
- NO repitas la pregunta textual de seguridad ("¿estás pensando en hacerte daño?", "¿estás a salvo?", "¿pensando en quitarte la vida?") solo porque reaparezcan palabras emocionales como "desbordado", "desaparecer", "no aguanto", "todo acabe". Eso ya quedó cribado.
- Solo vuelve a abrir el tema de seguridad si aparece señal NUEVA Y específica: verbalización citable de plan, intención o medios (ej. "esta noche", "tengo X", "ya lo decidí"). Reaparición de vocabulario emocional NO es señal nueva.
- Si reaparece tema de "ganas de que todo acabe" sin plan/intención/medios, acknowledge sin repetir cribado: "antes me dijiste que no estás pensando en hacerte daño, eso me ayuda. Cuéntame más de lo que sientes ahora."
- Para acciones clínicas posteriores (informe, derivación), el psicólogo verá los resultados del ASQ; tu trabajo no es repetir el cribado.

---

`
}

function asqPositiveNonAcuteBlock(): string {
  return `[CONTEXTO DE SEGURIDAD — ASQ POSITIVO NO AGUDO]
Hoy aplicaste un cribado ASQ que dio positivo en alguno de los items 1-4 (seguimiento clínico necesario, NO riesgo agudo — el item 5, "¿estás pensando en suicidarte ahora mismo?", fue "No"). El cribado ha cubierto la pregunta clave de esta sesión.

Reglas vinculantes:
- Acknowledge con tacto el resultado: el psicólogo lo verá y dará seguimiento.
- NO repitas la pregunta textual de seguridad ("¿estás a salvo?", "¿estás pensando en hacerte daño?") solo porque reaparezcan palabras emocionales. Eso ya quedó cribado.
- Solo vuelve a re-preguntar de forma focalizada si aparece señal NUEVA Y específica: verbalización citable de plan, intención o medios concretos.
- Si el paciente trae más material emocional, explora contexto sin volver al cribado: "lo que respondiste antes es importante y tu psicólogo lo va a revisar. Cuéntame más de cómo es eso para ti."

---

`
}

function asqAcuteRiskBlock(): string {
  return `[RESULTADO DE CUESTIONARIO — ASQ — RIESGO AGUDO]
El item 5 del ASQ es positivo. Activa el protocolo de crisis AHORA: valida sin alarmismo, ofrece la Línea 024 textualmente, marca para revisión clínica inmediata, y considera llamar a close_session_crisis si el riesgo es inmediato. NO propongas otros cuestionarios ni sigas la exploración normal. NUNCA confirmes un cierre por crisis: es single-step.

---

`
}

function asqPendingBlock(): string {
  return `[ASQ PROPUESTO PENDIENTE]
En esta sesión propusiste un ASQ que el paciente todavía no ha contestado. Reglas vinculantes:
- NO propongas otro cuestionario en esta sesión.
- NO hagas la pregunta textual de seguridad ("¿estás a salvo?", "¿pensando en hacerte daño?") en paralelo al cuestionario propuesto.
- Espera a que el paciente conteste el ASQ o lo rechace explícitamente. Si rechaza, valida el rechazo con tacto y sigue la conversación sin insistir.

---

`
}

function textualCheckCompletedBlock(): string {
  return `[CONTEXTO DE SEGURIDAD — CHECK TEXTUAL YA REALIZADO]
Ya hiciste una pregunta textual de seguridad en esta sesión y el paciente respondió en el mensaje siguiente. Lee la respuesta antes de re-preguntar. Reglas vinculantes:
- NO vuelvas a preguntar por seguridad solo porque reaparezcan palabras emocionales como "desbordado", "desaparecer", "no aguanto". Eso ya quedó cubierto en el chat.
- Solo vuelve a abrir el tema si aparece señal NUEVA Y específica: verbalización citable de plan, intención o medios concretos. Reaparición de vocabulario emocional NO es señal nueva.
- Si la respuesta del paciente al check fue "no riesgo", valida lo que cuenta y sigue con el tema actual.

---

`
}

export function buildCrisisNotice(input: CrisisNoticeInput): string {
  const { safetyState, crisis } = input

  switch (safetyState.kind) {
    case 'asq_acute_risk':
      // Acute prevalece sobre cualquier otra señal — no se degrada por
      // override RE-ESCALADA (ya está en estado máximo).
      return asqAcuteRiskBlock()

    case 'asq_proposed_pending':
      // Pending: vetamos otra propuesta y otra pregunta textual. Si llega
      // crisis con alta señal, igualmente prevalece la regla de pending —
      // el psicólogo verá la señal en el chat. (No metemos RE-ESCALADA
      // aquí porque el cribado aún no está completado.)
      return asqPendingBlock()

    case 'asq_negative': {
      const base = asqNegativeBlock(safetyState.coversAcuteIdeation)
      if (crisis.detected && hasHighSignalTerm(crisis.matchedTerms)) {
        return reEscalationBlock(crisis.matchedTerms) + base
      }
      return base
    }

    case 'asq_positive_non_acute': {
      const base = asqPositiveNonAcuteBlock()
      if (crisis.detected && hasHighSignalTerm(crisis.matchedTerms)) {
        return reEscalationBlock(crisis.matchedTerms) + base
      }
      return base
    }

    case 'textual_check_completed': {
      const base = textualCheckCompletedBlock()
      if (crisis.detected && hasHighSignalTerm(crisis.matchedTerms)) {
        return reEscalationBlock(crisis.matchedTerms) + base
      }
      return base
    }

    case 'never_assessed':
      if (!crisis.detected) return ''
      return neverAssessedBlock(crisis.matchedTerms)
  }
}
