// @vitest-environment jsdom
import React from 'react'
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { OpenRiskSignals } from '@/components/clinician/open-risk-signals'
import type { OpenSessionRiskSignal } from '@/lib/server/clinician/open-risk'

afterEach(cleanup)
const signal: OpenSessionRiskSignal = { eventId: 'e1', userId: 'u1', sessionId: 's1', displayName: 'Synthetic One', riskType: 'suicidal_ideation', severity: 'critical', createdAt: '2026-11-23T10:00:00.000Z', lastActivityAt: '2026-11-23T10:05:00.000Z' }

it('renders nothing when there are no signals', () => {
  expect(render(<OpenRiskSignals signals={[]} />).container.innerHTML).toBe('')
})

it('lists each signal with a link to the patient, its severity and its type', () => {
  render(<OpenRiskSignals signals={[signal, { ...signal, eventId: 'e2', userId: 'u2', displayName: null, severity: 'high', riskType: 'self_harm' }]} />)
  expect(screen.getByRole('heading', { name: 'Señales de riesgo en sesiones sin cerrar' })).toBeTruthy()
  const links = screen.getAllByRole('link')
  expect(links.map(link => link.getAttribute('href'))).toEqual(['/app/clinica/paciente/u1', '/app/clinica/paciente/u2'])
  expect(links[0].textContent).toContain('Synthetic One'); expect(links[0].textContent).toContain('Crítica'); expect(links[0].textContent).toContain('Ideación suicida')
  expect(links[1].textContent).toContain('Paciente sin nombre'); expect(links[1].textContent).toContain('Alta'); expect(links[1].textContent).toContain('Autolesión')
})

it('the clinician inbox shows the signals and survives a failed read', () => {
  const page = readFileSync('app/app/page.tsx', 'utf8')
  expect(page).toContain('<OpenRiskSignals signals={openRiskSignals} />')
  expect(page).toMatch(/try \{ openRiskSignals = await getOpenSessionRiskSignals\(supabase\) \}\s*catch/)
  expect(page.indexOf('<OpenRiskSignals')).toBeLessThan(page.indexOf('<InboxList'))
})
