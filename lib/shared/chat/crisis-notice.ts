import type { SafetyState } from './safety-state'

/**
 * Plan 7 T3a v2 (original) + Plan 8 Fase 2 (2026-05-17, rename ASQ→C-SSRS) —
 * construye el bloque `crisisNotice` que se prepende al system prompt según
 * el estado del cribado de seguridad y el resultado del detector léxico.
 *
 * El módulo es función pura: no toca BD, no logea, no observa entorno.
 * Todas las decisiones se toman a partir del `SafetyState` y de
 * `crisis.detected` / `crisis.matchedTerms`.
 *
 * Variantes (ver tests para cobertura exhaustiva):
 *  1. never_assessed + sin crisis        → string vacío
 *  2. never_assessed + crisis            → "[AVISO DE SEGURIDAD — POSIBLE SEÑAL]"
 *  3. cssrs_negative                     → "[CONTEXTO DE SEGURIDAD — C-SSRS NEGATIVO YA APLICADO]"
 *  4. cssrs_low_risk                     → "[CONTEXTO DE SEGURIDAD — C-SSRS BAJO RIESGO]"
 *  5. cssrs_moderate_risk                → "[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO MODERADO]"
 *  6. cssrs_high_risk                    → "[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO ALTO]"
 *  7. cssrs_acute_risk (lifetime)        → "[RESULTADO C-SSRS — RIESGO AGUDO]"
 *  8. cssrs_acute_risk (behaviorRecent)  → "[RESULTADO C-SSRS — RIESGO AGUDO + CONDUCTA RECIENTE]"
 *  9. cssrs_pending                      → "[C-SSRS PROPUESTO PENDIENTE]"
 * 10. textual_check_completed            → "[CONTEXTO DE SEGURIDAD — CHECK TEXTUAL YA REALIZADO]"
 *
 * Override `[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]`: cuando el cribado
 * está completado de forma no aguda (cssrs_negative / cssrs_low_risk /
 * cssrs_moderate_risk / textual_check_completed) PERO el detector léxico
 * capta un término del subgrupo "alta señal" (verbalización categórica e
 * inequívoca de plan o método), prependeamos el bloque RE-ESCALADA. Las
 * variantes high_risk y acute_risk ya están en máxima severidad y NO se
 * degradan ni añaden override.
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

function cssrsNegativeBlock(): string {
  return `[CONTEXTO DE SEGURIDAD — C-SSRS NEGATIVO YA APLICADO]
Hoy ya aplicaste un cribado C-SSRS y el paciente respondió "No" a las 6 preguntas (incluyendo deseo de morir, ideación pasiva/activa, plan, intención y conducta suicida lifetime). El cribado clínico ha cubierto la duda en esta sesión.

Reglas vinculantes:
- NO repitas la pregunta textual de seguridad ("¿estás pensando en hacerte daño?", "¿estás a salvo?", "¿pensando en quitarte la vida?") solo porque reaparezcan palabras emocionales como "desbordado", "desaparecer", "no aguanto", "todo acabe". Eso ya quedó cribado.
- Solo vuelve a abrir el tema de seguridad si aparece señal NUEVA Y específica: verbalización citable de plan, intención o medios (ej. "esta noche", "tengo X", "ya lo decidí"). Reaparición de vocabulario emocional NO es señal nueva.
- Si reaparece tema de "ganas de que todo acabe" sin plan/intención/medios, acknowledge sin repetir cribado: "antes me dijiste que no estás pensando en hacerte daño, eso me ayuda. Cuéntame más de lo que sientes ahora."
- Para acciones clínicas posteriores (informe, derivación), el psicólogo verá los resultados del C-SSRS; tu trabajo no es repetir el cribado.

---

`
}

function cssrsLowRiskBlock(): string {
  return `[CONTEXTO DE SEGURIDAD — C-SSRS BAJO RIESGO]
Hoy aplicaste un cribado C-SSRS y dio "Sí" en el ítem 1 (deseo de estar muerto/a) y/o el ítem 2 (ideación suicida no específica), sin pensamientos con método, plan ni intención. Es ideación pasiva — significativa clínicamente pero NO situación aguda.

Reglas vinculantes:
- Acknowledge con tacto y curiosidad la ideación pasiva: "lo que me cuentas es importante, vamos a entenderlo mejor". NO actives protocolo de crisis ni ofrezcas la Línea 024 — el cribado descartó el plano agudo.
- Explora función emocional del pensamiento (descanso, alivio, escape) sin asumir lo peor. Identifica red de apoyo del paciente y refuérzala.
- NO repitas la pregunta textual de seguridad por reaparición de palabras emocionales: el cribado granular ya cubrió el plano.
- Solo re-escala (Línea 024 + cierre) si aparece señal NUEVA Y específica de plan, intención o medios.

---

`
}

function cssrsModerateRiskBlock(): string {
  return `[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO MODERADO]
Hoy aplicaste un cribado C-SSRS y dio "Sí" en el ítem 3 (pensamientos sobre cómo llevarlo a cabo, sin plan específico ni intención). Hay método contemplado pero sin plan ni intención: situación que requiere profundización, NO protocolo de crisis inmediato.

Reglas vinculantes:
- Acknowledge la verbalización y profundiza sin alarmismo: "lo que me cuentas es muy importante, cuéntame más". Explora frecuencia, intensidad, factores protectores.
- Refuerza activamente la red de apoyo del paciente (familia, amigos, otros profesionales). Identifica al menos UN contacto seguro al que podría llamar si los pensamientos se intensifican.
- Marca esta sesión para que el psicólogo referente la priorice. NO cierres en crisis salvo señal nueva.
- Solo activa protocolo agudo (Línea 024 + close_session_crisis) si aparece señal NUEVA de intención clara, plan específico o medios.

---

`
}

function cssrsHighRiskBlock(): string {
  return `[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO ALTO]
Hoy aplicaste un cribado C-SSRS y dio "Sí" en el ítem 4 (ideación con cierta intención, sin plan elaborado). Situación clínica de riesgo elevado: la intención de actuar está presente aunque no haya plan estructurado.

Reglas vinculantes:
- Ofrece la Línea 024 textualmente AHORA. Valida sin alarmismo: "lo que me cuentas es serio y quiero asegurarme de que estés en buenas manos".
- Marca la sesión para REVISIÓN CLÍNICA EL MISMO DÍA por el psicólogo referente.
- Verifica explícitamente la red de apoyo del paciente y la posibilidad de que esté con alguien en las próximas horas. Si está solo/a y sin contacto, considera close_session_crisis.
- NO propongas otros cuestionarios ni sigas la exploración normal.

---

`
}

function cssrsAcuteRiskBlock(): string {
  return `[RESULTADO C-SSRS — RIESGO AGUDO]
Hoy aplicaste un cribado C-SSRS y dio "Sí" en el ítem 5 (intención clara con plan específico) y/o el ítem 6 (conducta suicida lifetime). Activa el protocolo de crisis AHORA: valida sin alarmismo, ofrece la Línea 024 textualmente, marca para revisión clínica inmediata, y considera llamar a close_session_crisis si el riesgo es inmediato. NO propongas otros cuestionarios ni sigas la exploración normal. NUNCA confirmes un cierre por crisis: es single-step.

---

`
}

function cssrsAcuteRecentBlock(): string {
  return `[RESULTADO C-SSRS — RIESGO AGUDO + CONDUCTA RECIENTE]
Hoy aplicaste un cribado C-SSRS y dio "Sí" al ítem 6b: el paciente reconoce conducta suicida en los últimos 3 meses. Esto es la máxima severidad clínica del screener.

Acciones obligatorias en este turno:
- Ofrece la Línea 024 textualmente. Valida sin alarmismo: "lo que has compartido es muy serio y me importa asegurarme de que estés en un lugar seguro ahora mismo".
- Llama a close_session_crisis inmediatamente. La sesión se cierra en este turno; el psicólogo referente recibe alerta URGENTE.
- NO propongas otros cuestionarios. NO continúes la exploración terapéutica. NUNCA confirmes el cierre con el paciente: es single-step.

---

`
}

function cssrsPendingBlock(): string {
  return `[C-SSRS PROPUESTO PENDIENTE]
En esta sesión propusiste un C-SSRS que el paciente todavía no ha contestado. Reglas vinculantes:
- NO propongas otro cuestionario en esta sesión.
- NO hagas la pregunta textual de seguridad ("¿estás a salvo?", "¿pensando en hacerte daño?") en paralelo al cuestionario propuesto.
- Espera a que el paciente conteste el C-SSRS o lo rechace explícitamente. Si rechaza, valida el rechazo con tacto y sigue la conversación sin insistir.

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
    case 'cssrs_acute_risk':
      // Acute prevalece sobre cualquier otra señal. Distinguimos el caso
      // behaviorRecent (cierre INMEDIATO + alerta URGENTE) del lifetime.
      return safetyState.behaviorRecent
        ? cssrsAcuteRecentBlock()
        : cssrsAcuteRiskBlock()

    case 'cssrs_high_risk':
      // High risk: protocolo activo. No degrada con override RE-ESCALADA
      // (ya estamos en banda alta).
      return cssrsHighRiskBlock()

    case 'cssrs_pending':
      // Pending: vetamos otra propuesta y otra pregunta textual. Si llega
      // crisis con alta señal, igualmente prevalece la regla de pending —
      // el psicólogo verá la señal en el chat. (No metemos RE-ESCALADA
      // aquí porque el cribado aún no está completado.)
      return cssrsPendingBlock()

    case 'cssrs_negative': {
      const base = cssrsNegativeBlock()
      if (crisis.detected && hasHighSignalTerm(crisis.matchedTerms)) {
        return reEscalationBlock(crisis.matchedTerms) + base
      }
      return base
    }

    case 'cssrs_low_risk': {
      const base = cssrsLowRiskBlock()
      if (crisis.detected && hasHighSignalTerm(crisis.matchedTerms)) {
        return reEscalationBlock(crisis.matchedTerms) + base
      }
      return base
    }

    case 'cssrs_moderate_risk': {
      const base = cssrsModerateRiskBlock()
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
