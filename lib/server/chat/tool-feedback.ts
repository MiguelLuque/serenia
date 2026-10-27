import 'server-only'
import type { UIMessage } from 'ai'
import { listPatientCodes } from '@/lib/shared/questionnaires/registry'

const questionnaireCodes = new Set<string>(listPatientCodes())
const toolTypes = new Set(['tool-propose_questionnaire', 'tool-propose_close_session', 'tool-confirm_close_session', 'tool-close_session_crisis'])
const ordinaryReasons = new Set(['user_request', 'time_limit'])
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null

function outcomeFact(value: unknown): string | null {
  const part = record(value)
  if (!part || typeof part.type !== 'string' || !toolTypes.has(part.type) || part.state !== 'output-available') return null
  const output = record(part.output)
  if (!output) return null
  if (output.skipped === true) {
    if (output.reason === 'session_closing') return 'La operación no se ejecutó porque el turno ya tenía un cierre autorizado.'
    if (output.reason === 'tool_followup_read_only') return 'La operación no se ejecutó: la continuación sólo podía explicar resultados.'
  }
  if (part.type === 'tool-propose_questionnaire') {
    if (output.skipped === true && output.reason === 'already_active') return 'No se creó otra propuesta porque había un cuestionario pendiente.'
    if (output.proposed === true && typeof output.code === 'string' && questionnaireCodes.has(output.code)
      && typeof output.instanceId === 'string' && output.instanceId.length > 0 && output.instanceId.length <= 128) {
      return `Se creó una propuesta de ${output.code}; eso no acredita respuestas ni resultado.`
    }
  }
  if (part.type === 'tool-propose_close_session' && output.proposed === true && typeof output.reason === 'string' && ordinaryReasons.has(output.reason)) {
    return 'Se registró una propuesta de cierre; no confirma que se haya cerrado.'
  }
  const ordinaryClose = part.type === 'tool-confirm_close_session'
  const crisisClose = part.type === 'tool-close_session_crisis'
  if (ordinaryClose || crisisClose) {
    if (output.closed === false && output.reason === 'confirmation_required') {
      return crisisClose ? 'No se autorizó el cierre por crisis.' : 'No se autorizó el cierre; faltaba una confirmación válida.'
    }
    if (output.closed === true && typeof output.reason === 'string'
      && (ordinaryClose ? ordinaryReasons.has(output.reason) : output.reason === 'crisis_detected')) return 'El sistema confirmó el cierre.'
  }
  return null
}

/** Only server-stored assistant outputs become factual context. Never pass
 * tool arguments, arbitrary fields or unconfirmed results back as instructions. */
export function modelHistoryParts(role: 'user' | 'assistant', raw: unknown, includeToolFeedback: boolean): UIMessage['parts'] {
  if (!Array.isArray(raw)) return []
  const parts: UIMessage['parts'] = raw.flatMap(value => {
    const part = record(value)
    return part?.type === 'text' && typeof part.text === 'string' ? [{ type: 'text' as const, text: part.text }] : []
  })
  if (includeToolFeedback && role === 'assistant') {
    const facts = raw.map(outcomeFact).filter((fact): fact is string => fact !== null)
    if (facts.length) parts.push({ type: 'text', text: `[RESULTADOS DE HERRAMIENTAS DEL SERVIDOR]\n${facts.join('\n')}` })
  }
  return parts
}
