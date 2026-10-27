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
  expect(f.close).toHaveBeenCalledWith('timed', 'time_limit')
  expect(f.refresh).not.toHaveBeenCalled(); expect(f.push).not.toHaveBeenCalled()
})
it('does not claim closure on an action failure and offers another attempt', async () => {
  f.close.mockRejectedValue(new Error('unavailable')); view()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  await screen.findByText(/No se pudo confirmar el cierre/)
  expect(screen.queryByText('La sesión ha terminado.')).toBeNull()
  expect((screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }) as HTMLButtonElement).disabled).toBe(false)
})
it('respects a pending admitted response and a corrected server deadline', async () => {
  f.close.mockResolvedValueOnce({ closed: false, reason: 'turn_pending', timing: { serverNow: now, expiresAt: now } })
    .mockResolvedValueOnce({ closed: false, reason: 'not_expired', timing: { serverNow: now, expiresAt: now + 120_000 } })
  view(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  await screen.findByText(/Hay una respuesta en curso/)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre por tiempo' }))
  await screen.findByText('2 min restantes')
  expect(screen.getByRole('button', { name: 'Terminar sesión' })).toBeTruthy()
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
