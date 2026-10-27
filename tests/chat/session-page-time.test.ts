import { expect, it, vi } from 'vitest'
const f = vi.hoisted(() => ({ close: vi.fn(), redirect: vi.fn(), openedAt: new Date(Date.now() - 61 * 60_000).toISOString() }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { f.redirect(url); throw new Error('redirect') } }))
vi.mock('@/lib/server/sessions/service', async original => ({ ...await original<typeof import('@/lib/server/sessions/service')>(), closeSession: f.close }))
vi.mock('@/lib/server/questionnaires/service', () => ({ getActiveInstanceForSession: async () => null }))
vi.mock('@/components/chat/chat-view', () => ({ ChatView: () => null }))
const recovery = { requestId: 'accepted', userMessageId: 'user-message', text: 'Texto aceptado', status: 'generating', canRetry: false, leaseUntil: new Date(Date.now() + 60_000).toISOString() }
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
  rpc: async () => ({ data: recovery, error: null }),
  from: (table: string) => { const q = { select: () => q, eq: () => q, order: () => q, single: () => q, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'clinical_sessions' ? { id: 'session', user_id: 'owner', conversation_id: 'conv', status: 'open', opened_at: f.openedAt } : [], error: null }).then(resolve) }; return q },
}) }))
import SessionPage from '@/app/app/sesion/[id]/page'
it('renders an expired open session with recovery instead of closing a pending turn on reload', async () => {
  const view = await SessionPage({ params: Promise.resolve({ id: 'session' }) })
  expect(view.props.initialRecovery).toEqual(recovery)
  expect(view.props.expiresAt.getTime()).toBeLessThan(Date.now())
  expect(view.props.serverNow).toBeInstanceOf(Date)
  expect(f.close).not.toHaveBeenCalled(); expect(f.redirect).not.toHaveBeenCalled()
})
