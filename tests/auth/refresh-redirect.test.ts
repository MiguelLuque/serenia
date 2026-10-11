/* eslint-disable @typescript-eslint/no-explicit-any -- SSR adapter callback test */
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient }))
import { updateSession } from '@/lib/server/supabase/middleware'
import { proxy } from '@/proxy'

describe('refresh cookies/cache headers survive proxy redirects', () => {
  it.each([
    ['/private', false, '/login'], ['/login', true, '/app'], ['/app/session', true, '/onboarding'],
  ] as const)('%s refresh → %s → %s', async (path, signedIn, destination) => {
    createServerClient.mockImplementation((_url: string, _key: string, options: any) => ({
      auth: { getUser: async () => {
        options.cookies.setAll([{ name: 'first', value: 'a', options: { httpOnly: true } }], { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' })
        options.cookies.setAll([{ name: 'refresh', value: 'b', options: { httpOnly: true } }], { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' })
        return { data: { user: signedIn ? { id: 'user' } : null } }
      } },
      rpc: async () => ({ data: false, error: null }),
      from: () => ({ select() { return this }, eq() { return this }, single: async () => ({ data: { onboarding_status: 'pending' } }) }),
    }))
    const response = await updateSession(new NextRequest(`http://localhost${path}`))
    expect(response.headers.get('location')).toBe(`http://localhost${destination}`)
    expect(response.cookies.get('first')?.value).toBe('a')
    expect(response.cookies.get('refresh')?.value).toBe('b')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('expires')).toBe('0')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })
  it('bypasses session auth only for the exact cron endpoint', async () => {
    createServerClient.mockClear()
    const response = await proxy(new NextRequest('http://localhost/api/internal/close-stale-sessions'))
    expect(response.status).toBe(200)
    expect(createServerClient).not.toHaveBeenCalled()
    await proxy(new NextRequest('http://localhost/api/internal/close-stale-sessions/extra'))
    expect(createServerClient).toHaveBeenCalled()
  })
})
