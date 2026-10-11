// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ status: 'rejected', rpcError: false, role: 'patient', hasMore: true }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'patient' } }, error: null }) },
  rpc: async (name: string) => name === 'get_clinician_inbox_page' ? ({ data: { rows: [], hasMore: state.hasMore }, error: state.rpcError ? Error('offline') : null }) : ({ data: [{ sessionId: 'closed', state: state.status === 'reviewed_modified' ? 'available' : state.status === 'rejected' ? 'rejected' : 'unavailable', summary: state.status === 'reviewed_modified' ? 'Authorized summary' : null }], error: state.rpcError ? Error('offline') : null }),
  from: (table: string) => {
    let open = false
    const chain = { select: () => chain, eq: (key: string, value: string) => { if (key === 'status' && value === 'open') open = true; return chain }, in: () => chain, order: () => chain, limit: () => chain, single: () => chain, maybeSingle: () => chain,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === 'user_profiles' ? { role: state.role, display_name: null, informal_name: 'Luna' } : table === 'clinical_sessions' ? open ? null : [{ id: 'closed', opened_at: '2026-01-01', closed_at: '2026-01-01', closure_reason: null }] : table === 'assessments' ? [{ session_id: 'closed', status: state.status, summary_json: { patient_facing_summary: 'Private old report' } }] : [], error: null }).then(resolve) }
    chain.maybeSingle = () => ({ ...chain, then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === 'clinical_sessions' ? open ? null : { id: 'closed', closure_reason: null } : table === 'assessments' ? { summary_json: { patient_facing_summary: 'Private old report' } } : { role: state.role, display_name: null, informal_name: 'Luna' }, error: null }).then(resolve) })
    return chain
  },
}) }))
vi.mock('@/app/app/actions', () => ({ startSessionAction: async () => {} }))
import AppHome from '@/app/app/page'
import SesionesPage from '@/app/app/sesiones/page'
afterEach(cleanup)
beforeEach(() => { state.status = 'rejected'; state.rpcError = false; state.role = 'patient' })
it('home uses informal name and hides a rejected report', async () => {
  render(await AppHome())
  expect(screen.getByText('Hola, Luna.')).toBeTruthy()
  expect(screen.queryByText('Private old report')).toBeNull()
})
it.each(['rejected', 'superseded'])('history hides %s report', async status => {
  state.status = status; render(await SesionesPage())
  expect(screen.queryByText('Private old report')).toBeNull()
})
it('reload/history exposes the current authorized summary', async () => {
  state.status = 'reviewed_modified'; render(await SesionesPage())
  expect(screen.getByText('Authorized summary')).toBeTruthy()
})
it('report read failure is propagated to the route error boundary', async () => {
  state.rpcError = true; await expect(SesionesPage()).rejects.toThrow('offline')
})

it('clinician reload/navigation exposes real pending/all filters and previous/next pages', async () => {
 state.role='clinician'; render(await AppHome({ searchParams: Promise.resolve({ page:'2',view:'all' }) }))
 expect(screen.getByRole('link',{name:'Pendientes'}).getAttribute('href')).toBe('/app')
 expect(screen.getByRole('link',{name:'Página anterior'}).getAttribute('href')).toBe('/app?page=1&view=all')
 expect(screen.getByRole('link',{name:'Página siguiente'}).getAttribute('href')).toBe('/app?page=3&view=all')
})
it('clinician DB failures reach the error boundary', async () => {
 state.role='clinician';state.rpcError=true; await expect(AppHome()).rejects.toThrow('offline')
})
