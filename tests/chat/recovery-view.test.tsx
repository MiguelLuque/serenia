// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createUIMessageStreamResponse } from 'ai'
const fixture = vi.hoisted(() => ({ closed: false, failed: true, requestId: 'retry-original', messageId: 'persisted-user', text: 'Mi texto original', refresh: vi.fn(), replace: vi.fn(), replied: false }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: fixture.refresh, replace: fixture.replace, push: vi.fn() }) }))
vi.mock('@/app/app/actions', () => ({ endSessionAction: async () => {} }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => ({
 auth: { getUser: async () => ({ data: { user: { id: 'patient' } }, error: null }) },
 rpc: async () => ({ data: fixture.closed || !fixture.failed ? null : { requestId: fixture.requestId, userMessageId: fixture.messageId, text: fixture.text, status: 'failed', canRetry: true, leaseUntil: '2026-01-01' }, error: null }),
 from: (table: string) => {
  const chain = { select: () => chain, eq: () => chain, order: () => chain, single: () => chain, maybeSingle: () => chain, then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === 'clinical_sessions' ? { id: 'session', user_id: 'patient', conversation_id: 'conversation', status: fixture.closed ? 'closed' : 'open' } : [{ id: fixture.messageId, role: 'user', parts: [{ type: 'text', text: fixture.text }] }, ...(fixture.replied ? [{ id: 'assistant', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta guardada' }] }] : [])], error: null }).then(resolve) }; return chain
 },
}) }))
import { ChatView } from '@/components/chat/chat-view'
const recovery = { requestId: 'retry-original', userMessageId: 'persisted-user', text: 'Mi texto original', status: 'failed' as const, canRetry: true, leaseUntil: '2026-01-01' }
const props = { sessionId: 'session', initialMessages: [{ id: 'persisted-user', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Mi texto original' }] }], expiresAt: new Date(Date.now() + 60_000*50), initialRecovery: recovery }
function reply() { fixture.failed = false; fixture.replied = true; return createUIMessageStreamResponse({ stream: new ReadableStream({ start(c) { c.enqueue({ type: 'start', messageId: 'assistant' }); c.enqueue({ type: 'text-start', id: 'answer' }); c.enqueue({ type: 'text-delta', id: 'answer', delta: 'Respuesta guardada' }); c.enqueue({ type: 'text-end', id: 'answer' }); c.enqueue({ type: 'finish' }); c.close() } }) }) }
beforeEach(() => { fixture.closed = false; fixture.failed = true; fixture.replied = false; fixture.text = 'Mi texto original'; fixture.refresh.mockClear(); fixture.replace.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('rehydrates a failed turn and retries the same request and text without duplicating it', async () => {
 const fetch = vi.fn().mockImplementation(async () => reply()); vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await screen.findByText('Respuesta guardada')
 expect(screen.getAllByText('Mi texto original')).toHaveLength(1)
 const body = JSON.parse(fetch.mock.calls[0][1].body)
 expect(body.requestId).toBe('retry-original'); expect(body.messages).toEqual([{ id: 'retry-original', role: 'user', parts: [{ type: 'text', text: 'Mi texto original' }] }])
})
it('allows typing during screening and while submitted, with an accessible urgent exit', async () => {
 const fetch = vi.fn().mockImplementation(async () => reply()); vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} activeQuestionnaire={{ instanceId: 'quiz', status: 'proposed', definition: { code: 'CSSRS', name: 'Cribado' }, items: [{ id: '1', order_index: 1, prompt: 'Pregunta', options_json: [{ value: 0, label: 'No' }] }] }} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 expect(input.disabled).toBe(false)
 fireEvent.change(input, { target: { value: 'Voy a matarme' } })
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.click(screen.getAllByRole('button', { name: 'Enviar' }).find(button => !(button as HTMLButtonElement).disabled)!)
 await screen.findByText('Respuesta guardada')
 expect(JSON.parse(fetch.mock.calls[0][1].body).requestId).not.toBe('retry-original')
})
it('external close after transport error rehydrates closed UI without retry', async () => {
 fixture.closed = true
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('closed', { status: 422 })))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await waitFor(() => expect(screen.getAllByText(/La sesión ha terminado/).length).toBeGreaterThan(0))
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
 expect(fixture.refresh).toHaveBeenCalled()
})
it('an exhausted turn exposes a non-retryable state and an urgent exit', () => {
 render(<ChatView {...props} initialRecovery={{ ...recovery, canRetry: false }} />)
 expect(screen.getByText(/No se puede reintentar/)).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
 expect(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' })).toBeTruthy()
})

it('transport failure before admission retains the original retry ID and text', async () => {
 fixture.failed = false
 const fetch = vi.fn().mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 })).mockImplementation(async () => reply()); vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nuevo texto conservado' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByRole('button', { name: 'Reintentar el mismo mensaje' })
 const original = JSON.parse(fetch.mock.calls[0][1].body)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await screen.findByText('Respuesta guardada')
 const retry = JSON.parse(fetch.mock.calls[1][1].body)
 expect(retry.requestId).toBe(original.requestId); expect(retry.messages[0].parts[0].text).toBe('Nuevo texto conservado')
})
it('stopping an actual outstanding request keeps the urgent exit open and preserves the draft', async () => {
 const fetch = vi.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => { options.signal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError'))) })); vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input=screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Hola pendiente' } }); fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/Esperando respuesta/)
 fireEvent.change(input, { target: { value: 'Voy a matarme' } })
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 await waitFor(() => expect(screen.getByText(/Escribe una señal nueva de peligro/)).toBeTruthy())
 expect(input.value).toBe('Voy a matarme')
 expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(false)
})
