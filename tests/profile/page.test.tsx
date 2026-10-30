import React from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), from: vi.fn(), eq: vi.fn(), in: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: mocks.client }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') }, redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) }, useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/server/sessions/service', () => ({ getOrResolveActiveSession: () => { throw new Error('GET MUST NOT RESOLVE SESSION') } }))
import Page from '@/app/app/perfil/page'
import { ProfileMemoryView } from '@/components/profile/profile-memory'
import AppLayout from '@/app/app/layout'
import { AppSidebar } from '@/components/app/app-sidebar'
const id = '10000000-0000-4000-8000-000000000001'
const targetId = '10000000-0000-4000-8000-000000000002'
const observation = { id, category: 'concern', quote: 'Ahora duermo bien.', time_scope: 'current', status: 'pending', supersedes_id: targetId, source_message_id: id, session_id: id, source_created_at: '2026-10-28T12:00:00+00:00', updated_at: '2026-10-28T12:01:00.123456+00:00', disputed: false }
const memory = { enabled: false, pending_jobs: 0, failed_jobs: 0, observations: [] as typeof observation[], next_cursor: null }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'on')
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-user' } }, error: null })
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_onboarding_ready' ? true : memory, error: null }))
  const chain = { select: vi.fn(() => chain), eq: mocks.eq, in: mocks.in, limit: mocks.limit, single: async () => ({ data: { role: 'patient' }, error: null }) }
  mocks.eq.mockReturnValue(chain); mocks.in.mockReturnValue(chain)
  mocks.limit.mockResolvedValue({ data: [{ id: targetId, quote: 'Antes dormía mal.', source_created_at: '2026-10-27T12:00:00+00:00' }], error: null })
  mocks.from.mockReturnValue(chain)
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from })
})
function viewProps(element: React.ReactElement) {
  if (element.type === ProfileMemoryView) return element.props as React.ComponentProps<typeof ProfileMemoryView>
  const children = React.Children.toArray((element.props as { children?: React.ReactNode }).children)
  for (const child of children) if (React.isValidElement(child) && child.type === ProfileMemoryView) return child.props as React.ComponentProps<typeof ProfileMemoryView>
  throw new Error('Missing memory view')
}
it('flag off returns 404 before any authenticated client or table query', async () => {
  vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'off')
  await expect(Page()).rejects.toThrow('NOT_FOUND')
  expect(mocks.client).not.toHaveBeenCalled()
})
it('redirects invalid auth without new profile queries', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(Page()).rejects.toThrow('REDIRECT:/login')
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('requires adult onboarding before memory GET', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null })
  await expect(Page()).rejects.toThrow('REDIRECT:/onboarding')
  expect(mocks.rpc.mock.calls).toEqual([['get_onboarding_ready']])
})
it('reads a validated owner projection without resolving or closing active sessions', async () => {
  expect(viewProps(await Page()).memory).toEqual(memory)
  expect(mocks.rpc.mock.calls).toEqual([['get_onboarding_ready'], ['get_profile_memory_page', {}]])
  expect(mocks.from).not.toHaveBeenCalled()
})
it.each(['rpc-error', 'throw', 'invalid-shape'])('contains %s without exposing private text', async mode => {
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === 'get_onboarding_ready') return { data: true, error: null }
    if (mode === 'throw') throw new Error('PRIVATE TOKEN')
    return mode === 'rpc-error' ? { data: null, error: { message: 'PRIVATE TOKEN' } } : { data: { enabled: true }, error: null }
  })
  const props = viewProps(await Page())
  expect(props.memory).toBeNull()
  expect(JSON.stringify(props)).not.toContain('PRIVATE')
})
it('loads only missing correction targets with explicit owner filter and bounded projection', async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_onboarding_ready' ? true : { ...memory, observations: [observation] }, error: null }))
  const props = viewProps(await Page())
  expect(props.replacementSources).toEqual({ [targetId]: { quote: 'Antes dormía mal.', source_created_at: '2026-10-27T12:00:00+00:00' } })
  expect(mocks.from).toHaveBeenCalledWith('profile_observations')
  expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner-user')
  expect(mocks.in).toHaveBeenCalledWith('id', [targetId])
  expect(mocks.limit).toHaveBeenCalledWith(1)
})
it('does not supplement a correction already present in the consistent projection', async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_onboarding_ready' ? true : { ...memory, observations: [observation, { ...observation, id: targetId, supersedes_id: null, status: 'confirmed' }] }, error: null }))
  await Page()
  expect(mocks.from).not.toHaveBeenCalled()
})
it('keeps missing source explicit when bounded lookup fails', async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_onboarding_ready' ? true : { ...memory, observations: [observation] }, error: null }))
  mocks.limit.mockResolvedValue({ data: null, error: { message: 'PRIVATE' } })
  expect(viewProps(await Page()).replacementSources).toEqual({})
})
it.each(['on', 'off'])('passes only the server flag %s to patient navigation', async flag => {
  vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', flag)
  const layout = await AppLayout({ children: null })
  const sidebar = React.Children.toArray(layout.props.children).find(child => React.isValidElement(child) && child.type === AppSidebar)
  expect(React.isValidElement(sidebar) && (sidebar.props as { profileMemoryEnabled: boolean }).profileMemoryEnabled).toBe(flag === 'on')
})

