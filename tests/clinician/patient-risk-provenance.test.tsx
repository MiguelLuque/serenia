// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { createClient } from '@supabase/supabase-js'
import { afterEach, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/shared/supabase/types'

const state = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => state.client }))
import Page from '@/app/app/clinica/paciente/[userId]/page'

afterEach(cleanup)

it('preserves each risk event while distinguishing an automatic lexical observation', async () => {
  const events = [
    { id: 'lexical', risk_type: 'suicidal_ideation', severity: 'high', source_type: 'conversation', signal: 'textual_crisis', session_id: 'session-1', created_at: '2026-11-03T12:00:00Z' },
    { id: 'questionnaire', risk_type: 'self_harm', severity: 'critical', source_type: 'questionnaire', signal: 'textual_crisis', session_id: 'session-2', created_at: '2026-11-02T12:00:00Z' },
    { id: 'manual', risk_type: 'severe_distress', severity: 'high', source_type: 'manual_review', signal: null, session_id: 'session-3', created_at: '2026-11-01T12:00:00Z' },
    { id: 'unknown', risk_type: 'suicidal_ideation', severity: 'moderate', source_type: 'legacy', signal: null, session_id: null, created_at: '2026-10-31T12:00:00Z' },
  ]
  const requests: URL[] = []
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    requests.push(url)
    const table = url.pathname.split('/').at(-1)
    let data: unknown = []
    if (table === 'user_profiles') data = { user_id: 'patient-1', display_name: 'Ficticio', informal_name: null, birth_date: null }
    if (table === 'risk_events') {
      const fields = new Set((url.searchParams.get('select') ?? '').split(','))
      data = events.map(event => Object.fromEntries(Object.entries(event).filter(([key]) => fields.has(key) || (key === 'signal' && fields.has('signal:payload_json->>signal')))))
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  state.client = createClient<Database>('https://synthetic.invalid', 'synthetic-key', { global: { fetch: fetcher } })

  render(await Page({ params: Promise.resolve({ userId: 'patient-1' }) }))
  expect(screen.getByText(/Los tipos y niveles registrados requieren valoración clínica/i)).toBeTruthy()
  const lexical = screen.getByText(/Señal automática de seguridad/i).closest('li')!
  expect(within(lexical).getByText(/por sí sola no confirma el riesgo/i)).toBeTruthy()
  expect(within(lexical).getByText(/el nivel registrado requiere valoración/i)).toBeTruthy()
  expect(within(lexical).queryByText(/gravedad fue asignada automáticamente/i)).toBeNull()
  expect(within(lexical).queryByText('Ideación suicida')).toBeNull()
  expect(within(lexical).getByText(/Alta/)).toBeTruthy()
  expect(within(lexical).getByRole('link').getAttribute('href')).toBe('/app/clinica/sesion/session-1')
  const questionnaire = screen.getByText('Autolesión').closest('li')!
  expect(within(questionnaire).getByText(/Fuente registrada: cuestionario/i)).toBeTruthy()
  expect(within(questionnaire).getByText(/requiere contextualización clínica/i)).toBeTruthy()
  expect(screen.getByText('Crítica')).toBeTruthy()
  const manual = screen.getByText('Malestar severo').closest('li')!
  expect(within(manual).getByText(/Fuente indicada: revisión manual/i)).toBeTruthy()
  expect(within(manual).getByText(/no acredita validación clínica/i)).toBeTruthy()
  expect(screen.getByText(/Origen desconocido/i)).toBeTruthy()
  expect(screen.getByText('Tipo registrado: Ideación suicida')).toBeTruthy()
  const rows = lexical.parentElement!.querySelectorAll('li')
  expect(rows).toHaveLength(4)
  expect(rows[1]!.textContent).toContain('Autolesión')
  expect(rows[2]!.textContent).toContain('Malestar severo')
  const select = requests.find(url => url.pathname.endsWith('/risk_events'))!.searchParams.get('select')!
  expect(select).toContain('source_type')
  expect(select).toContain('signal:payload_json->>signal')
  expect(select.split(',')).not.toContain('payload_json')
})
