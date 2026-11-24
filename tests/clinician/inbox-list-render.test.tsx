// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { InboxList } from '@/components/clinician/inbox-list'
import type { InboxRow } from '@/lib/server/clinician/inbox'

afterEach(cleanup)

const row: InboxRow = { sessionId: 's1', userId: 'u1', displayName: 'Paciente A', closedAt: new Date().toISOString(), closureReason: 'crisis_detected', assessmentStatus: 'pending_clinician_review', hasCrisis: true, topRisk: 'high', sessionNumber: 2, daysSincePrevious: 3, trendsByCode: {}, openTasksCount: 0, riskState: 'acute' }

it('keeps crisis and risk badges visible on each inbox row and links to the session', () => {
  render(<InboxList rows={[row, { ...row, sessionId: 's2', hasCrisis: false, riskState: 'none', displayName: null }]} />)
  expect(screen.getByText('CRISIS')).toBeTruthy()
  expect(screen.getByText('Riesgo agudo')).toBeTruthy()
  const links = screen.getAllByRole('link')
  expect(links.map(link => link.getAttribute('href'))).toEqual(['/app/clinica/sesion/s1', '/app/clinica/sesion/s2'])
  expect(links[1].textContent).toContain('Paciente sin nombre')
})

it('shows an empty state when there is nothing to review', () => {
  render(<InboxList rows={[]} />)
  expect(screen.getByText('No hay sesiones cerradas por revisar.')).toBeTruthy()
})
