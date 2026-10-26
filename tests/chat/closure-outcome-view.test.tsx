// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/app/app/actions', () => ({ endSessionAction: async () => {} }))
vi.mock('@/app/app/chat-recovery-actions', () => ({ getOwnedChatState: vi.fn() }))
import { ChatView } from '@/components/chat/chat-view'
afterEach(() => { cleanup(); vi.clearAllMocks() })

it.each(['confirm_close_session', 'close_session_crisis'])('keeps conversation usable after %s returns closed:false', async tool => {
  const messages: UIMessage[] = [{ id: `failed-${tool}`, role: 'assistant', parts: [{ type: `tool-${tool}`, toolCallId: 'call', state: 'output-available', input: {}, output: { closed: false, reason: 'confirmation_required' } }] }]
  render(<ChatView sessionId={`failed-${tool}`} initialMessages={messages} expiresAt={new Date(Date.now() + 50 * 60_000)} />)
  const input = screen.getByRole('textbox') as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: 'Sí, cerramos' } })
  expect(input.value).toBe('Sí, cerramos')
  expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(false)
  expect(router.push).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled()
})

it('refreshes the server card from a persisted recovered questionnaire output', async () => {
  const messages: UIMessage[] = [{ id: 'recovered', role: 'assistant', parts: [{ type: 'tool-propose_questionnaire', toolCallId: 'persisted-card', state: 'output-available', input: { code: 'CSSRS' }, output: { proposed: true, code: 'CSSRS', instanceId: 'quiz' } }] }]
  render(<ChatView sessionId="recovered" initialMessages={messages} expiresAt={new Date(Date.now() + 50 * 60_000)} />)
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1))
})
