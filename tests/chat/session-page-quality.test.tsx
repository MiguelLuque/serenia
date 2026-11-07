// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const f = vi.hoisted(() => ({
  owner: 'owner', closed: false, complete: false, closeOnCommit: false,
  commitAt: '' as '' | 'messages' | 'recovery', committed: false,
  redirect: vi.fn(), push: vi.fn(), filters: [] as Array<[string, unknown]>,
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { f.redirect(url); throw new Error('redirect') },
  useRouter: () => ({ push: f.push, refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/lib/server/questionnaires/service', () => ({ getActiveInstanceForSession: async () => null }))
vi.mock('@/lib/server/workflows', () => ({ enqueueAssessmentGeneration: vi.fn() }))
const finalAnswer = { id: 'answer', role: 'assistant', parts: [{ type: 'text', text: 'Respuesta final guardada' }] }
const userMessage = { id: 'user-message', role: 'user', parts: [{ type: 'text', text: 'Mi pregunta' }] }
const pending = { requestId: 'accepted', userMessageId: 'user-message', text: 'Mi pregunta', status: 'generating', canRetry: false, leaseUntil: new Date(Date.now() + 60_000).toISOString() }
function commit(boundary: string) {
  if (f.commitAt === boundary && !f.committed) { f.committed = true; f.complete = true; f.closed = f.closeOnCommit }
}
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
  rpc: async (name: string) => {
    expect(name).toBe('get_chat_turn_recovery')
    const data = f.complete || f.closed ? null : pending
    commit('recovery')
    return { data, error: null }
  },
  from: (table: string) => {
    const q = {
      select: () => q, eq: (key: string, value: unknown) => { f.filters.push([key, value]); return q }, order: () => q, single: () => q,
      then: (resolve: (value: unknown) => unknown) => {
        const data = table === 'clinical_sessions'
          ? { id: 'session', user_id: f.owner, conversation_id: 'conv', status: f.closed ? 'closed' : 'open', opened_at: new Date().toISOString() }
          : [userMessage, ...(f.complete ? [finalAnswer] : [])]
        if (table === 'messages') commit('messages')
        return Promise.resolve({ data, error: null }).then(resolve)
      },
    }
    return q
  },
}) }))
import SessionPage from '@/app/app/sesion/[id]/page'
beforeEach(() => { f.owner = 'owner'; f.closed = false; f.complete = false; f.closeOnCommit = false; f.commitAt = ''; f.committed = false; f.filters = []; vi.clearAllMocks() })
afterEach(() => cleanup())

it('reloads an owned closed session read-only with its persisted final answer and voluntary exit', async () => {
  f.closed = true; f.complete = true
  const view = await SessionPage({ params: Promise.resolve({ id: 'session' }) })
  render(view)
  expect(screen.getByText('Respuesta final guardada')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('link', { name: 'Vuelve al inicio.' }).getAttribute('href')).toBe('/app')
  expect(f.redirect).not.toHaveBeenCalled(); expect(f.push).not.toHaveBeenCalled()
})
it('rejects another owner before loading the transcript even if the backing query misbehaves', async () => {
  f.owner = 'outsider'
  await expect(SessionPage({ params: Promise.resolve({ id: 'session' }) })).rejects.toThrow('redirect')
  expect(f.redirect).toHaveBeenCalledWith('/app')
  expect(f.filters).toContainEqual(['user_id', 'owner'])
})
it.each([
  ['messages', false], ['messages', true], ['recovery', false], ['recovery', true],
] as const)('reconciles completion across SSR %s read (closed=%s)', async (boundary, closed) => {
  f.commitAt = boundary; f.closeOnCommit = closed
  const view = await SessionPage({ params: Promise.resolve({ id: 'session' }) })
  render(view)
  expect(screen.getByText('Respuesta final guardada')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Reintentar el mismo mensaje' })).toBeNull()
  expect(screen.queryByText(/La respuesta sigue pendiente/)).toBeNull()
  if (closed) {
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  } else {
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false)
  }
})
