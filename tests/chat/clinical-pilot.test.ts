import { afterEach, expect, it, vi } from 'vitest'
import { chatHarness } from '../helpers/chat-harness'

afterEach(() => vi.unstubAllEnvs())
const pilot = () => vi.stubEnv('FEATURE_CLINICAL_CONVERSATION_PILOT', 'on')

it('lets an ordinary lexical mention and its correction reach persisted context in the pilot', async () => {
  pilot()
  const h = await chatHarness()
  expect((await h.post('Quiero cortarme el pelo.', 'hair')).status).toBe(200)
  expect((await h.post('No, me refiero a cortarme el pelo.', 'clarification')).status).toBe(200)
  expect(h.state.captured).toHaveLength(2)
  expect(JSON.stringify(h.state.captured[1].messages)).toContain('Quiero cortarme el pelo.')
  expect(JSON.stringify(h.state.captured[1].messages)).toContain('No, me refiero a cortarme el pelo.')
  const admissions = h.state.writes.filter(w => w.name === 'begin_chat_turn')
  expect(admissions.map(w => [w.args.p_crisis, w.args.p_urgent])).toEqual([[true, true], [true, true]])
  expect(h.state.session.status).toBe('open')
  expect(h.state.safetyOptions).toEqual([{ strict: true }, { strict: true }])
})

it('keeps the reference bypass with the pilot off', async () => {
  vi.stubEnv('FEATURE_CLINICAL_CONVERSATION_PILOT', 'off')
  const h = await chatHarness()
  expect((await h.post('Quiero cortarme el pelo.')).status).toBe(200)
  expect(h.state.captured).toHaveLength(0)
})

it.each(['historyFailure', 'safetyFailure', 'promptFailure'] as const)('keeps static resources on pilot context failure: %s', async failure => {
  pilot()
  const h = await chatHarness(); h.state[failure] = true
  const response = await h.post('Tengo pensamientos de suicidio.')
  expect(response.status).toBe(200)
  expect(await response.text()).toContain('024')
  expect(h.state.captured).toHaveLength(0)
})

it('keeps the RPC urgent interruption outside the model even in pilot mode', async () => {
  pilot()
  const h = await chatHarness(); h.state.urgentReply = true
  const response = await h.post('Tengo pensamientos de suicidio.')
  expect(response.status).toBe(200)
  expect(await response.text()).toContain('024')
  expect(h.state.captured).toHaveLength(0)
})

it('keeps expiry and replay without another model call in pilot mode', async () => {
  pilot()
  const h = await chatHarness(); h.state.session.opened_at = new Date(Date.now() - 61 * 60_000).toISOString()
  const first = await h.post('Tengo pensamientos de suicidio.')
  const body = await first.text()
  expect(body).toContain('024')
  expect(await (await h.post('Tengo pensamientos de suicidio.')).text()).toBe(body)
  expect(h.state.captured).toHaveLength(0)
})

it('falls back to persisted static resources when pilot generation fails after an accepted signal', async () => {
  pilot()
  const h = await chatHarness(); h.state.generationFailure = true
  const response = await h.post('Tengo pensamientos de suicidio.')
  expect(response.status).toBe(200)
  expect(await response.text()).toContain('024')
  expect(h.state.captured).toHaveLength(1)
  expect(h.state.rows.filter(row => row.role === 'assistant')).toHaveLength(1)
})

it('replays a completed contextual pilot turn without generating again', async () => {
  pilot()
  const h = await chatHarness()
  const body = await (await h.post('Quiero cortarme el pelo.')).text()
  expect(await (await h.post('Quiero cortarme el pelo.')).text()).toBe(body)
  expect(h.state.captured).toHaveLength(1)
})

it('does not give the model crisis-closure authority without the SQL-required evidence', async () => {
  pilot()
  const h = await chatHarness()
  h.state.hook = async options => {
    expect(await options.tools.close_session_crisis.execute({})).toMatchObject({ closed: false })
  }
  expect((await h.post('Quiero hablar del trabajo.')).status).toBe(200)
  expect(h.state.session.status).toBe('open')
})

it('renews the existing proposal after an affirmative natural clarification without closing early', async () => {
  pilot(); const h = await chatHarness()
  h.state.hook = async options => { await options.tools.propose_close_session.execute({ reason: 'user_request' }) }
  await h.post('Quiero terminar.', 'proposal')
  h.state.hook = async options => { await options.tools.confirm_close_session.execute({ reason: 'user_request' }) }
  expect((await h.post('Sí, por hoy ya está, gracias.', 'natural')).status).toBe(200)
  expect(h.state.session.status).toBe('open')
  expect(h.state.proposal).toEqual({ requestId: 'natural', reason: 'user_request' })
  expect((await h.post('Sí, cerramos', 'clear')).status).toBe(200)
  expect(h.state.session.status).toBe('closed')
})

it('preserves the real questionnaire tool result when generation fails after its creation', async () => {
  pilot(); const h = await chatHarness()
  h.state.hook = async options => { await options.tools.propose_questionnaire.execute({ code: 'CSSRS', reason: 'Aclarar una preocupación actual expresada.' }) }
  h.state.generationFailure = true
  const response = await h.post('Estoy pensando en hacerme daño.')
  expect(response.status).toBe(200)
  const body = await response.text()
  expect(body).toContain('tool-output-available')
  const assistant = h.state.rows.find(row => row.role === 'assistant')
  expect(assistant.parts).toContainEqual(expect.objectContaining({ type: 'tool-propose_questionnaire', state: 'output-available', output: { proposed: true, code: 'CSSRS', instanceId: 'quiz' } }))
})
