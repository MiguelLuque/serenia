// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createUIMessageStreamResponse } from 'ai'
const fixture = vi.hoisted(() => ({ closed: false, failed: true, requestId: 'retry-original', messageId: 'persisted-user', text: 'Mi texto original', refresh: vi.fn(), replace: vi.fn(), replied: false, holdNextMessages: false, holdNextSession: false, releases: [] as Array<() => void> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: fixture.refresh, replace: fixture.replace, push: vi.fn() }) }))
vi.mock('@/app/app/actions', () => ({ endSessionAction: async () => {} }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => ({
 auth: { getUser: async () => ({ data: { user: { id: 'patient' } }, error: null }) },
 rpc: async () => ({ data: fixture.closed || !fixture.failed ? null : { requestId: fixture.requestId, userMessageId: fixture.messageId, text: fixture.text, status: 'failed', canRetry: true, leaseUntil: '2026-01-01' }, error: null }),
 from: (table: string) => {
  const chain = { select: () => chain, eq: () => chain, order: () => chain, single: () => chain, maybeSingle: () => chain, then: (resolve: (v: unknown) => unknown) => { const snapshot = { data: table === 'clinical_sessions' ? { id: 'session', user_id: 'patient', conversation_id: 'conversation', status: fixture.closed ? 'closed' : 'open' } : [{ id: fixture.messageId, role: 'user', parts: [{ type: 'text', text: fixture.text }] }, ...(fixture.replied ? [{ id: 'assistant', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta guardada' }] }] : [])], error: null }; if ((table === 'messages' && fixture.holdNextMessages) || (table === 'clinical_sessions' && fixture.holdNextSession)) { fixture.holdNextMessages = false; fixture.holdNextSession = false; return new Promise(done => { fixture.releases.push(() => done(snapshot)) }).then(resolve) } return Promise.resolve(snapshot).then(resolve) } }; return chain
 },
}) }))
import { ChatView } from '@/components/chat/chat-view'
const recovery = { requestId: 'retry-original', userMessageId: 'persisted-user', text: 'Mi texto original', status: 'failed' as const, canRetry: true, leaseUntil: '2026-01-01' }
const props = { sessionId: 'session', initialMessages: [{ id: 'persisted-user', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Mi texto original' }] }], expiresAt: new Date(Date.now() + 60_000*50), initialRecovery: recovery }
function reply(messageId = 'assistant') { fixture.failed = false; fixture.replied = true; return createUIMessageStreamResponse({ stream: new ReadableStream({ start(c) { c.enqueue({ type: 'start', messageId }); c.enqueue({ type: 'text-start', id: 'answer' }); c.enqueue({ type: 'text-delta', id: 'answer', delta: 'Respuesta guardada' }); c.enqueue({ type: 'text-end', id: 'answer' }); c.enqueue({ type: 'finish' }); c.close() } }) }) }
beforeEach(() => { fixture.closed = false; fixture.failed = true; fixture.replied = false; fixture.text = 'Mi texto original'; fixture.refresh.mockClear(); fixture.replace.mockClear(); fixture.holdNextMessages = false; fixture.holdNextSession = false; fixture.releases = [] })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
it.each([null, recovery])('preserves an explicit urgent draft through the displayed deadline and keeps a send path (recovery=%j)', async initialRecovery => {
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-13T23:00:00Z'))
 const fetch=vi.fn().mockImplementation(async()=>reply());vi.stubGlobal('fetch',fetch)
 render(<ChatView {...props} initialMessages={[]} initialRecovery={initialRecovery} expiresAt={new Date(Date.now()+30_000)} />)
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'Voy a matarme ahora'}})
 await act(async()=>{await vi.advanceTimersByTimeAsync(30_000)})
 expect(screen.getAllByText(/La sesión ha terminado/).length).toBeGreaterThan(0)
 const input=screen.queryByRole('textbox') as HTMLTextAreaElement|null
 expect(input?.value).toBe('Voy a matarme ahora')
 expect((screen.getByRole('button',{name:'Enviar'}) as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(screen.getByRole('button',{name:'Interrumpir espera y enviar una señal urgente'}))
 expect(input?.value).toBe('Voy a matarme ahora')
 expect((screen.getByRole('button',{name:'Enviar'}) as HTMLButtonElement).disabled).toBe(false)
 vi.useRealTimers()
 fireEvent.click(screen.getByRole('button',{name:'Enviar'}))
 await screen.findByText('Respuesta guardada')
 const body=JSON.parse(fetch.mock.calls[0][1].body)
 expect(body.messages[0].parts).toEqual([{type:'text',text:'Voy a matarme ahora'}])
 expect(body.requestId).not.toBe('retry-original')
})
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

it('a delayed old snapshot cannot overwrite a newer urgent response', async () => {
 fixture.holdNextMessages = true
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => reply()))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Voy a matarme ahora' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull())
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 expect(screen.getByText('Voy a matarme ahora')).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
})
it('a delayed old snapshot cannot overwrite a successful retry', async () => {
 fixture.holdNextMessages = true
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => reply()))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull())
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
})
it('only the newest manual check can apply its snapshot', async () => {
 fixture.holdNextMessages = true
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 fixture.failed = false; fixture.replied = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await screen.findByText('Respuesta guardada')
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
})
it('a snapshot from a previous session cannot update a new session', async () => {
 fixture.holdNextMessages = true
 const view = render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 view.rerender(<ChatView {...props} sessionId="new-session" initialRecovery={null} initialMessages={[{ id: 'new-message', role: 'assistant', parts: [{ type: 'text', text: 'Nueva sesión' }] }]} />)
 await screen.findByText('Nueva sesión')
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Nueva sesión')).toBeTruthy()
 expect(screen.queryByText('Mi texto original')).toBeNull()
})
it('an unmounted recovery cannot refresh after a late closed snapshot', async () => {
 fixture.closed = true; fixture.holdNextSession = true
 const view = render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 view.unmount()
 await act(async () => { fixture.releases.shift()!() })
 expect(fixture.refresh).not.toHaveBeenCalled()
})

it('manual recovery during retry does not cancel successful completion or block the next message', async () => {
 let finish!: () => void
 const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = () => resolve(reply()) })).mockImplementation(async () => reply('next-assistant'))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await waitFor(() => expect(finish).toBeTypeOf('function'))
 fixture.holdNextMessages = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 await act(async () => { fixture.releases.shift()!() })
 await act(async () => { finish() })
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull())
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Un mensaje nuevo normal' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
 expect(JSON.parse(fetch.mock.calls[1][1].body).requestId).not.toBe('retry-original')
 await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(''))
})
it('retry completion invalidates a manual snapshot started during its pending transport', async () => {
 let finish!: () => void
 vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(reply()) })))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await waitFor(() => expect(finish).toBeTypeOf('function'))
 fixture.holdNextMessages = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 await act(async () => { finish() })
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull())
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
})
it('normal send completion survives an in-flight manual snapshot and clears its draft', async () => {
 fixture.failed = false; fixture.text = 'Mensaje normal pendiente'
 let finish!: () => void
 vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(reply()) })))
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: fixture.text } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(finish).toBeTypeOf('function'))
 fixture.holdNextMessages = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 await act(async () => { finish() })
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(''))
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 expect(screen.getByText('Mensaje normal pendiente')).toBeTruthy()
})
