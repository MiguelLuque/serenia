import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatHarness } from '../helpers/chat-harness'

const start = Date.parse('2026-10-27T10:00:00Z')
function clock() { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(start) }
function pilot() { vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('FEATURE_CLINICAL_CONVERSATION_PILOT', 'on'); vi.stubEnv('FEATURE_CROSS_SESSION_CONTEXT', 'off') }
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('authoritative session deadline', () => {
  it('always tells the agent the fresh remaining time, without promising a saved closure', async () => {
    clock(); const h = await chatHarness()
    await h.post()
    expect(h.state.captured[0].system).toContain('[TIEMPO DE SESIÓN]')
    expect(h.state.captured[0].system).toContain('60 minutos')
  })
  it('closes an expired admission durably, marks the UI, and replays identically', async () => {
    clock(); const h = await chatHarness(); vi.setSystemTime(start + 60 * 60_000)
    const response = await h.post(); const body = await response.text()
    expect(response.status).toBe(200); expect(h.state.captured).toHaveLength(0)
    expect(body).toContain('data-session-closed'); expect(body).toContain('time_limit')
    expect(h.state.session.status).toBe('closed')
    const { safeValidateUIMessages } = await import('ai')
    expect((await safeValidateUIMessages({ messages: [{ id: 'persisted', role: 'assistant', parts: h.state.rows.find(row => row.role === 'assistant').parts }] })).success).toBe(true)
    expect(await (await h.post()).text()).toBe(body)
  })
  it('does not start generation if context loading crosses the deadline', async () => {
    clock(); const h = await chatHarness()
    h.state.contextHook = async () => { vi.setSystemTime(start + 60 * 60_000) }
    expect((await h.post()).status).toBe(200)
    expect(h.state.captured).toHaveLength(0); expect(h.state.session.status).toBe('closed')
  })
  it('preserves an accepted answer completed after the limit and commits its closure in the same turn', async () => {
    clock(); const h = await chatHarness(); vi.setSystemTime(start + 59 * 60_000); h.state.session.last_activity_at = new Date().toISOString()
    h.state.hook = async () => { vi.setSystemTime(start + 60 * 60_000 + 2000) }
    const response = await h.post(); const body = await response.text()
    expect(body).toContain('Respuesta sintética'); expect(body).toContain('data-session-closed')
    expect(body).toContain('límite de tiempo')
    expect(h.state.writes.find(w => w.name === 'finish_chat_turn').args.p_close_reason).toBe('time_limit')
    expect(h.state.session.status).toBe('closed')
  })
  it('does not start a second generation at the deadline, preserving a committed questionnaire outcome', async () => {
    clock(); pilot(); const h = await chatHarness()
    h.state.hook = async options => {
      await options.tools.propose_questionnaire.execute({ code: 'PHQ9', reason: 'Explorar el ánimo con consentimiento.' })
      vi.setSystemTime(start + 60 * 60_000)
      options.prepareStep({ stepNumber: 1, messages: [], steps: [{ usage: { outputTokens: 5 } }] })
    }
    const response = await h.post(); const body = await response.text()
    expect(response.status).toBe(200); expect(body).toContain('data-session-closed')
    expect(body).toContain('persisted-questionnaire'); expect(h.state.session.status).toBe('closed')
  })
  it('checks time again after the pending-questionnaire read', async () => {
    clock(); pilot(); const h = await chatHarness(); let outcome: unknown
    h.state.questionnaireHook = async () => { vi.setSystemTime(start + 60 * 60_000) }
    h.state.hook = async options => { outcome = await options.tools.propose_questionnaire.execute({ code: 'PHQ9', reason: 'Explorar el ánimo con consentimiento.' }) }
    expect((await h.post()).status).toBe(200)
    expect(outcome).toMatchObject({ skipped: true, reason: 'time_limit' })
    expect(h.state.questionnaireCreations).toHaveLength(0)
  })
  it('resolves inactivity before admitting a new ordinary turn, preserving unsent text on the client', async () => {
    clock(); const h = await chatHarness(); vi.setSystemTime(start + 31 * 60_000)
    const response = await h.post()
    expect(response.status).toBe(422); expect(await response.json()).toMatchObject({ sessionClosed: true })
    expect(h.state.rows).toHaveLength(0); expect(h.state.session.status).toBe('closed')
  })
  it('records a new safety signal even after inactivity, before returning resources', async () => {
    clock(); const h = await chatHarness(); vi.setSystemTime(start + 31 * 60_000)
    const response = await h.post('Voy a matarme esta noche')
    expect(response.status).toBe(200); expect(await response.text()).toContain('024')
    expect(h.state.rows[0].role).toBe('user'); expect(h.state.session.status).toBe('open')
  })
  it('keeps deterministic resources if a contextual safety response finishes past the deadline', async () => {
    clock(); pilot(); const h = await chatHarness()
    h.state.hook = async () => { vi.setSystemTime(start + 60 * 60_000) }
    const response = await h.post('Voy a matarme esta noche'); const body = await response.text()
    expect(body).toContain('Respuesta sintética'); expect(body).toContain('024'); expect(body).toContain('112')
    expect(h.state.writes.find(w => w.name === 'finish_chat_turn').args.p_close_reason).toBe('crisis_detected')
  })
  it('replays a completed request after inactivity without closing or duplicating it', async () => {
    clock(); const h = await chatHarness(); const original = await (await h.post()).text()
    vi.setSystemTime(start + 31 * 60_000)
    expect(await (await h.post()).text()).toBe(original)
    expect(h.state.captured).toHaveLength(1); expect(h.state.rows).toHaveLength(2)
    expect(h.state.session.status).toBe('open')
  })
  it.each(['context', 'model'])('still enforces the deadline when %s fails after an admitted safety turn', async failure => {
    clock(); pilot(); const h = await chatHarness(); vi.setSystemTime(start + 59 * 60_000 + 59_000)
    h.state.session.last_activity_at = new Date().toISOString()
    if (failure === 'context') {
      h.state.historyFailure = false; h.state.safetyFailure = true
      h.state.contextHook = async () => { vi.setSystemTime(start + 60 * 60_000 + 2000) }
    } else {
      h.state.generationFailure = true
      h.state.hook = async () => { vi.setSystemTime(start + 60 * 60_000 + 2000) }
    }
    const response = await h.post('Voy a matarme esta noche')
    expect(response.status).toBe(200); expect(await response.text()).toContain('024')
    expect(h.state.writes.find(w => w.name === 'finish_chat_turn').args.p_close_reason).toBe('crisis_detected')
    expect(h.state.session.status).toBe('closed')
  })
})
