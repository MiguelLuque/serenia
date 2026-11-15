import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { createAuthenticatedClient } = vi.hoisted(() => ({
  createAuthenticatedClient: vi.fn(),
}))

vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient }))

import { registerAction } from '@/app/(auth)/actions'
import HomePage from '@/app/page'
import LoginPage from '@/app/(auth)/login/page'
import RegistrationPage from '@/app/(auth)/registro/page'

describe('self-registration in the internal Production pilot', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('FEATURE_PUBLIC_REGISTRATION', 'off')
    createAuthenticatedClient.mockReset()
    createAuthenticatedClient.mockResolvedValue({
      auth: { signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: 'unexpected signup' } }) },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects direct sign-up before contacting Supabase when Production registration is closed', async () => {
    const formData = new FormData()
    formData.set('email', 'fictional@example.test')
    formData.set('password', 'Fictional-Password-1')
    formData.set('consent', 'on')

    const result = await registerAction(undefined, formData)

    expect(result?.error).toMatch(/registro.*cerrado/i)
    expect(createAuthenticatedClient).not.toHaveBeenCalled()
  })

  it('renders an explanatory closed-registration page without an account creation form', () => {
    const html = renderToStaticMarkup(RegistrationPage())

    expect(html).toMatch(/registro.*cerrado/i)
    expect(html).toContain('href="/login"')
    expect(html).not.toContain('<form')
  })

  it('does not advertise sign-up from the public home page', () => {
    const html = renderToStaticMarkup(HomePage())

    expect(html).not.toContain('href="/registro"')
    expect(html).toContain('href="/login"')
  })

  it('does not advertise sign-up from the login page', () => {
    const html = renderToStaticMarkup(LoginPage())

    expect(html).not.toContain('href="/registro"')
    expect(html).toContain('<form')
    expect(html).toContain('name="email"')
  })

  it('defaults Production registration to closed when the feature flag is unset', async () => {
    vi.stubEnv('FEATURE_PUBLIC_REGISTRATION', '')
    const formData = new FormData()
    formData.set('email', 'fictional@example.test')
    formData.set('password', 'Fictional-Password-1')
    formData.set('consent', 'on')

    const result = await registerAction(undefined, formData)

    expect(result?.error).toMatch(/registro.*cerrado/i)
    expect(createAuthenticatedClient).not.toHaveBeenCalled()
  })

  it('defaults Preview registration to closed when the feature flag is unset', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('FEATURE_PUBLIC_REGISTRATION', '')

    const html = renderToStaticMarkup(RegistrationPage())

    expect(html).toMatch(/registro.*cerrado/i)
    expect(html).toContain('href="/login"')
    expect(html).not.toContain('<form')
  })

  it('keeps local development registration available by default', () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('FEATURE_PUBLIC_REGISTRATION', '')

    const html = renderToStaticMarkup(RegistrationPage())

    expect(html).toContain('<form')
    expect(html).toContain('name="email"')
  })

  it('allows Production registration only when explicitly enabled', () => {
    vi.stubEnv('FEATURE_PUBLIC_REGISTRATION', 'on')

    const html = renderToStaticMarkup(RegistrationPage())

    expect(html).toContain('<form')
    expect(html).toContain('name="email"')
  })
})
