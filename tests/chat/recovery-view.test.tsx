// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createUIMessageStreamResponse } from 'ai'
const fixture = vi.hoisted(() => ({ closed: false, failed: true, failRecoveryRpc: false, failReceipt: false, omitUser: false, generating: null as null | 'waiting' | 'retryable', receipt: null as string | null, receiptMessageId: '40000000-0000-4000-8000-000000000004', receiptRequestId: null as string | null, messageRows: null as null | Array<{ id: string; role: 'user' | 'assistant'; parts: Array<unknown> }>, crisisCloseSnapshot: false, resolveStatus: 'busy', attempt: 1, resolveError: false, holdResolution: false, releaseResolution: null as null | (() => void), resolveArgs: null as unknown, rpcCalls: 0, messageReads: 0, requestId: 'retry-original', messageId: 'persisted-user', text: 'Mi texto original', refresh: vi.fn(), replace: vi.fn(), push: vi.fn(), replied: false, holdNextMessages: false, holdNextSession: false, releases: [] as Array<() => void> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: fixture.refresh, replace: fixture.replace, push: fixture.push }) }))
vi.mock('@/app/app/actions', () => ({ endSessionAction: async () => {} }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => ({
 auth: { getUser: async () => ({ data: { user: { id: 'patient' } }, error: null }) },
 rpc: async (name: string, args: unknown) => { if (name === 'resolve_expired_chat_turn') { fixture.resolveArgs = args; if (fixture.holdResolution) await new Promise<void>(done => { fixture.releaseResolution = done }); return { data: fixture.resolveStatus, error: fixture.resolveError ? new Error('unavailable') : null } } fixture.rpcCalls++; if (fixture.failRecoveryRpc) return { data: null, error: new Error('Synthetic recovery unavailable') }; return { data: fixture.closed ? null : fixture.generating ? { requestId: fixture.requestId, userMessageId: fixture.messageId, text: fixture.text, status: 'generating', attempt: fixture.attempt, canRetry: fixture.generating === 'retryable', leaseUntil: new Date(Date.now() + (fixture.generating === 'waiting' ? 60_000 : -1000)).toISOString() } : !fixture.failed ? null : { requestId: fixture.requestId, userMessageId: fixture.messageId, text: fixture.text, status: 'failed', attempt: fixture.attempt, canRetry: true, leaseUntil: '2026-01-01' }, error: null } },
 from: (table: string) => {
  const chain = { select: () => chain, eq: () => chain, order: () => chain, single: () => chain, maybeSingle: () => chain, then: (resolve: (v: unknown) => unknown) => { if (table === 'messages') fixture.messageReads++; const snapshot = { data: table === 'clinical_sessions' ? { id: '20000000-0000-4000-8000-000000000001', user_id: 'patient', conversation_id: 'conversation', status: fixture.closed ? 'closed' : 'open', opened_at: new Date().toISOString() } : table === 'conversations' ? { id: 'conversation', user_id: 'patient' } : fixture.messageRows ?? [...(fixture.omitUser ? [] : [{ id: fixture.messageId, role: 'user', parts: [{ type: 'text', text: fixture.text }] }]), ...(fixture.replied ? [{ id: 'assistant', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta guardada' }] }] : []), ...(fixture.crisisCloseSnapshot ? [{ id: 'crisis-close', role: 'assistant', parts: [{ type: 'data-session-closed', data: { closed: true, reason: 'crisis_detected' } }] }] : [])], error: null }; if ((table === 'messages' && fixture.holdNextMessages) || (table === 'clinical_sessions' && fixture.holdNextSession)) { fixture.holdNextMessages = false; fixture.holdNextSession = false; return new Promise(done => { fixture.releases.push(() => done(snapshot)) }).then(resolve) } return Promise.resolve(snapshot).then(resolve) } }; return chain
 },
}), createServiceRoleClient: () => ({ from: () => { const q = { select: () => q, eq: (key: string, value: string) => { if (key === 'request_id') fixture.receiptRequestId = value; return q }, maybeSingle: async () => ({ data: fixture.receipt && fixture.receipt !== 'missing' ? { status: fixture.receipt, user_message_id: fixture.receiptMessageId } : null, error: fixture.failReceipt ? new Error('unavailable') : null }) }; return q } }) }))
vi.mock('@/lib/server/workflows', () => ({ enqueueAssessmentGeneration: vi.fn() }))
import { ChatView } from '@/components/chat/chat-view'
const recovery = { requestId: 'retry-original', userMessageId: 'persisted-user', text: 'Mi texto original', status: 'failed' as const, attempt: 1, canRetry: true, leaseUntil: '2026-01-01' }
const recoveryB = { ...recovery, requestId: 'turn-b', userMessageId: 'persisted-b', text: 'Turno B pendiente', status: 'generating' as const, attempt: 2, canRetry: false, leaseUntil: new Date(Date.now() + 60_000).toISOString() }
const props = { sessionId: '20000000-0000-4000-8000-000000000001', initialMessages: [{ id: 'persisted-user', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Mi texto original' }] }], expiresAt: new Date(Date.now() + 60_000*50), initialRecovery: recovery }
function reply(messageId = 'assistant') { fixture.failed = false; fixture.replied = true; return createUIMessageStreamResponse({ stream: new ReadableStream({ start(c) { c.enqueue({ type: 'start', messageId }); c.enqueue({ type: 'text-start', id: 'answer' }); c.enqueue({ type: 'text-delta', id: 'answer', delta: 'Respuesta guardada' }); c.enqueue({ type: 'text-end', id: 'answer' }); c.enqueue({ type: 'finish' }); c.close() } }) }) }
beforeEach(() => { fixture.closed = false; fixture.failed = true; fixture.failRecoveryRpc = false; fixture.failReceipt = false; fixture.omitUser = false; fixture.generating = null; fixture.receipt = null; fixture.receiptMessageId = '40000000-0000-4000-8000-000000000004'; fixture.receiptRequestId = null; fixture.messageRows = null; fixture.crisisCloseSnapshot = false; fixture.resolveStatus = 'busy'; fixture.attempt = 1; fixture.resolveError = false; fixture.holdResolution = false; fixture.releaseResolution = null; fixture.resolveArgs = null; fixture.rpcCalls = 0; fixture.messageReads = 0; fixture.replied = false; fixture.text = 'Mi texto original'; fixture.refresh.mockReset(); fixture.replace.mockClear(); fixture.push.mockClear(); fixture.holdNextMessages = false; fixture.holdNextSession = false; fixture.releases = [] })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
it.each(['busy', 'active', 'unknown', 'error'])('keeps draft and urgent actions available when resolution is %s', async state => {
 fixture.resolveStatus = state === 'error' ? 'busy' : state
 fixture.resolveError = state === 'error'
 render(<ChatView {...props} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador siguiente' } })
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await screen.findByText(/no hemos podido confirmar la resolución/i)
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
 expect(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' })).toBeTruthy()
 expect(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeTruthy()
 expect(fixture.refresh).not.toHaveBeenCalled()
 expect(fixture.resolveArgs).toEqual({ p_session_id: props.sessionId, p_request_id: recovery.requestId, p_expected_attempt: 1 })
})
it('does not resolve an unconfirmed local fallback without an attempt number', () => {
 const { attempt: _attempt, ...unconfirmed } = recovery
 void _attempt
 render(<ChatView {...props} initialRecovery={unconfirmed} />)
 expect(screen.queryByRole('button', { name: 'Comprobar y resolver turno pendiente' })).toBeNull()
 expect(screen.getByRole('button', { name: 'Comprobar estado guardado' })).toBeTruthy()
})
it('refreshes a stale generation before resolving a newer attempt', async () => {
 fixture.resolveStatus = 'stale'; fixture.attempt = 2
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(1))
 expect(fixture.resolveArgs).toEqual({ p_session_id: props.sessionId, p_request_id: recovery.requestId, p_expected_attempt: 1 })
 fixture.resolveStatus = 'busy'
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await screen.findByText(/no hemos podido confirmar la resolución/i)
 expect(fixture.resolveArgs).toEqual({ p_session_id: props.sessionId, p_request_id: recovery.requestId, p_expected_attempt: 2 })
})
it('shows the stored close after a closed resolution', async () => {
 fixture.resolveStatus = 'closed'; fixture.closed = true
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await screen.findAllByText('La sesión ha terminado.')
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
})
it('recovers the stored answer after a completed resolution', async () => {
 fixture.resolveStatus = 'completed'; fixture.failed = false; fixture.replied = true
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await screen.findByText('Respuesta guardada')
 expect(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeTruthy()
})
it('keeps exact replay available when completion is confirmed but its answer is not visible', async () => {
 fixture.resolveStatus = 'completed'; fixture.failed = false; fixture.replied = false
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalled())
 expect(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeTruthy()
 expect(screen.getByText(/no podemos confirmar que la respuesta se muestre/i)).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.rpcCalls).toBeGreaterThanOrEqual(4))
 expect(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeTruthy()
 expect(screen.getByText(/no podemos confirmar que la respuesta se muestre/i)).toBeTruthy()
})
it('does not revive completed replay after the response was successfully replayed', async () => {
 fixture.resolveStatus = 'completed'; fixture.failed = false
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => reply()))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalled())
 fixture.holdNextMessages = true
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull())
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
})
it('refreshes the questionnaire after confirmed resolution and preserves the draft', async () => {
 fixture.resolveStatus = 'failed'
 render(<ChatView {...props} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador siguiente' } })
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(1))
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
 expect(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeTruthy()
})
it('does not apply a late resolution after a new urgent turn', async () => {
 fixture.resolveStatus = 'failed'; fixture.holdResolution = true
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => reply()))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await waitFor(() => expect(fixture.releaseResolution).not.toBeNull())
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Voy a matarme ahora' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText('Respuesta guardada')
 await act(async () => { fixture.releaseResolution!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 expect(fixture.refresh).not.toHaveBeenCalled()
})
it('reports an uncertain result if resolution stalls and ignores a late completion', async () => {
 fixture.resolveStatus = 'failed'; fixture.holdResolution = true
 vi.useFakeTimers()
 render(<ChatView {...props} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador siguiente' } })
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await act(async () => { await Promise.resolve(); await Promise.resolve() })
 expect(fixture.releaseResolution).not.toBeNull()
 await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
 expect(screen.getByText(/no hemos podido confirmar la resolución/i)).toBeTruthy()
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
 expect(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' })).toBeTruthy()
 const first = fixture.releaseResolution!
 fixture.holdResolution = false; fixture.resolveStatus = 'busy'
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve() })
 await act(async () => { first() })
 expect((screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }) as HTMLButtonElement).disabled).toBe(false)
 expect(fixture.refresh).not.toHaveBeenCalled()
})
it('times out a stalled follow-up read and ignores its late snapshot', async () => {
 fixture.resolveStatus = 'failed'; fixture.holdNextMessages = true
 vi.useFakeTimers()
 render(<ChatView {...props} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador siguiente' } })
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
 expect(fixture.releases).toHaveLength(1)
 await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
 expect(screen.getByText(/no hemos podido confirmar la resolución/i)).toBeTruthy()
 expect((screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }) as HTMLButtonElement).disabled).toBe(false)
 await act(async () => { fixture.releases.shift()!() })
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
 expect(fixture.refresh).not.toHaveBeenCalled()
})
it('does not invalidate a newer manual recovery read when resolution times out', async () => {
 fixture.holdResolution = true; fixture.holdNextMessages = true; fixture.replied = true
 vi.useFakeTimers()
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
 expect(fixture.releases).toHaveLength(1)
 await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 await act(async () => { fixture.releaseResolution!() })
})
it('does not offer resolution during an in-flight retry', async () => {
 let release: (() => void) | undefined
 vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(done => { release = () => done(reply()) })))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await waitFor(() => expect(release).toBeDefined())
 expect((screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }) as HTMLButtonElement).disabled).toBe(true)
 await act(async () => { release!() })
 await screen.findByText('Respuesta guardada')
})
it('keeps the outcome unconfirmed when the subsequent recovery read fails', async () => {
 fixture.resolveStatus = 'failed'; fixture.failRecoveryRpc = true
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' }))
 await screen.findByText(/No se pudo comprobar el estado/i)
 expect(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' })).toBeTruthy()
 expect(fixture.refresh).not.toHaveBeenCalled()
})
it.each([null, recovery])('preserves an explicit urgent draft through the displayed deadline and keeps a send path (recovery=%j)', async initialRecovery => {
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-13T23:00:00Z'))
 const fetch=vi.fn().mockImplementation(async()=>reply());vi.stubGlobal('fetch',fetch)
 render(<ChatView {...props} initialMessages={[]} initialRecovery={initialRecovery} expiresAt={new Date(Date.now()+30_000)} />)
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'Voy a matarme ahora'}})
 await act(async()=>{await vi.advanceTimersByTimeAsync(30_000)})
 expect(screen.getAllByText(/Tiempo agotado/).length).toBeGreaterThan(0)
 expect(screen.queryByText('La sesión ha terminado.')).toBeNull()
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
it('refreshes server-rendered questionnaire state after a successful retry without tool events', async () => {
 const fetch = vi.fn().mockImplementation(async () => reply()); vi.stubGlobal('fetch', fetch)
 // The failed turn may already have persisted a questionnaire whose tool event
 // was never returned. The retry can be plain text, as the server test shows.
 render(<ChatView {...props} activeQuestionnaire={null} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalled())
})
it('refreshes server-rendered questionnaire state after recovering a failed turn without requiring a retry', async () => {
 const fetch = vi.fn().mockResolvedValue(new Response('temporarily unavailable', { status: 503 })); vi.stubGlobal('fetch', fetch)
 // The server may have created the questionnaire before its continuation
 // failed, without ever sending its tool result to the client.
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} activeQuestionnaire={null} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: fixture.text } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByRole('button', { name: 'Reintentar el mismo mensaje' })
 expect(fetch).toHaveBeenCalledTimes(1)
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalled())
})
it('shows a newly loaded questionnaire after recovery refresh without losing the next draft', async () => {
 const fetch = vi.fn().mockImplementation(async () => reply()); vi.stubGlobal('fetch', fetch)
 const view = render(<ChatView {...props} activeQuestionnaire={null} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Borrador siguiente' } })
 fixture.refresh.mockImplementationOnce(() => {
  view.rerender(<ChatView {...props} activeQuestionnaire={{ instanceId: 'quiz', status: 'proposed', definition: { code: 'PHQ9', name: 'Cuestionario recuperado' }, items: [{ id: '1', order_index: 1, prompt: 'Pregunta ficticia', options_json: [{ value: 0, label: 'No' }] }] }} />)
 })
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await screen.findByText('Respuesta guardada')
 await screen.findByText('PHQ-9 — Cómo te has sentido estas 2 últimas semanas')
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
})
it('renders refreshed server questionnaire props without discarding the current draft', () => {
 const view = render(<ChatView {...props} activeQuestionnaire={null} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador siguiente' } })
 view.rerender(<ChatView {...props} activeQuestionnaire={{ instanceId: 'quiz', status: 'proposed', definition: { code: 'PHQ9', name: 'Cuestionario recuperado' }, items: [{ id: '1', order_index: 1, prompt: 'Pregunta ficticia', options_json: [{ value: 0, label: 'No' }] }] }} />)
 expect(screen.getByText('PHQ-9 — Cómo te has sentido estas 2 últimas semanas')).toBeTruthy()
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
})
it('refreshes questionnaire state when polling changes a generating turn into a failed turn', async () => {
 const generating = { ...recovery, status: 'generating' as const, canRetry: false, leaseUntil: new Date(Date.now() - 1000).toISOString() }
 // The first reconciliation was still generating. Before its next poll the
 // provider can create a questionnaire and the turn can subsequently fail.
 render(<ChatView {...props} initialRecovery={generating} activeQuestionnaire={null} />)
 await screen.findByRole('button', { name: 'Reintentar el mismo mensaje' }, { timeout: 3000 })
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalled())
})
it('refreshes once for a valid generating snapshot, then again when it settles without looping', async () => {
 fixture.generating = 'waiting'
 const generating = { ...recovery, status: 'generating' as const, canRetry: false, leaseUntil: new Date(Date.now() + 60_000).toISOString() }
 render(<ChatView {...props} initialRecovery={generating} activeQuestionnaire={null} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(1))
 const callsAfterFirst = fixture.rpcCalls
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.rpcCalls).toBeGreaterThanOrEqual(callsAfterFirst + 2))
 expect(fixture.refresh).toHaveBeenCalledTimes(1)
 fixture.generating = null
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(2))
 const callsAfterSettled = fixture.rpcCalls
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.rpcCalls).toBeGreaterThanOrEqual(callsAfterSettled + 2))
 expect(fixture.refresh).toHaveBeenCalledTimes(2)
})
it('does not apply an old completed receipt after an urgent response', async () => {
 fixture.generating = 'waiting'; fixture.holdNextMessages = true; fixture.receipt = 'completed'
 const generating = { ...recovery, status: 'generating' as const, canRetry: false, leaseUntil: new Date(Date.now() + 60_000).toISOString() }
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => reply()))
 render(<ChatView {...props} initialRecovery={generating} activeQuestionnaire={null} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Voy a matarme ahora' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText('Respuesta guardada')
 fixture.generating = null
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 expect(fixture.refresh).not.toHaveBeenCalled()
})
it('refreshes again after a retryable generating snapshot later becomes failed', async () => {
 fixture.generating = 'retryable'
 const generating = { ...recovery, status: 'generating' as const, canRetry: true, leaseUntil: new Date(Date.now() - 1000).toISOString() }
 render(<ChatView {...props} initialRecovery={generating} activeQuestionnaire={null} />)
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(1))
 fixture.generating = null
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(2))
})
it('refreshes only once per waiting, retryable and settled recovery phase', async () => {
 fixture.generating = 'waiting'
 const generating = { ...recovery, status: 'generating' as const, canRetry: false, leaseUntil: new Date(Date.now() + 60_000).toISOString() }
 render(<ChatView {...props} initialRecovery={generating} activeQuestionnaire={null} />)
 const check = async () => {
  const before = fixture.rpcCalls
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
  await waitFor(() => expect(fixture.rpcCalls).toBeGreaterThanOrEqual(before + 2))
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
 }
 await check(); expect(fixture.refresh).toHaveBeenCalledTimes(1)
 await check(); expect(fixture.refresh).toHaveBeenCalledTimes(1)
 fixture.generating = 'retryable'
 await check(); await waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(2))
 await check(); expect(fixture.refresh).toHaveBeenCalledTimes(2)
 fixture.generating = null
 await check(); await waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(3))
 await check(); expect(fixture.refresh).toHaveBeenCalledTimes(3)
})
it('explains an uncertain retryable turn while preserving the same retry, draft and urgent options', async () => {
 fixture.generating = 'retryable'
 const generating = { ...recovery, status: 'generating' as const, canRetry: true, leaseUntil: new Date(Date.now() - 1000).toISOString() }
 const fetch = vi.fn().mockImplementation(async () => { fixture.generating = null; return reply() }); vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={generating} />)

 const notice = screen.getByText(/no (?:podemos|se puede) confirmar.*cómo terminó el turno/i)
 expect(notice.getAttribute('role')).toBe('status')
 expect(notice.getAttribute('aria-live')).toBe('polite')
 expect(notice.textContent).not.toMatch(/no se (?:guardó|registró)|ningún cambio/i)
 expect(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' })).toBeTruthy()
 expect(screen.getByRole('link', { name: /Línea 024/i })).toBeTruthy()
 expect(screen.getByRole('link', { name: /emergencias/i })).toBeTruthy()
 const draft = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(draft, { target: { value: 'Borrador siguiente' } })

 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await screen.findByText('Respuesta guardada')
 const body = JSON.parse(fetch.mock.calls[0][1].body)
 expect(body.requestId).toBe('retry-original')
 expect(body.messages[0].parts).toEqual([{ type: 'text', text: 'Mi texto original' }])
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
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
 expect(fixture.refresh).not.toHaveBeenCalled()
})
it('recovers an authenticated closed session even when receipt lookup fails', async () => {
 fixture.closed = true; fixture.failReceipt = true
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('connection lost', { status: 503 })))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await waitFor(() => expect(screen.getAllByText(/La sesión ha terminado/).length).toBeGreaterThan(0))
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
})
it('recovers the persisted final answer when the server closed but its HTTP response was lost', async () => {
 fixture.closed = true; fixture.replied = true
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('connection lost', { status: 503 })))
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await screen.findByText('Respuesta guardada')
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
 expect(fixture.refresh).not.toHaveBeenCalled()
})
it('an exhausted turn exposes a non-retryable state and an urgent exit', () => {
 render(<ChatView {...props} initialRecovery={{ ...recovery, canRetry: false }} />)
 expect(screen.getByText(/No se puede reintentar/)).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
 expect(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' })).toBeTruthy()
})

it('does not announce a definitive outcome while a lost response is still being checked', async () => {
 let loseResponse!: () => void
 fixture.holdNextMessages = true
 const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => {
  loseResponse = () => resolve(new Response('connection lost', { status: 503 }))
 }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Mi texto original' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/Esperando respuesta/)
 fireEvent.change(input, { target: { value: 'Borrador siguiente' } })

 // The server has a final answer, but the HTTP response is lost and the
 // subsequent recovery read has not yet returned it to the client.
 fixture.failed = false; fixture.replied = true
 await act(async () => { loseResponse() })
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 expect(input.value).toBe('Borrador siguiente')
 expect(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' })).toBeTruthy()
 expect(screen.getByRole('link', { name: /Línea 024/i })).toBeTruthy()
 expect(screen.getByRole('link', { name: /emergencias/i })).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
 expect(screen.queryByText(/No se completó la respuesta/i)).toBeNull()
 expect(screen.queryByText(/No se puede reintentar este turno/i)).toBeNull()
 expect(screen.queryByText(/turno guardado/i)).toBeNull()
 const notice = screen.getByText(/(?:estamos|seguimos) comprobando/i)
 expect(notice.getAttribute('role')).toBe('status')
 expect(notice.getAttribute('aria-live')).toBe('polite')

 await act(async () => { fixture.releases.shift()!() })
 await screen.findByText('Respuesta guardada')
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
})

it('keeps the outcome unconfirmed when recovery fails and allows checking again', async () => {
 let loseResponse!: () => void
 fixture.failRecoveryRpc = true
 const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => {
  loseResponse = () => resolve(new Response('connection lost', { status: 503 }))
 }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Mi texto original' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/Esperando respuesta/)
 fireEvent.change(input, { target: { value: 'Borrador siguiente' } })

 // The server committed a response, but the HTTP response and the first
 // recovery read fail; the client cannot yet know the durable outcome.
 fixture.failed = false; fixture.replied = true
 await act(async () => { loseResponse() })
 await screen.findByText(/No se pudo comprobar el estado/i)
 expect(input.value).toBe('Borrador siguiente')
 expect(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' })).toBeTruthy()
 expect(screen.getByRole('link', { name: /Línea 024/i })).toBeTruthy()
 expect(screen.getByRole('link', { name: /emergencias/i })).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
 expect(screen.queryByText(/No se completó la respuesta/i)).toBeNull()
 expect(screen.queryByText(/No se puede reintentar este turno/i)).toBeNull()
 expect(screen.queryByText(/turno guardado/i)).toBeNull()

 fixture.failRecoveryRpc = false
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await screen.findByText('Respuesta guardada')
 expect(fetch).toHaveBeenCalledTimes(1)
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
})

it('keeps uncertainty when recovery has no pending turn but shows an assistant answer', async () => {
 fixture.failed = false; fixture.replied = true
 const fetch = vi.fn().mockResolvedValue(new Response('connection lost', { status: 503 })); vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mi texto original' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText('Respuesta guardada')
 expect(screen.getByText(/no (?:podemos|se puede) confirmar.*cómo terminó el turno/i)).toBeTruthy()
 expect(screen.queryByText(/No se completó la respuesta/i)).toBeNull()
 expect(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeTruthy()
 expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([false, true])('keeps exact replay when completed response visibility is unconfirmed (other answer: %s)', async replied => {
 fixture.failed = false; fixture.replied = replied; fixture.receipt = 'completed'
 const fetch = vi.fn().mockResolvedValueOnce(new Response('connection lost', { status: 503 })).mockImplementationOnce(async () => reply('replayed-answer'))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mi texto original' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 expect(await screen.findByText(/turno guardado.*no.*confirm.*respuesta/i)).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
 expect(JSON.parse(fetch.mock.calls[1][1].body).requestId).toBe(JSON.parse(fetch.mock.calls[0][1].body).requestId)
})

it('keeps a newer server recovery even when the old attempt completed', async () => {
 fixture.generating = 'retryable'; fixture.receipt = 'completed'; fixture.requestId = 'newer-turn'
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('connection lost', { status: 503 })))
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mi texto original' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 expect(await screen.findByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeTruthy()
})

it('keeps an idempotent retry when recovery has no pending turn and admission is unconfirmed', async () => {
 fixture.failed = false; fixture.omitUser = true
 const fetch = vi.fn().mockResolvedValueOnce(new Response('connection lost', { status: 503 }))
  .mockImplementationOnce(async () => { fixture.omitUser = false; return reply() })
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mi texto original' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 const retry = await screen.findByRole('button', { name: 'Reintentar el mismo mensaje' })
 expect(screen.getByText(/no (?:podemos|se puede) confirmar.*cómo terminó el turno/i)).toBeTruthy()
 const original = JSON.parse(fetch.mock.calls[0][1].body)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador siguiente' } })
 fireEvent.click(retry)
 await screen.findByText('Respuesta guardada')
 const retried = JSON.parse(fetch.mock.calls[1][1].body)
 expect(retried.requestId).toBe(original.requestId)
 expect(retried.messages[0].parts).toEqual([{ type: 'text', text: 'Mi texto original' }])
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
})

it('clears an old recovery alert after urgent success without hiding a later read failure', async () => {
 fixture.failRecoveryRpc = true
 const fetch = vi.fn().mockResolvedValueOnce(new Response('connection lost', { status: 503 }))
  .mockImplementationOnce(async () => reply()).mockImplementationOnce(() => new Promise<Response>(() => {}))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mi texto original' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/No se pudo comprobar el estado/i)
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Voy a matarme ahora' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText('Respuesta guardada')
 fixture.failRecoveryRpc = false
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Una idea nueva' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/Esperando respuesta/)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador siguiente' } })
 expect(screen.queryByText(/No se pudo comprobar el estado/i)).toBeNull()
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')

 fixture.failRecoveryRpc = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await screen.findByText(/No se pudo comprobar el estado/i)
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador siguiente')
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
 expect(fixture.refresh).not.toHaveBeenCalled()
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

it('ignores an older deferred recovery snapshot after a newer read completes', async () => {
 fixture.holdNextMessages = true
 render(<ChatView {...props} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador B' } })
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 fixture.replied = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await screen.findByText('Respuesta guardada')
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Respuesta guardada')).toBeTruthy()
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador B')
})

it('does not replace an in-flight optimistic message with an older open snapshot', async () => {
 fixture.failed = false; fixture.omitUser = true
 let finish!: () => void
 vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(reply()) })))
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Mensaje A en curso' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/Esperando respuesta/)
 fireEvent.change(input, { target: { value: 'Borrador B' } })
 fixture.holdNextMessages = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 await act(async () => { fixture.releases.shift()!() })
 expect(screen.getByText('Mensaje A en curso')).toBeTruthy()
 expect(input.value).toBe('Borrador B')
 await act(async () => { finish() })
 await screen.findByText('Respuesta guardada')
})

