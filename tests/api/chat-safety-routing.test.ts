import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatHarness } from '../helpers/chat-harness'

const marker = (riskType: string, version = '1') => ({ type: 'data-safety-prompt', data: { version, riskType, requestId: 'prompt-turn' } })
afterEach(() => vi.unstubAllEnvs())

describe('conversation safety routing', () => {
  it('routes contextual keywords through ordinary generation with no event, urgency, notice, or closure', async () => {
    const h = await chatHarness()
    const response = await h.post('Hoy tengo clase sobre suicidio')
    expect(response.status).toBe(200)
    expect(h.state.captured).toHaveLength(1)
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args).toMatchObject({ p_crisis: false, p_urgent: false })
    expect(h.state.turns.get('turn-1').safetyAnswer).toBeNull()
    expect(h.state.session.status).toBe('open')
    expect(h.state.captured[0].system).not.toContain('AVISO DE SEGURIDAD')
  })

  it('records direct suicidal intent with its type and returns deterministic text without generation or crisis closure', async () => {
    const h = await chatHarness()
    const response = await h.post('Voy a suicidarme esta noche')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('024')
    expect(h.state.captured).toHaveLength(0)
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args).toMatchObject({ p_crisis: true, p_direct_risk_type: 'suicidal_ideation', p_urgent: true })
    expect(h.state.writes.find(write => write.name === 'finish_chat_turn')?.args.p_close_reason).toBeUndefined()
    expect(h.state.session.status).toBe('open')
  })

  it('routes direct self-harm with its own type and overrides an outstanding prompt', async () => {
    const h = await chatHarness()
    h.state.rows.push({ id: 'assistant-prompt-turn', role: 'assistant', parts: [marker('suicidal_ideation')] })
    h.state.turns.set('prompt-turn', { request_id: 'prompt-turn', status: 'completed', response_parts: h.state.rows.at(-1).parts })
    h.state.previousRequest = 'prompt-turn'
    const response = await h.post('Voy a hacerme daño esta noche', 'direct-turn')
    expect(response.status).toBe(200)
    expect(h.state.captured).toHaveLength(0)
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args).toMatchObject({ p_crisis: true, p_direct_risk_type: 'self_harm', p_urgent: true, p_safety_answer_required: false })
  })

  it('returns an ambiguous domain question and persists its typed server marker without generation or event', async () => {
    const h = await chatHarness()
    const response = await h.post('No sé si quiero suicidarme')
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('¿Estás pensando en suicidarte ahora?')
    expect(body).toContain('data-safety-prompt')
    expect(h.state.captured).toHaveLength(0)
    const saved = h.state.rows.find(row => row.role === 'assistant')
    expect(saved.parts).toContainEqual({ type: 'data-safety-prompt', data: { version: '1', riskType: 'suicidal_ideation', requestId: 'turn-1' } })
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args).toMatchObject({ p_crisis: false, p_safety_answer_required: false })
  })

  it('asks the self-harm question for an ambiguous self-harm cue', async () => {
    const h = await chatHarness()
    const response = await h.post('No sé si quiero autolesionarme')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('¿Estás pensando en hacerte daño intencionalmente ahora?')
    expect(h.state.rows.find(row => row.role === 'assistant')?.parts).toContainEqual(expect.objectContaining({ type: 'data-safety-prompt', data: expect.objectContaining({ riskType: 'self_harm', version: '1', requestId: 'turn-1' }) }))
  })

  it('derives clarification category and risk type from the immediately previous stored marker', async () => {
    const h = await chatHarness()
    h.state.rows.push({ id: 'assistant-prompt-turn', role: 'assistant', parts: [
      { type: 'text', text: '¿Estás pensando en suicidarte ahora?' }, marker('suicidal_ideation'),
    ] })
    h.state.turns.set('prompt-turn', { request_id: 'prompt-turn', status: 'completed', response_parts: h.state.rows.at(-1).parts })
    const response = await h.post('Sí', 'answer-turn', { safetyPromptRequestId: 'prompt-turn' })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('024')
    expect(h.state.captured).toHaveLength(0)
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args).toMatchObject({
      p_crisis: false, p_safety_answer: 'affirmative',
      p_safety_answer_risk_type: 'suicidal_ideation', p_safety_answer_required: true,
      p_safety_answer_prompt_request_id: 'prompt-turn',
    })
    expect(h.state.rows.at(-1)?.parts).not.toContainEqual(expect.objectContaining({ type: 'data-safety-prompt' }))
  })

  it.each([
    ['No', 'negative', 'Gracias por aclararlo'],
    ['No lo sé', 'unclear', 'No puedo determinar'],
  ] as const)('acknowledges %s without generation or repeating the question', async (text, category, expectedText) => {
    const h = await chatHarness()
    h.state.rows.push({ id: 'assistant-prompt-turn', role: 'assistant', parts: [marker('self_harm')] })
    h.state.turns.set('prompt-turn', { request_id: 'prompt-turn', status: 'completed', response_parts: h.state.rows.at(-1).parts })
    h.state.previousRequest = 'prompt-turn'
    const response = await h.post(text, 'answer-turn', { safetyPromptRequestId: 'prompt-turn' })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain(expectedText)
    expect(h.state.captured).toHaveLength(0)
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args.p_safety_answer).toBe(category)
    expect(h.state.rows.at(-1)?.parts).not.toContainEqual(expect.objectContaining({ type: 'data-safety-prompt' }))
  })

  it('consumes skip and follows the new topic with generation without profile extraction', async () => {
    const h = await chatHarness()
    h.state.rows.push({ id: 'assistant-prompt-turn', role: 'assistant', parts: [marker('self_harm')] })
    h.state.turns.set('prompt-turn', { request_id: 'prompt-turn', status: 'completed', response_parts: h.state.rows.at(-1).parts })
    h.state.previousRequest = 'prompt-turn'
    vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'on')
    const response = await h.post('Cambiemos de tema; quiero hablar del trabajo', 'skip-turn', { safetyPromptRequestId: 'prompt-turn' })
    expect(response.status).toBe(200)
    expect(h.state.captured).toHaveLength(1)
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args.p_safety_answer).toBe('skip')
    expect(h.state.profileAfter).toHaveLength(0)
  })

  it('does not enqueue profile extraction on direct, ambiguous, or marker-answer turns', async () => {
    vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'on')
    const h = await chatHarness()
    await h.post('Voy a suicidarme esta noche', 'direct')
    await h.post('No sé si quiero suicidarme', 'ambiguous')
    h.state.rows.push({ id: 'assistant-prompt-turn', role: 'assistant', parts: [marker('self_harm')] })
    h.state.turns.set('prompt-turn', { request_id: 'prompt-turn', status: 'completed', response_parts: h.state.rows.at(-1).parts })
    h.state.previousRequest = 'prompt-turn'
    await h.post('No lo sé', 'answer', { safetyPromptRequestId: 'prompt-turn' })
    expect(h.state.profileAfter).toHaveLength(0)
    expect(h.enqueueProfileExtraction).not.toHaveBeenCalled()
  })

  it('retries an admitted answer with the stored category and prompt id, then replays the completed response', async () => {
    const h = await chatHarness()
    h.state.rows.push({ id: 'assistant-prompt-turn', role: 'assistant', parts: [marker('suicidal_ideation')] })
    h.state.turns.set('prompt-turn', { request_id: 'prompt-turn', status: 'completed', response_parts: h.state.rows.at(-1).parts })
    h.state.previousRequest = 'prompt-turn'
    h.state.persistFailures = 1
    expect((await h.post('Sí', 'answer-turn', { safetyPromptRequestId: 'prompt-turn' })).status).toBe(503)
    expect(h.state.turns.get('answer-turn')).toMatchObject({ safety_answer: 'affirmative', safety_answer_risk_type: 'suicidal_ideation', previous_request_id: 'prompt-turn' })
    const retry = await h.post('Sí', 'answer-turn', { safetyPromptRequestId: 'prompt-turn' })
    expect(retry.status).toBe(200)
    const body = await retry.text()
    expect(body).toContain('024')
    expect(h.state.writes.filter(write => write.name === 'begin_chat_turn')).toHaveLength(2)
    expect(h.state.writes.filter(write => write.name === 'begin_chat_turn').map(write => [write.args.p_safety_answer, write.args.p_safety_answer_prompt_request_id])).toEqual([['affirmative', 'prompt-turn'], ['affirmative', 'prompt-turn']])
    expect(await (await h.post('Sí', 'answer-turn', { safetyPromptRequestId: 'prompt-turn' })).text()).toBe(body)
  })

  it('reuses the stored answer on an admitted retry even if the text would classify directly now', async () => {
    const h = await chatHarness()
    h.state.turns.set('answer-turn', {
      request_id: 'answer-turn', text: 'Voy a suicidarme esta noche', status: 'failed',
      safety_answer: 'negative', safety_answer_risk_type: 'self_harm', previous_request_id: 'prompt-turn',
    })
    const response = await h.post('Voy a suicidarme esta noche', 'answer-turn', { safetyPromptRequestId: 'prompt-turn' })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Gracias por aclararlo')
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args).toMatchObject({
      p_crisis: false, p_safety_answer: 'negative', p_safety_answer_risk_type: 'self_harm', p_safety_answer_prompt_request_id: 'prompt-turn',
    })
  })

  it('does not bind a stale marker id to a newer prompt', async () => {
    const h = await chatHarness()
    h.state.rows.push({ id: 'assistant-prompt-turn', role: 'assistant', parts: [marker('self_harm')] })
    h.state.turns.set('prompt-turn', { request_id: 'prompt-turn', status: 'completed', response_parts: h.state.rows.at(-1).parts })
    expect((await h.post('Sí', 'answer-turn', { safetyPromptRequestId: 'older-prompt' })).status).toBe(422)
    expect(h.state.captured).toHaveLength(0)
    expect(h.state.turns.has('answer-turn')).toBe(false)
  })

  it('fails closed when the preceding stored-marker read fails', async () => {
    const h = await chatHarness()
    h.state.markerReadFailure = true
    expect((await h.post('No sé si quiero suicidarme')).status).toBe(503)
    expect(h.state.writes).toEqual([])
    expect(h.state.captured).toHaveLength(0)
  })

  it('uses time_limit closure for an explicit signal at the hard boundary while retaining resources', async () => {
    const h = await chatHarness()
    h.state.session.opened_at = new Date(Date.now() - 61 * 60_000).toISOString()
    const response = await h.post('Voy a suicidarme esta noche')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('024')
    expect(h.state.writes.find(write => write.name === 'begin_chat_turn')?.args.p_crisis).toBe(true)
    expect(h.state.writes.find(write => write.name === 'finish_chat_turn')?.args.p_close_reason).toBe('time_limit')
    expect(h.state.session.status).toBe('closed')
    expect(h.state.captured).toHaveLength(0)
  })
})
