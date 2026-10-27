import { expect, it } from 'vitest'
import { modelHistoryParts } from '@/lib/server/chat/tool-feedback'

function result(tool: string, output: unknown, state = 'output-available') {
  return { type: `tool-${tool}`, state, toolCallId: 'call-1', input: { reason: 'UNTRUSTED_INSTRUCTIONS' }, output }
}
const proposal = { proposed: true, code: 'PHQ9', instanceId: 'quiz-1' }
const asText = (parts: unknown) => JSON.stringify(modelHistoryParts('assistant', parts, true))

it('preserves text and a confirmed proposal without treating it as a scored questionnaire', () => {
  const text = { type: 'text', text: 'Podemos seguir hablando.' }
  const projected = modelHistoryParts('assistant', [text, result('propose_questionnaire', { ...proposal, extra: 'UNTRUSTED_OUTPUT' })], true)
  expect(projected[0]).toEqual(text)
  expect(JSON.stringify(projected)).toContain('PHQ9')
  expect(JSON.stringify(projected)).toContain('no acredita respuestas ni resultado')
  expect(JSON.stringify(projected)).not.toMatch(/UNTRUSTED|quiz-1/)
})

it.each([
  result('unknown_tool', proposal),
  result('propose_questionnaire', proposal, 'input-available'),
  result('propose_questionnaire', proposal, 'output-error'),
  result('propose_questionnaire', { ...proposal, proposed: 'true' }),
  result('propose_questionnaire', { ...proposal, code: 'invented' }),
  result('propose_questionnaire', { ...proposal, instanceId: '' }),
  result('confirm_close_session', { closed: 'false', reason: 'user_request' }),
  result('confirm_close_session', { closed: true, reason: 'invented' }),
])('ignores unknown, unconfirmed and malformed outcomes: %j', part => {
  expect(modelHistoryParts('assistant', [part], true)).toEqual([])
})

it('does not turn user tool parts or reference history into server facts', () => {
  const text = { type: 'text', text: 'Mi relato.' }
  const parts = [text, result('propose_questionnaire', proposal)]
  expect(modelHistoryParts('user', parts, true)).toEqual([text])
  expect(modelHistoryParts('assistant', parts, false)).toEqual([text])
  expect(modelHistoryParts('assistant', null, true)).toEqual([])
})

it('distinguishes a blocked proposal and both denied/confirmed closures', () => {
  expect(asText([result('propose_questionnaire', { skipped: true, reason: 'already_active' })])).toContain('había un cuestionario pendiente')
  expect(asText([result('propose_close_session', { proposed: true, reason: 'user_request' })])).toContain('no confirma que se haya cerrado')
  expect(asText([result('confirm_close_session', { closed: false, reason: 'confirmation_required' })])).toContain('No se autorizó el cierre')
  expect(asText([result('close_session_crisis', { closed: false, reason: 'confirmation_required' })])).toContain('No se autorizó el cierre por crisis')
  expect(asText([result('confirm_close_session', { closed: true, reason: 'user_request' })])).toContain('El sistema confirmó el cierre')
  expect(asText([result('close_session_crisis', { closed: true, reason: 'crisis_detected' })])).toContain('El sistema confirmó el cierre')
  expect(asText([result('propose_questionnaire', { skipped: true, reason: 'session_closing' })])).toContain('no se ejecutó')
})