it('keeps an in-flight urgent message and the later draft when a closed snapshot arrives', async () => {
 fixture.failed = false; fixture.omitUser = true
 let finish!: () => void
 vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(reply()) })))
 render(<ChatView {...props} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(input, { target: { value: 'Señal A' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(finish).toBeTypeOf('function'))
 fireEvent.change(input, { target: { value: 'Borrador B' } })
 fixture.closed = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await screen.findAllByText(/La sesión ha terminado/)
 expect(screen.getAllByText('Señal A')).toHaveLength(2)
 const draft = screen.getByRole('textbox', { name: 'Borrador sin enviar' }) as HTMLTextAreaElement
 expect(draft.value).toBe('Borrador B')
 await act(async () => { finish() })
})

it('retries an uncertain urgent signal with the same request ID and preserves the next draft', async () => {
 fixture.failed = false; fixture.omitUser = true
 fixture.receipt = 'missing'
 const fetch = vi.fn()
  .mockImplementationOnce((_url, init) => {
    const request = JSON.parse(init.body)
    fixture.requestId = request.requestId; fixture.text = request.messages[0].parts[0].text
    return new Response('temporarily unavailable', { status: 503 })
  })
  .mockImplementationOnce(async () => reply('urgent-replay-answer'))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(input, { target: { value: 'Señal A que no se debe perder' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/No hemos podido confirmar/i)
 fireEvent.change(input, { target: { value: 'Borrador B' } })
 const firstRequest = JSON.parse(fetch.mock.calls[0][1].body).requestId
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar la misma señal guardada' }))
 await screen.findByText('Respuesta guardada')
 const replay = JSON.parse(fetch.mock.calls[1][1].body)
 expect(replay.requestId).toBe(firstRequest)
 expect(replay.messages[0].parts[0].text).toBe('Señal A que no se debe perder')
 expect(input.value).toBe('Borrador B')
})

it('keeps an uncertain message copyable after closure without offering a new send', async () => {
 fixture.failed = false; fixture.omitUser = true
 const fetch = vi.fn().mockResolvedValue(new Response('temporarily unavailable', { status: 503 }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialMessages={[]} />)
 const input = screen.getByRole('textbox', { name: 'Mensaje para Serenia' }) as HTMLTextAreaElement
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(input, { target: { value: 'Señal A que debe conservarse' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/No hemos podido confirmar el envío/i)
 fireEvent.change(input, { target: { value: 'Borrador B' } })
 fixture.closed = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await screen.findAllByText(/La sesión ha terminado/)
 expect((screen.getByRole('textbox', { name: 'Mensaje pendiente 1' }) as HTMLTextAreaElement).value).toBe('Señal A que debe conservarse')
 expect((screen.getByRole('textbox', { name: 'Borrador sin enviar' }) as HTMLTextAreaElement).value).toBe('Borrador B')
 expect(screen.queryByRole('button', { name: 'Reintentar la misma señal guardada' })).toBeNull()
 expect(fetch).toHaveBeenCalledTimes(1)
})

it('clears retrying when its transport ends even while a recovery read is still pending', async () => {
 fixture.failed = false; fixture.omitUser = true
 fixture.holdNextMessages = true
 const fetch = vi.fn().mockImplementation(async () => reply('retry-answer'))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} />)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 expect(screen.queryByText(/Reintentando el mismo turno guardado/i)).toBeNull()
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 const input = screen.getByRole('textbox', { name: 'Mensaje para Serenia' }) as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Señal urgente nueva' } })
 await waitFor(() => expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(false))
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
 await act(async () => { fixture.releases.shift()!() })
})

it('does not carry an earlier 422 into a later request that fails before receiving headers', async () => {
 fixture.failed = false
 const fetch = vi.fn()
  .mockImplementationOnce(() => new Response('not admitted', { status: 422 }))
  .mockImplementationOnce(() => Promise.reject(new TypeError('offline before headers')))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Primer intento' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/No se puede reintentar este turno/)
 expect(screen.queryByText(/El servidor no admitió este mensaje/i)).toBeNull()
 expect(screen.getByText(/No hemos podido confirmar el envío/i)).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(input, { target: { value: 'Señal posterior' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/Puedes reintentar el mismo mensaje/i)
 expect(fetch).toHaveBeenCalledTimes(2)
})

it('removes the local copy only after its completed receipt has a visible saved answer', async () => {
 const persistedAId = '40000000-0000-4000-8000-000000000004'
 fixture.failed = false; fixture.omitUser = true; fixture.receipt = 'completed'; fixture.receiptMessageId = persistedAId
 fixture.messageRows = [
  { id: persistedAId, role: 'user', parts: [{ type: 'text', text: 'Señal A completada' }] },
  { id: 'assistant-a', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta guardada' }] },
 ]
 const fetch = vi.fn().mockImplementation((_url, init) => {
  fixture.receiptRequestId = JSON.parse(init.body).requestId
  return new Response('temporarily unavailable', { status: 503 })
 })
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialMessages={[]} />)
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Señal A completada' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText('Respuesta guardada')
 expect(fixture.receiptRequestId).toBe(JSON.parse(fetch.mock.calls[0][1].body).requestId)
 expect(screen.queryByText(/Tu turno guardado terminó/i)).toBeNull()
 expect(screen.queryByRole('button', { name: 'Reintentar la misma señal guardada' })).toBeNull()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
 expect(screen.getAllByText('Señal A completada')).toHaveLength(1)
})

it('replays completed A by its persisted message ID while preserving pending B and the next draft', async () => {
 fixture.failed = false; fixture.generating = 'waiting'; fixture.requestId = recoveryB.requestId; fixture.messageId = recoveryB.userMessageId; fixture.text = recoveryB.text
 fixture.receipt = 'completed'; fixture.receiptMessageId = '40000000-0000-4000-8000-000000000004'
 fixture.messageRows = [
  { id: fixture.receiptMessageId, role: 'user', parts: [{ type: 'text', text: 'Señal A incierta' }] },
  { id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] },
 ]
 let finishReplay!: (response: Response) => void
 const fetch = vi.fn()
  .mockImplementationOnce(() => new Response('temporarily unavailable', { status: 503 }))
  .mockImplementationOnce(() => new Promise<Response>(resolve => { finishReplay = response => { fixture.replied = true; fixture.messageRows = [
   { id: fixture.receiptMessageId!, role: 'user', parts: [{ type: 'text', text: 'Señal A incierta' }] },
   { id: 'assistant-a-replayed', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta guardada' }] },
   { id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] },
  ]; resolve(response) } }))
 vi.stubGlobal('fetch', fetch)
 const view = render(<ChatView {...props} initialRecovery={recoveryB} initialMessages={[{ id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] }]} />)
 const input = screen.getByRole('textbox', { name: 'Mensaje para Serenia' }) as HTMLTextAreaElement
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(input, { target: { value: 'Señal A incierta' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/No hemos podido confirmar el envío/i)
 const firstRequestId = JSON.parse(fetch.mock.calls[0][1].body).requestId
 await waitFor(() => {
  expect(fixture.receiptRequestId).toBe(firstRequestId)
  expect((screen.getByRole('button', { name: 'Reintentar la misma señal guardada' }) as HTMLButtonElement).disabled).toBe(false)
 })
 fireEvent.change(input, { target: { value: 'Borrador siguiente' } })
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar la misma señal guardada' }))
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
 expect(screen.getAllByText('Señal A incierta')).toHaveLength(1)
 const transcript = view.container.querySelector('.flex-1.space-y-3.overflow-y-auto')!
 await act(async () => { finishReplay(reply('assistant-a-replayed')) })
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar la misma señal guardada' })).toBeNull())
 const transcriptTexts = Array.from(transcript.querySelectorAll('span.whitespace-pre-wrap')).map(node => node.textContent)
 expect(transcriptTexts.at(-1)).toBe('Turno B pendiente')
 expect(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' })).toBeTruthy()
 expect(screen.getAllByText('Señal A incierta')).toHaveLength(1)
 expect(screen.getByText('Turno B pendiente')).toBeTruthy()
 expect(input.value).toBe('Borrador siguiente')
 expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(true)
 const replay = JSON.parse(fetch.mock.calls[1][1].body)
 expect(replay.requestId).toBe(firstRequestId)
 expect(fixture.receiptMessageId).not.toBe(firstRequestId)
 expect(replay.messages).toEqual([{ id: firstRequestId, role: 'user', parts: [{ type: 'text', text: 'Señal A incierta' }] }])
})

it('waits to redirect from a crisis close while uncertain text can still be copied', async () => {
 vi.useFakeTimers()
 fixture.failed = false; fixture.omitUser = true; fixture.receipt = 'missing'; fixture.crisisCloseSnapshot = true
 const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
 vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard }))
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('temporarily unavailable', { status: 503 })))
 render(<ChatView {...props} initialMessages={[]} />)
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Señal A por confirmar' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve() })
 expect(screen.getAllByText(/Señal A por confirmar/).length).toBeGreaterThan(0)
 await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
 expect(fixture.push).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: 'Copiar texto' }))
 await act(async () => { await Promise.resolve(); await Promise.resolve() })
 expect(clipboard.writeText).toHaveBeenCalledWith('Señal A por confirmar')
 expect(screen.getByText('Texto copiado al portapapeles.')).toBeTruthy()
 await act(async () => { await vi.advanceTimersByTimeAsync(1_800) })
 expect(fixture.push).toHaveBeenCalledWith('/app')
})

