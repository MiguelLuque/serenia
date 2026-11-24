import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('next/font/google', () => ({
  Instrument_Serif: () => ({ variable: 'font-landing-serif', className: 'font-landing-serif' }),
}))

import HomePage from '@/app/page'

describe('public landing page', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('always shows the urgent-help notice with Línea 024 and 112', () => {
    const html = renderToStaticMarkup(HomePage())

    expect(html).toContain('no es un servicio de urgencias')
    expect(html).toContain('href="tel:024"')
    expect(html).toContain('href="tel:112"')
    expect(html).toContain('Línea 024')
  })

  it('links to login, privacy and terms', () => {
    const html = renderToStaticMarkup(HomePage())

    expect(html).toContain('href="/login"')
    expect(html).toContain('href="/privacidad"')
    expect(html).toContain('href="/terminos"')
  })

  it('offers sign-up only when public registration is enabled', () => {
    vi.stubEnv('FEATURE_PUBLIC_REGISTRATION', 'on')
    expect(renderToStaticMarkup(HomePage())).toContain('href="/registro"')

    vi.stubEnv('FEATURE_PUBLIC_REGISTRATION', 'off')
    const closed = renderToStaticMarkup(HomePage())
    expect(closed).not.toContain('href="/registro"')
    expect(closed).toContain('solo por invitación')
  })

  it('does not promise a review deadline for the patient summary', () => {
    const text = renderToStaticMarkup(HomePage()).replace(/<[^>]+>/g, ' ')

    expect(text).toContain('no hay un plazo de revisión garantizado')
    expect(text).toContain('cuando el profesional lo ha revisado y autorizado')
  })

  it('does not make diagnostic or curative claims', () => {
    const text = renderToStaticMarkup(HomePage()).replace(/<[^>]+>/g, ' ').toLowerCase()

    for (const claim of ['cura ', 'curar', 'garantizamos', 'sustituye a tu psicólogo', 'diagnóstico preciso', '100%']) {
      expect(text).not.toContain(claim)
    }
    // «garantiza» como palabra suelta; «sin plazo garantizado» sí está permitido.
    expect(text).not.toMatch(/\bgarantiza\b/)
  })
})
