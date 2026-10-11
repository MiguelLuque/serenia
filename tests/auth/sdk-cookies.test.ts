import { afterEach, expect, it, vi } from 'vitest'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-10-10T00:00:00Z' }
const token = () => [ { alg: 'HS256', typ: 'JWT' }, { sub: user.id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated' } ].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.') + '.' + Buffer.from('synthetic').toString('base64url')
afterEach(() => vi.unstubAllGlobals())
it('installed SSR SDK emits refresh cookies/cache headers and signout deletes auth/verifier chunks', async () => {
  const requests: string[] = []
  let flowId: string | null = null
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); requests.push(url)
    if (url.includes('/logout')) return new Response(null, { status: 204 })
    if (url.includes('/otp')) { flowId = new URL(JSON.parse(String(init?.body)).email_redirect_to ?? new URL(url).searchParams.get('redirect_to')!).searchParams.get('sb_flow_id'); return Response.json({}) }
    if (url.includes('/user')) return Response.json(user)
    if (url.includes('/token')) return Response.json({ access_token: token(), refresh_token: 'synthetic-refreshed', expires_in: 3600, token_type: 'bearer', user })
    throw new Error('Unexpected synthetic auth URL: ' + url)
  })
  const response = NextResponse.next()
  const store = new Map<string, string>()
  const client = createServerClient('http://127.0.0.1:54321', 'synthetic-publishable', {
    auth: { experimental: { appendPkceFlowIdToRedirects: true } },
    cookies: {
      getAll: () => Array.from(store, ([name, value]) => ({ name, value })),
      setAll: (cookies, headers) => {
        for (const { name, value, options } of cookies) { store.set(name, value); response.cookies.set(name, value, options) }
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
      },
    },
  })
  expect((await client.auth.setSession({ access_token: token(), refresh_token: 'synthetic-old' })).error).toBeNull()
  expect((await client.auth.refreshSession()).error).toBeNull()
  expect(requests.some(url => url.includes('grant_type=refresh_token'))).toBe(true)
  expect(response.cookies.getAll().some(cookie => cookie.name.includes('auth-token') && cookie.value.length > 0)).toBe(true)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect((await client.auth.signInWithOtp({ email: user.email, options: { emailRedirectTo: 'http://127.0.0.1:3000/auth/callback' } })).error).toBeNull()
  expect(response.cookies.getAll().some(cookie => cookie.name.includes('code-verifier') && cookie.value.length > 0)).toBe(true)
  expect((await client.auth.exchangeCodeForSession('synthetic-code', flowId ? { flowId } : undefined)).error).toBeNull()
  expect(requests.some(url => url.includes('grant_type=pkce'))).toBe(true)
  expect(response.cookies.getAll().filter(cookie => cookie.name.includes('code-verifier')), 'deleted PKCE slots; flowId=' + flowId).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.stringContaining('-flow-' + flowId + '-code-verifier'), value: '', maxAge: 0 })]))
  expect((await client.auth.signOut()).error).toBeNull()
  expect(response.cookies.getAll().filter(cookie => cookie.name.includes('auth-token')).every(cookie => cookie.value === '' && cookie.maxAge === 0)).toBe(true)
})
