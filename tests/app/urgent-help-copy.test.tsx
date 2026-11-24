import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/font/google', () => ({
  Instrument_Serif: () => ({ variable: 'font-landing-serif', className: 'font-landing-serif' }),
}))

import HomePage from '@/app/page'
import AuthLayout from '@/app/(auth)/layout'
import { CrisisBanner } from '@/components/chat/crisis-banner'
import TermsPage from '@/app/terminos/page'

/**
 * Regla de copy (24-11-2026): los avisos fijos de ayuda urgente hablan de
 * «necesitar ayuda inmediata», no de hacerse daño ni de quitarse la vida.
 * Las preguntas clínicas del chat siguen su propio protocolo y no se
 * cubren aquí.
 */
const FORBIDDEN = [/hacerte daño/i, /hacerse daño/i, /quitarte la vida/i, /suicid/i, /en crisis/i]

const pages = {
  landing: () => renderToStaticMarkup(HomePage()),
  'auth layout': () => renderToStaticMarkup(AuthLayout({ children: null })),
  'chat crisis banner': () => renderToStaticMarkup(CrisisBanner()),
  'términos': () => renderToStaticMarkup(TermsPage()),
}

describe('fixed urgent-help notices', () => {
  it.each(Object.entries(pages))('%s keeps 024 and 112 reachable', (_name, render) => {
    const html = render()
    expect(html).toContain('href="tel:024"')
    expect(html).toContain('href="tel:112"')
  })

  it.each(Object.entries(pages))('%s talks about immediate help, not self-harm', (_name, render) => {
    const text = render().replace(/<[^>]+>/g, ' ')
    for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern)
    expect(text).toMatch(/ayuda inmediata/i)
  })
})