it('keeps pending B safe when replay A succeeds but its follow-up read fails', async () => {
 fixture.failed = false; fixture.generating = 'waiting'; fixture.requestId = recoveryB.requestId; fixture.messageId = recoveryB.userMessageId; fixture.text = recoveryB.text
 fixture.receipt = 'completed'; fixture.receiptMessageId = '40000000-0000-4000-8000-000000000004'
 fixture.messageRows = [
  { id: fixture.receiptMessageId, role: 'user', parts: [{ type: 'text', text: 'Señal A incierta' }] },
  { id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] },
 ]
 const fetch = vi.fn()
  .mockImplementationOnce(() => new Response('temporarily unavailable', { status: 503 }))
  .mockImplementationOnce(async () => { fixture.failRecoveryRpc = true; return reply('assistant-a-replayed') })
  .mockImplementationOnce(() => new Response('temporarily unavailable', { status: 503 }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={recoveryB} initialMessages={[{ id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] }]} />)
 const input = screen.getByRole('textbox', { name: 'Mensaje para Serenia' }) as HTMLTextAreaElement
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(input, { target: { value: 'Señal A incierta' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/No hemos podido confirmar el envío/i)
 const firstRequestId = JSON.parse(fetch.mock.calls[0][1].body).requestId
 await waitFor(() => {
  expect(fixture.receiptRequestId).toBe(firstRequestId)
  expect((screen.getByRole('button', { name: 'Reintentar la misma señal guardada' }) as HTMLButtonElement).disabled).toBe(false)
 })
 fireEvent.change(input, { target: { value: 'Borrador B' } })
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar la misma señal guardada' }))
 await screen.findByText('Respuesta guardada')
 await screen.findByText(/No se pudo comprobar el estado/i)
 expect(screen.getByRole('button', { name: 'Comprobar y resolver turno pendiente' })).toBeTruthy()
 expect(screen.getByText('Turno B pendiente')).toBeTruthy()
 expect(input.value).toBe('Borrador B')
 fireEvent.change(input, { target: { value: 'Turno C ordinario' } })
 expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(true)
 expect(fetch).toHaveBeenCalledTimes(2)
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(input, { target: { value: 'Nueva señal urgente' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
 expect(JSON.parse(fetch.mock.calls[2][1].body).messages[0].parts[0].text).toBe('Nueva señal urgente')
})

it('keeps an interrupted receipt copyable without offering another replay', async () => {
 fixture.failed = false; fixture.omitUser = true; fixture.receipt = 'interrupted'
 fixture.messageRows = [{ id: fixture.receiptMessageId, role: 'user', parts: [{ type: 'text', text: 'Texto A interrumpido' }] }]
 const fetch = vi.fn().mockResolvedValue(new Response('temporarily unavailable', { status: 503 }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Texto A interrumpido' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/No hemos podido confirmar el envío/i)
 const requestId = JSON.parse(fetch.mock.calls[0][1].body).requestId
 await waitFor(() => expect(fixture.receiptRequestId).toBe(requestId))
 expect(screen.getAllByText(/El texto pendiente solo sigue en esta pantalla\. Cópialo antes de recargar o salir\./i)).toHaveLength(2)
 expect(screen.getByRole('button', { name: 'Copiar texto' })).toBeTruthy()
 expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
 expect(screen.queryByRole('button', { name: 'Reintentar la misma señal guardada' })).toBeNull()
 expect(screen.getAllByText('Texto A interrumpido')).toHaveLength(2)
})

it('lets a stopped ordinary turn check its exact receipt and reconcile a saved answer', async () => {
 fixture.failed = false; fixture.omitUser = true; fixture.receipt = 'completed'
 const persistedAId = '40000000-0000-4000-8000-000000000004'
 fixture.receiptMessageId = persistedAId
 let fetchSignal: AbortSignal | undefined
 const fetch = vi.fn((_url, options) => new Promise<Response>((_resolve, reject) => {
  fetchSignal = options.signal
  options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
 }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Turno A ordinario' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/Esperando respuesta/)
 const requestId = JSON.parse(fetch.mock.calls[0][1].body).requestId
 fixture.messageRows = [
  { id: persistedAId, role: 'user', parts: [{ type: 'text', text: 'Turno A ordinario' }] },
  { id: 'assistant-a', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta guardada' }] },
 ]
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 await waitFor(() => expect(fetchSignal?.aborted).toBe(true))
 const checkButton = await screen.findByRole('button', { name: 'Comprobar estado guardado' })
 fireEvent.click(checkButton)
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect(fixture.receiptRequestId).toBe(requestId))
 expect(screen.getAllByText('Turno A ordinario')).toHaveLength(1)
 expect(screen.queryByRole('button', { name: 'Copiar texto' })).toBeNull()
})

it('re-reads the closed transcript after a discarded snapshot races an active send', async () => {
 fixture.failed = false; fixture.omitUser = true
 fixture.messageRows = [{ id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] }]
 let finish!: () => void
 const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(reply('assistant-a')) }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Turno A en curso' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(finish).toBeTypeOf('function'))
 fireEvent.change(input, { target: { value: 'Borrador siguiente' } })
 fixture.closed = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await screen.findAllByText('La sesión ha terminado.')
 fixture.messageRows = [
  { id: 'user-a', role: 'user', parts: [{ type: 'text', text: 'Turno A en curso' }] },
  { id: 'assistant-a', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta de A' }] },
  { id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] },
  { id: 'assistant-b', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta de B' }] },
 ]
 await act(async () => { finish() })
 await screen.findByText('Respuesta de B')
 expect(screen.getByText('Respuesta de A')).toBeTruthy()
 expect(screen.getByText('Turno B pendiente')).toBeTruthy()
 expect((screen.getByRole('textbox', { name: 'Borrador sin enviar' }) as HTMLTextAreaElement).value).toBe('Borrador siguiente')
})

it('applies A receipt while B is the latest submission without getting stuck checking', async () => {
 fixture.failed = false; fixture.omitUser = true; fixture.generating = 'waiting'; fixture.requestId = recoveryB.requestId; fixture.messageId = recoveryB.userMessageId; fixture.text = recoveryB.text
 fixture.receipt = 'missing'
 const fetch = vi.fn().mockResolvedValue(new Response('temporarily unavailable', { status: 503 }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Señal A incierta' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/No hemos podido confirmar el envío/i)
 const requestA = JSON.parse(fetch.mock.calls[0][1].body).requestId
 fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
 fireEvent.change(input, { target: { value: 'Señal B incierta' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
 await screen.findByText('Señal B incierta')
 const requestB = JSON.parse(fetch.mock.calls[1][1].body).requestId
 expect(requestB).not.toBe(requestA)
 await waitFor(() => expect(fixture.receiptRequestId).toBe(requestB))
 expect(screen.getAllByRole('button', { name: 'Copiar texto' })).toHaveLength(2)
 fixture.receipt = 'completed'; fixture.receiptMessageId = '40000000-0000-4000-8000-000000000004'
 fixture.messageRows = [
  { id: fixture.receiptMessageId, role: 'user', parts: [{ type: 'text', text: 'Señal A incierta' }] },
  { id: 'assistant-a-canonical', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta A canónica' }] },
  { id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] },
 ]
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.receiptRequestId).toBe(requestA))
 await screen.findByText('Respuesta A canónica')
 expect(screen.getAllByText('Señal B incierta')).toHaveLength(1)
 expect(screen.getAllByText('Señal A incierta')).toHaveLength(1)
 expect(screen.queryByText('Estamos comprobando cómo terminó el turno.')).toBeNull()
})

it('re-reads closed history when the first closed snapshot resolves after the send ends', async () => {
 fixture.failed = false; fixture.omitUser = true
 fixture.holdNextMessages = true
 fixture.messageRows = [{ id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] }]
 let finish!: () => void
 const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(reply('assistant-a')) }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Turno A en curso' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(finish).toBeTypeOf('function'))
 fixture.closed = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 await act(async () => { finish() })
 await screen.findByText('Respuesta guardada')
 fixture.messageRows = [
  { id: 'user-a', role: 'user', parts: [{ type: 'text', text: 'Turno A en curso' }] },
  { id: 'assistant-a', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta A final' }] },
  { id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] },
  { id: 'assistant-b', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta B final' }] },
 ]
 await act(async () => { fixture.releases.shift()!() })
 await screen.findByText('Respuesta B final')
 expect(screen.getByText('Respuesta A final')).toBeTruthy()
 expect(screen.getByText('Turno B pendiente')).toBeTruthy()
})

it('waits for the active transport before retrying a deferred closed-history read', async () => {
 fixture.failed = false; fixture.omitUser = true
 fixture.holdNextMessages = true
 fixture.messageRows = [{ id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] }]
 let finish!: () => void
 const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(reply('assistant-a')) }))
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Turno A en curso' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(finish).toBeTypeOf('function'))
 fixture.closed = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 await waitFor(() => expect(fixture.releases).toHaveLength(1))
 const readsBeforeRelease = fixture.messageReads
 await act(async () => { fixture.releases.shift()!(); await Promise.resolve() })
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
 expect(fixture.messageReads).toBe(readsBeforeRelease)

 fixture.messageRows = [
  { id: 'user-a', role: 'user', parts: [{ type: 'text', text: 'Turno A en curso' }] },
  { id: 'assistant-a', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta A final' }] },
  { id: recoveryB.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryB.text }] },
  { id: 'assistant-b', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta B final' }] },
 ]
 await act(async () => { finish() })
 await screen.findByText('Respuesta B final')
 await waitFor(() => expect(fixture.messageReads).toBe(readsBeforeRelease + 1))
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
 expect(fixture.messageReads).toBe(readsBeforeRelease + 1)
})

it('uses the server clock even when the browser wall clock is a day ahead', async () => {
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
 render(<ChatView {...props} initialRecovery={null} serverNow={new Date('2026-10-27T12:00:00Z')} expiresAt={new Date('2026-10-27T12:02:00Z')} />)
 expect(screen.getByText('2 min restantes')).toBeTruthy()
 vi.setSystemTime(new Date('2026-10-30T12:00:00Z'))
 await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
 expect(screen.getByText('1 min restantes')).toBeTruthy()
})
it('allows retrying the same accepted turn after the displayed deadline', async () => {
 const fetch = vi.fn().mockImplementation(async () => reply()); vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} expiresAt={new Date(Date.now()-1000)} />)
 const button = screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }) as HTMLButtonElement
 expect(button.disabled).toBe(false)
 fireEvent.click(button); await screen.findByText('Respuesta guardada')
 expect(JSON.parse(fetch.mock.calls[0][1].body).requestId).toBe('retry-original')
})
it('keeps an unsent draft when a saved external closure arrives', async () => {
 render(<ChatView {...props} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Un detalle que todavía no he enviado' } })
 fixture.closed = true
 fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
 const draft = await screen.findByRole('textbox', { name: 'Borrador sin enviar' }) as HTMLTextAreaElement
 expect(draft.value).toBe('Un detalle que todavía no he enviado'); expect(draft.readOnly).toBe(true)
 expect(fixture.refresh).not.toHaveBeenCalled()
})
it('retains text typed while the final admitted answer arrives with a persisted time closure', async () => {
 fixture.failed = false
 let finish!: () => void
 vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(createUIMessageStreamResponse({ stream: new ReadableStream({ start(c) {
   c.enqueue({ type: 'start', messageId: 'final-answer' }); c.enqueue({ type: 'text-start', id: 'answer' })
   c.enqueue({ type: 'text-delta', id: 'answer', delta: 'Respuesta final guardada' }); c.enqueue({ type: 'text-end', id: 'answer' })
   c.enqueue({ type: 'data-session-closed', data: { closed: true, reason: 'time_limit' } }); c.enqueue({ type: 'finish' }); c.close()
 } }) })) })))
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Último mensaje admitido' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await waitFor(() => expect(finish).toBeTypeOf('function'))
 fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador nuevo aún no enviado' } })
 await act(async () => { finish() })
 await screen.findByText('Respuesta final guardada')
 const draft = await screen.findByRole('textbox', { name: 'Borrador sin enviar' }) as HTMLTextAreaElement
 expect(draft.value).toBe('Borrador nuevo aún no enviado')
 expect(fixture.refresh).not.toHaveBeenCalled()
})


