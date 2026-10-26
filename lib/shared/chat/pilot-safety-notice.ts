import type { CrisisDetection } from './crisis-detector'
import { buildCrisisNotice } from './crisis-notice'
import type { SafetyState } from './safety-state'
import { SAFETY_RESOURCES } from '../safety-resources'

// Clinical criteria/actions stay canonical. Only operational claims change:
// - a review request is not a promise of delivery or a same-day SLA;
// - a crisis tool needs no patient acceptance, but its success must be checked;
// - requesting closure is not evidence of closure or clinician notification.
const OPERATIONAL_REPLACEMENTS: Array<[string, string]> = [
  ['el psicólogo verá los resultados del C-SSRS', 'los resultados del C-SSRS quedan como información para la revisión clínica, sin garantizar cuándo se realizará'],
  ['Marca esta sesión para que el psicólogo referente la priorice.', 'Solicita revisión clínica prioritaria por el circuito disponible, sin afirmar que ya se ha realizado.'],
  ['Marca la sesión para REVISIÓN CLÍNICA EL MISMO DÍA por el psicólogo referente.', 'Solicita revisión clínica prioritaria por el circuito disponible, sin prometer un plazo de atención.'],
  ['marca para revisión clínica inmediata', 'solicita revisión clínica urgente por el circuito disponible'],
  ['La sesión se cierra en este turno; el psicólogo referente recibe alerta URGENTE.', 'Confirma el cierre solo si la herramienta devuelve closed: true; si no lo confirma, informa de que el cierre no se ha completado y mantén el apoyo urgente. No prometas una notificación al psicólogo.'],
  ['NUNCA confirmes un cierre por crisis: es single-step.', 'No pidas aceptación del paciente para el cierre por crisis; confirma el resultado solo si la herramienta lo acredita.'],
  ['NUNCA confirmes el cierre con el paciente: es single-step.', 'No pidas aceptación del paciente para el cierre por crisis; confirma el resultado solo si la herramienta lo acredita.'],
]

function operationallyFaithfulNotice(notice: string): string {
  if (!notice) return ''
  const adapted = OPERATIONAL_REPLACEMENTS.reduce((text, [original, replacement]) => text.replaceAll(original, replacement), notice)
  return `${adapted}No afirmes que se ha enviado una alerta, realizado una revisión o cerrado la sesión sin un resultado que lo confirme. No prometas plazos de atención ni contactos que no consten disponibles.\n\n---\n\n`
}

function pilotStateNotice(state: SafetyState): string {
  if (state.kind === 'never_assessed') return ''
  if (state.kind === 'cssrs_high_risk' || state.kind === 'cssrs_acute_risk') {
    return operationallyFaithfulNotice(buildCrisisNotice({ safetyState: state, crisis: { detected: false, matchedTerms: [] } }))
  }
  const stateDescription = {
    cssrs_pending: '[C-SSRS PROPUESTO PENDIENTE]\nHay un cuestionario de seguridad pendiente. NO propongas otro cuestionario ni añadas una entrevista rutinaria paralela sólo para repetir lo ya preguntado.',
    cssrs_negative: '[CONTEXTO DE SEGURIDAD — C-SSRS NEGATIVO YA APLICADO]\nHay un resultado negativo disponible; no equivale a ausencia de riesgo actual ni permite inventar respuestas a ítems.',
    cssrs_low_risk: '[CONTEXTO DE SEGURIDAD — C-SSRS BAJO RIESGO]\nHay un resultado de banda baja disponible; conserva el dato y su periodo sin convertirlo en garantía sobre el presente.',
    cssrs_moderate_risk: '[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO MODERADO]\nHay un resultado de banda moderada disponible; necesita contexto y revisión, sin afirmar una atención ya realizada.',
    textual_check_completed: '[CONTEXTO DE SEGURIDAD — CHECK TEXTUAL YA REALIZADO]\nSe detectó una pregunta textual y una respuesta posterior. Lee qué respondió realmente: su mera existencia no acredita evaluación suficiente ni que la duda quedara resuelta.',
  }[state.kind]
  return `${stateDescription}
Este estado previo no veta una aclaración focalizada o recursos ante preocupación actual fundada, aunque no se haya relatado un plan o medios. Atiende esa información sin esperar a que se complete o rechace un formulario. Una negación previa no descarta información nueva. No repitas una evaluación sólo por una palabra emocional; distingue contexto, corrección y preocupación nueva. Cuando corresponda, ofrece la ${SAFETY_RESOURCES.suicide.name}; ante peligro inmediato indica ${SAFETY_RESOURCES.emergency.phone}.
No afirmes que se ha enviado una alerta, realizado una revisión o cerrado la sesión sin confirmación. No prometas plazos ni contactos.
---
`
}

/**
 * Conversation instructions for the supervised, fictitious-case pilot.
 * This is not a classifier: it neither confirms nor dismisses a lexical signal.
 * Admission flags and SQL remain unchanged, including the automatic
 * suicidal_ideation/high event. This notice does not retract that event or
 * establish that an alert, review or closure has actually happened.
 */
export function buildPilotSafetyNotice(input: { crisis: CrisisDetection; safetyState: SafetyState }): string {
  const { crisis, safetyState } = input
  // Preserve the canonical state instructions without converting a label into
  // the categorical RE-ESCALADA override. Structured high/acute criteria and
  // actions stay last; operational wording never claims unconfirmed delivery.
  const stateNotice = pilotStateNotice(safetyState)
  if (!crisis.detected) return stateNotice

  return `[OBSERVACIÓN AUTOMÁTICA DE SEGURIDAD — PILOTO SUPERVISADO]
El detector ha encontrado una observación léxica sin confirmar (${crisis.matchedTerms.join(', ')}). La coincidencia por sí sola no confirma ideación, intención, plan ni urgencia clínica. Tampoco equivale a una valoración clínica ya realizada.

Lee el historial y el mensaje actual antes de interpretar la expresión: identifica el sujeto (paciente u otra persona), la temporalidad (actual o histórica), si es una cita o una mención informativa, el objeto de la frase y cualquier corrección del paciente. No atribuyas al paciente una experiencia ajena ni confundas una aclaración con una señal nueva.
Una negación o una corrección no garantiza la ausencia de riesgo. Si falta aclarar algo relevante, valida y formula una pregunta focalizada que tenga en cuenta lo ya contestado. No repitas rutinariamente el cribado sólo por la palabra, pero atiende una preocupación actual fundada sin esperar al formulario pendiente.
Si aparece una señal NUEVA Y fundada de riesgo actual, prioriza la seguridad frente a la agenda. Si persiste una duda relevante, aclárala sin declararla resuelta. Cuando corresponda por la evaluación y el estado estructurado, ofrece la ${SAFETY_RESOURCES.suicide.name} (${SAFETY_RESOURCES.suicide.description}); si hay peligro inmediato, indica ${SAFETY_RESOURCES.emergency.phone} (${SAFETY_RESOURCES.emergency.description}). No retrases la atención urgente para completar un cuestionario.
Si el contexto aclara el sentido de la mención y no hay una señal actual pendiente de evaluar ni instrucciones de riesgo alto/agudo, reconoce la corrección y retoma la demanda o el tema actual del paciente. Eso no autoriza a afirmar que está a salvo ni a dar por descartado el riesgo.
Las instrucciones del estado de seguridad que siguen prevalecen: este aviso no cambia bandas, cortes ni los requisitos de riesgo alto/agudo, y una aclaración léxica no los degrada. No afirmes que se ha enviado una alerta, realizado una revisión o cerrado la sesión si la operación no está confirmada.

---

${stateNotice}`
}
