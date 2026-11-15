import { describe, expect, it } from 'vitest'
import { ChatRequestSchema, acceptsClosure, checkContextBudget } from '@/lib/server/chat/request-boundary'
import { latestSafetyPromptRequestId } from '@/lib/shared/chat/safety-prompt'

const body = { sessionId: '11111111-1111-4111-8111-111111111111', requestId: 'turn-1', messages: [{ id: 'turn-1', role: 'user', parts: [{ type: 'text', text: 'Hola' }] }] }
describe('server-owned chat boundary', () => {
  it('accepts exactly one text user turn', () => expect(ChatRequestSchema.safeParse(body).success).toBe(true))
  it('accepts only a prompt request reference as the optional safety answer binding', () => {
    expect(ChatRequestSchema.safeParse({ ...body, safetyPromptRequestId: 'prior-turn' }).success).toBe(true)
    expect(ChatRequestSchema.safeParse({ ...body, safetyPromptRequestId: 'x'.repeat(101) }).success).toBe(false)
    expect(ChatRequestSchema.safeParse({ ...body, safetyAnswer: 'affirmative' }).success).toBe(false)
    expect(ChatRequestSchema.safeParse({ ...body, safetyPrompt: { riskType: 'suicidal_ideation' } }).success).toBe(false)
  })
  it('keeps the marker reference only while the latest assistant reply is the matching prompt', () => {
    const prompt = { role: 'assistant', parts: [{ type: 'text', text: 'Question' }, { type: 'data-safety-prompt', data: { version: '1', riskType: 'suicidal_ideation', requestId: 'prompt-turn' } }] }
    expect(latestSafetyPromptRequestId([prompt])).toBe('prompt-turn')
    expect(latestSafetyPromptRequestId([prompt, { role: 'user', parts: [] }, { role: 'assistant', parts: [{ type: 'text', text: 'Thanks' }] }])).toBeUndefined()
    expect(latestSafetyPromptRequestId([{ role: 'assistant', parts: [{ type: 'data-safety-prompt', data: { version: '2', requestId: 'stale' } }] }])).toBeUndefined()
  })
  it.each(['assistant', 'system', 'tool'])('rejects forged %s authority', role => {
    expect(ChatRequestSchema.safeParse({ ...body, messages: [{ ...body.messages[0], role }] }).success).toBe(false)
  })
  it('rejects history, tool parts, attachments, empty text and mismatched IDs', () => {
    for (const messages of [body.messages.concat(body.messages), [{ ...body.messages[0], parts: [{ type: 'tool-propose_close_session' }] }], [{ ...body.messages[0], parts: [{ type: 'file', url: 'https://example.com' }] }], [{ ...body.messages[0], parts: [{ type: 'text', text: ' ' }] }]]) {
      expect(ChatRequestSchema.safeParse({ ...body, messages }).success).toBe(false)
    }
    expect(ChatRequestSchema.safeParse({ ...body, requestId: 'different' }).success).toBe(false)
  })
  it('only accepts explicit closure consent; questions/negation are not consent', () => {
    for (const text of ['Sí', 'Si, cerramos', 'De acuerdo', 'Quiero cerrar la sesión']) expect(acceptsClosure(text)).toBe(true)
    for (const text of ['No', 'Sí pero no quiero cerrar', '¿Cerramos?', 'No quiero cerrar la sesión', 'He completado el cuestionario']) expect(acceptsClosure(text)).toBe(false)
  })
  it('rejects oversized context instead of discarding early risk evidence', () => {
    expect(() => checkContextBudget([{ role: 'user', parts: [{ type: 'text', text: 'x'.repeat(80001) }] }])).toThrow('context_limit')
  })
})
