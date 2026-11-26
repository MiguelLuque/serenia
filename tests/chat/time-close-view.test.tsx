// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
const f = vi.hoisted(() => ({ close: vi.fn(), state: vi.fn(), refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: f.refresh, replace: vi.fn(), push: f.push }) }))
vi.mock('@/app/app/chat-recovery-actions', () => ({ getOwnedChatState: f.state, closeOwnedSessionFromView: f.close }))
import { ChatView } from '@/components/chat/chat-view'
const now = Date.parse('2026-10-27T12:00:00Z')
function view() { return render(<ChatView sessionId="timed" initialMessages={[]} serverNow={new Date(now)} expiresAt={new Date(now)} />) }
beforeEach(() => { vi.clearAllMocks(); f.close.mockReset(); f.state.mockReset() })
afterEach(() => { cleanup(); vi.useRealTimers() })

it('confirms closure explicitly and retains an unsent urgent draft without navigating', async () => {
  f.close.mockResolvedValue({ closed: true })
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Un detalle sin enviar' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  const draft = await screen.findByRole('textbox', { name: 'Borrador sin enviar' }) as HTMLTextAreaElement
  expect(draft.value).toBe('Un detalle sin enviar')
  expect(f.close).toHaveBeenCalledWith('timed', 'time_limit', null)
  expect(f.refresh).not.toHaveBeenCalled(); expect(f.push).not.toHaveBeenCalled()
})
it('keeps closure uncertain after an action failure until saved state is checked', async () => {
  f.close.mockRejectedValue(new Error('unavailable'))
  f.state.mockResolvedValue({ closed: false, recovery: null, messages: [], timing: { serverNow: now, expiresAt: now } })
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  await screen.findByText(/No se pudo confirmar el cierre/)
  expect(screen.queryByText('La sesión ha terminado.')).toBeNull()
  expect((screen.getByRole('button', { name: 'Cierre sin confirmar' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar estado guardado' }))
  await screen.findByText('El estado guardado confirma que la sesión sigue abierta.')
  expect((screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }) as HTMLButtonElement).disabled).toBe(false)
})
it('times out a stalled close, leaves urgent composition available, and reconciles a late close', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now)
  let finish!: (value: { closed: true }) => void
  f.close.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  f.state.mockResolvedValue({ closed: true, recovery: null, messages: [] })
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  expect((screen.getByRole('button', { name: 'Confirmando cierre…' }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
  expect(screen.getByText(/No se pudo confirmar el cierre/)).toBeTruthy()
  expect(screen.queryByText('La sesión ha terminado.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Interrumpir espera y enviar una señal urgente' }))
  const input = screen.getByRole('textbox', { name: 'Mensaje para Serenia' }) as HTMLTextAreaElement
  expect(input.disabled).toBe(false)
  fireEvent.change(input, { target: { value: 'Señal urgente aún no enviada' } })
  await act(async () => {
    finish({ closed: true })
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })
  expect(screen.getAllByText('La sesión ha terminado.').length).toBeGreaterThan(0)
  expect((screen.getByRole('textbox', { name: 'Borrador sin enviar' }) as HTMLTextAreaElement).value).toBe('Señal urgente aún no enviada')
})
it('respects a pending admitted response and a corrected server deadline', async () => {
  f.close.mockResolvedValueOnce({ closed: false, reason: 'turn_pending', timing: { serverNow: now, expiresAt: now } })
    .mockResolvedValueOnce({ closed: false, reason: 'not_expired', timing: { serverNow: now, expiresAt: now + 120_000 } })
  view(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  await screen.findByText(/Hay una respuesta en curso/)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  await screen.findByText('2 min restantes')
  expect(f.close).toHaveBeenNthCalledWith(1, 'timed', 'time_limit', null)
  expect(f.close).toHaveBeenNthCalledWith(2, 'timed', 'time_limit', null)
  expect(screen.getByRole('button', { name: 'Terminar sesión' })).toBeTruthy()
})
it('offers saved-state recovery when a manual close finds a turn from another tab', async () => {
  f.close.mockResolvedValueOnce({ closed: false, reason: 'turn_pending', timing: { serverNow: now, expiresAt: now + 60 * 60_000 } })
  f.state.mockResolvedValue({ closed: false, recovery: null, messages: [], timing: { serverNow: now, expiresAt: now + 60 * 60_000 } })
  render(<ChatView sessionId="open-pending" initialMessages={[]} serverNow={new Date(now)} expiresAt={new Date(now + 60 * 60_000)} />)

  fireEvent.click(screen.getByRole('button', { name: 'Terminar sesión' }))
  expect(f.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Sí, terminar la sesión' }))
  await screen.findByText(/Hay una respuesta en curso/)

  expect(screen.getByText('60 min restantes')).toBeTruthy()
  expect(screen.queryByText('El contador indica el fin del tiempo; falta confirmar el cierre guardado.')).toBeNull()
  expect(screen.getByRole('button', { name: 'Comprobar estado guardado' })).toBeTruthy()
  expect(f.state).toHaveBeenCalledWith('open-pending', undefined)
})
it('asks for a second explicit confirmation before closing with an unresolved turn', async () => {
  f.close.mockResolvedValueOnce({ closed: false, reason: 'turn_unresolved', requestId: 'turn-A', attempt: 1, timing: { serverNow: now, expiresAt: now } })
    .mockResolvedValueOnce({ closed: true, newlyClosed: true })
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  await screen.findByText(/El último mensaje está guardado, pero no hay una respuesta confirmada/)
  fireEvent.click(screen.getByRole('button', { name: 'Terminar sin respuesta' }))
  await screen.findAllByText('La sesión ha terminado.')
  expect(f.close).toHaveBeenNthCalledWith(1, 'timed', 'time_limit', null)
  expect(f.close).toHaveBeenNthCalledWith(2, 'timed', 'time_limit', { requestId: 'turn-A', attempt: 1 })
})
it('requires a fresh confirmation if the unresolved turn changes between clicks', async () => {
  f.close.mockResolvedValueOnce({ closed: false, reason: 'turn_unresolved', requestId: 'turn-A', attempt: 1, timing: { serverNow: now, expiresAt: now } })
    .mockResolvedValueOnce({ closed: false, reason: 'turn_unresolved', requestId: 'turn-B', attempt: 1, timing: { serverNow: now, expiresAt: now } })
    .mockResolvedValueOnce({ closed: true, newlyClosed: true })
  view()

  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  await screen.findByText(/El último mensaje está guardado, pero no hay una respuesta confirmada/)
  fireEvent.click(screen.getByRole('button', { name: 'Terminar sin respuesta' }))
  await screen.findByText(/El turno pendiente ha cambiado desde la confirmación/)
  fireEvent.click(screen.getByRole('button', { name: 'Terminar sin respuesta' }))
  await screen.findAllByText('La sesión ha terminado.')

  expect(f.close).toHaveBeenNthCalledWith(1, 'timed', 'time_limit', null)
  expect(f.close).toHaveBeenNthCalledWith(2, 'timed', 'time_limit', { requestId: 'turn-A', attempt: 1 })
  expect(f.close).toHaveBeenNthCalledWith(3, 'timed', 'time_limit', { requestId: 'turn-B', attempt: 1 })
})
it('resynchronizes elapsed time and saved state on focus after a suspended tab', async () => {
  f.state.mockResolvedValue({ closed: false, recovery: null, messages: [], timing: { serverNow: now + 61 * 60_000, expiresAt: now + 60 * 60_000 } })
  render(<ChatView sessionId="resumed" initialMessages={[]} serverNow={new Date(now)} expiresAt={new Date(now + 60 * 60_000)} />)
  expect(screen.getByText('60 min restantes')).toBeTruthy()
  fireEvent.focus(window)
  await screen.findByText('Tiempo agotado · cierre pendiente de confirmar')
  expect(f.close).not.toHaveBeenCalled()
})
it('recognizes a committed static time closure and does not refresh a questionnaire into a redirect', async () => {
  const messages: UIMessage[] = [{ id: 'closed', role: 'assistant', parts: [
    { type: 'text', text: 'Cierre registrado' },
    { type: 'tool-propose_questionnaire', toolCallId: 'quiz', state: 'output-available', input: {}, output: { proposed: true, instanceId: 'quiz' } },
    { type: 'data-session-closed', data: { closed: true, reason: 'time_limit' } },
  ] }]
  render(<ChatView sessionId="closed" initialMessages={messages} serverNow={new Date(now)} expiresAt={new Date(now)} />)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar cierre por tiempo' })).toBeNull())
  expect(screen.queryByRole('textbox')).toBeNull(); expect(f.refresh).not.toHaveBeenCalled()
})
it('checks a pending lease after two server minutes even if the browser is an hour behind', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now - 60 * 60_000)
  const recovery = { requestId: 'accepted', userMessageId: 'message', text: 'Hola', status: 'generating' as const, canRetry: false, leaseUntil: new Date(now + 2 * 60_000).toISOString() }
  f.state.mockResolvedValue({ closed: false, recovery: { ...recovery, canRetry: true }, messages: [], timing: { serverNow: now + 2 * 60_000, expiresAt: now + 60 * 60_000 } })
  render(<ChatView sessionId="lease-clock" initialMessages={[]} initialRecovery={recovery} serverNow={new Date(now)} expiresAt={new Date(now + 60 * 60_000)} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60_000 + 101) })
  expect(f.state).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeTruthy()
})

it('the time-expired notice keeps 024 and 112 as phone links', () => {
  view()
  const notice = screen.getAllByRole('status').find(node => node.textContent?.includes('Tiempo agotado para mensajes nuevos ordinarios'))!
  expect(notice.textContent).toMatch(/ayuda inmediata/)
  const hrefs = Array.from(notice.querySelectorAll('a')).map(a => a.getAttribute('href'))
  expect(hrefs).toEqual(expect.arrayContaining(['tel:024', 'tel:112']))
})
it('asks before a voluntary close and keeps the session open when the patient goes back', async () => {
  render(<ChatView sessionId="open-confirm" initialMessages={[]} serverNow={new Date(now)} expiresAt={new Date(now + 60 * 60_000)} />)
  fireEvent.click(screen.getByRole('button', { name: 'Terminar sesión' }))
  expect(screen.getByText(/¿Terminar la sesión\?/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Seguir en la sesión' }))
  expect(screen.queryByText(/¿Terminar la sesión\?/)).toBeNull()
  expect(f.close).not.toHaveBeenCalled()
  expect(screen.getByText('60 min restantes')).toBeTruthy()
})