it('forwards the complete precise cursor without Date normalization and remounts page state', async () => {
  const cursor = { before_created_at: '2026-10-28T12:00:00.123456+00:00', before_id: id }
  const recent = await Page()
  const older = await Page({ searchParams: Promise.resolve(cursor) })
  expect(mocks.rpc).toHaveBeenLastCalledWith('get_profile_memory_page', { p_before_created_at: cursor.before_created_at, p_before_id: id })
  expect(older.key).not.toBe(recent.key)
  expect(viewProps(older).isOlderPage).toBe(true)
})
it.each([
  { before_id: id }, { before_created_at: '2026-10-28T12:00:00Z' },
  { before_id: 'invalid', before_created_at: '2026-10-28T12:00:00Z' },
  { before_id: id, before_created_at: '2026-02-30T12:00:00Z' },
  { before_id: [id, id], before_created_at: '2026-10-28T12:00:00Z' },
  { user_id: id }, { before_id: id, before_created_at: 'infinity' },
  { before_id: id, before_created_at: '2026-10-28T12:00:00.1234567Z' },
  { before_id: id, before_created_at: ['2026-10-28T12:00:00Z'] },
  { before_id: id, before_created_at: '2026-10-28T12:00:00Z', user_id: id },
])('recovers invalid or extra search parameters %j through recent without querying history', async query => {
  await expect(Page({ searchParams: Promise.resolve(query) })).rejects.toThrow('REDIRECT:/app/perfil')
  expect(mocks.rpc.mock.calls.map(call => call[0])).not.toContain('get_profile_memory_page')
})

it('keeps flag and auth guards before malformed cursor recovery', async () => {
  const query = { searchParams: Promise.resolve({ before_id: 'invalid' }) }
  vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'off')
  await expect(Page(query)).rejects.toThrow('NOT_FOUND')
  expect(mocks.client).not.toHaveBeenCalled()
  vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'on')
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(Page(query)).rejects.toThrow('REDIRECT:/login')
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('does not retain the older page action identity when returning to recent', async () => {
  const first = await Page({ searchParams: Promise.resolve({ before_created_at: '2026-10-28T12:00:00.123456Z', before_id: id }) })
  const second = await Page({ searchParams: Promise.resolve({ before_created_at: '2026-10-28T12:00:00.123455Z', before_id: id }) })
  const recent = await Page()
  expect(new Set([first.key, second.key, recent.key]).size).toBe(3)
})