it.each(['', 'Una idea posterior', 'Mi texto original'])('separates sent A from draft B through failure and retry (B=%j)', async nextDraft => {
 fixture.failed = false
 let fail!: () => void
 const fetch = vi.fn().mockImplementationOnce((_url, init) => {
  const body = JSON.parse(init.body)
  fixture.requestId = body.requestId; fixture.messageId = body.requestId; fixture.text = 'Mi texto original'
  return new Promise<Response>(resolve => { fail = () => resolve(new Response('temporarily unavailable', { status: 503 })) })
 }).mockImplementation(async () => reply())
 vi.stubGlobal('fetch', fetch)
 render(<ChatView {...props} initialRecovery={null} initialMessages={[]} />)
 const input = screen.getByRole('textbox') as HTMLTextAreaElement
 fireEvent.change(input, { target: { value: 'Mi texto original' } })
 fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
 await screen.findByText(/Esperando respuesta/)
 expect(input.value).toBe('')
 fireEvent.change(input, { target: { value: nextDraft } })
 fixture.failed = true
 await act(async () => { fail() })
 await screen.findByRole('button', { name: 'Reintentar el mismo mensaje' })
 expect(input.value).toBe(nextDraft)
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' }))
 await screen.findByText('Respuesta guardada')
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull())
 expect(input.value).toBe(nextDraft)
 expect(screen.getAllByText('Mi texto original', { selector: 'span' })).toHaveLength(1)
 expect(JSON.parse(fetch.mock.calls[1][1].body).requestId).toBe(JSON.parse(fetch.mock.calls[0][1].body).requestId)
 expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(!nextDraft)
 if (nextDraft) {
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  const next = JSON.parse(fetch.mock.calls[2][1].body)
  expect(next.requestId).not.toBe(JSON.parse(fetch.mock.calls[0][1].body).requestId)
  expect(next.messages[0].parts[0].text).toBe(nextDraft)
 }
})
