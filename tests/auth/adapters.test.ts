import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CookieOptions, CookieMethodsServer } from '@supabase/ssr'
const mocks = vi.hoisted(() => ({ server: vi.fn(), browser: vi.fn(), service: vi.fn(), cookies: { getAll: vi.fn(() => []), set: vi.fn() }, exchange: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.server, createBrowserClient: mocks.browser }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.service }))
vi.mock('next/headers', () => ({ cookies: async () => mocks.cookies }))
import { createAuthenticatedClient, createServiceRoleClient } from '@/lib/server/supabase/server'
import { createClient } from '@/lib/server/supabase/client'
import { GET } from '@/app/auth/callback/route'
type Adapter = { cookies: CookieMethodsServer }
const headers = { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_synthetic')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-synthetic')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_synthetic')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'legacy-service-synthetic')
  mocks.cookies.set.mockImplementation(() => {})
  mocks.exchange.mockResolvedValue({ error: null })
  mocks.server.mockImplementation((_url: string, _key: string, options: Adapter) => ({ auth: { exchangeCodeForSession: async (code: string, flow?: { flowId: string }) => {
    options.cookies.setAll?.([{ name: 'session', value: 'synthetic', options: { path: '/', sameSite: 'lax' } }, { name: 'verifier', value: '', options: { maxAge: 0 } }], headers)
    return flow ? mocks.exchange(code, flow) : mocks.exchange(code)
  } } }))
})
describe('Supabase request adapters', () => {
  it('prefers modern public/secret keys and explicitly falls back to legacy keys', async () => {
    createClient(); await createAuthenticatedClient(); createServiceRoleClient()
    expect(mocks.browser.mock.calls[0][1]).toBe('sb_publishable_synthetic')
    expect(mocks.server.mock.calls[0][1]).toBe('sb_publishable_synthetic')
    expect(mocks.service.mock.calls[0][1]).toBe('sb_secret_synthetic')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ''); vi.stubEnv('SUPABASE_SECRET_KEY', '')
    createClient(); createServiceRoleClient()
    expect(mocks.browser.mock.calls[1][1]).toBe('legacy-synthetic')
    expect(mocks.service.mock.calls[1][1]).toBe('legacy-service-synthetic')
  })
  it('read-only Server Components rely on the proxy rather than throwing on refresh', async () => {
    mocks.cookies.set.mockImplementation(() => { throw new Error('Cookies can only be modified in a Server Action or Route Handler.') })
    await createAuthenticatedClient()
    const options = mocks.server.mock.calls[0][2] as Adapter
    expect(() => options.cookies.setAll?.([{ name: 'refreshed', value: 'synthetic', options: {} as CookieOptions }], headers)).not.toThrow()
  })
  it('does not hide unexpected cookie storage failures', async () => {
    mocks.cookies.set.mockImplementation(() => { throw new Error('Synthetic storage unavailable') })
    await createAuthenticatedClient()
    const options = mocks.server.mock.calls[0][2] as Adapter
    expect(() => options.cookies.setAll?.([{ name: 'refreshed', value: 'synthetic', options: {} }], headers)).toThrow('Synthetic storage unavailable')
  })
  it('PKCE callback preserves session cookies, verifier deletion and cache headers on its redirect', async () => {
    const response = await GET(new Request('http://127.0.0.1:3000/auth/callback?code=synthetic-code'))
    expect(mocks.exchange).toHaveBeenCalledWith('synthetic-code')
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3000/app')
    expect(response.cookies.get('session')?.value).toBe('synthetic')
    expect(response.cookies.get('verifier')?.maxAge).toBe(0)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })
  it('forwards the SDK concurrent PKCE flow id to exchange the matching verifier slot', async () => {
    await GET(new Request('http://127.0.0.1:3000/auth/callback?code=synthetic-code&sb_flow_id=syntheticflow1'))
    expect(mocks.exchange).toHaveBeenCalledWith('synthetic-code', { flowId: 'syntheticflow1' })
  })
  it.each(['', '?code=expired'])('rejects missing or failed PKCE code (%s) without forwarding to app', async query => {
    mocks.exchange.mockResolvedValue({ error: { message: 'synthetic expired code' } })
    const response = await GET(new Request('http://127.0.0.1:3000/auth/callback' + query))
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3000/login?error=auth_callback')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
