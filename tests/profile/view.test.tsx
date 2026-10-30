// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ProfileMemory, ProfileMemoryPage } from '@/lib/shared/profile/schema'
const mocks = vi.hoisted(() => ({ setEnabled: vi.fn(), review: vi.fn(), refresh: vi.fn() }))
vi.mock('@/app/app/perfil/actions', () => ({ setProfileEnabledAction: mocks.setEnabled, reviewProfileObservationAction: mocks.review }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }), usePathname: () => '/app/perfil' }))
import { ProfileMemoryView } from '@/components/profile/profile-memory'
import { AppSidebar } from '@/components/app/app-sidebar'
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'
const oldId = '10000000-0000-4000-8000-000000000001'
const newId = '10000000-0000-4000-8000-000000000002'
const old = { id: oldId, category: 'concern', quote: 'Antes dormía mal.', time_scope: 'historical', status: 'confirmed', supersedes_id: null, source_message_id: oldId, session_id: oldId, source_created_at: '2026-10-27T12:00:00+00:00', updated_at: '2026-10-27T12:01:00.123456+00:00', disputed: true } satisfies ProfileMemory['observations'][number]
const correction = { ...old, id: newId, quote: 'Ahora duermo bien.', status: 'pending', supersedes_id: oldId, disputed: false } satisfies ProfileMemory['observations'][number]
const empty: ProfileMemoryPage = { enabled: false, pending_jobs: 0, failed_jobs: 0, observations: [], next_cursor: null }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.setEnabled.mockResolvedValue({ ok: true })
  mocks.review.mockResolvedValue({ ok: true })
  document.addEventListener('click', preventDocumentNavigation, { once: false })
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
function preventDocumentNavigation(event: MouseEvent) { if ((event.target as Element).closest('a')) event.preventDefault() }
afterEach(() => { cleanup(); document.removeEventListener('click', preventDocumentNavigation) })
it('explains explicit activation, future sources, correction, clinical limits and disabling', () => {
  render(<ProfileMemoryView memory={empty} />)
  expect(screen.getByRole('heading', { name: 'Lo que recuerda Serenia' })).toBeTruthy()
  expect(screen.getByText(/todavía no hay citas/i)).toBeTruthy()
  expect(screen.getByText(/no es una validación clínica/i)).toBeTruthy()
  expect(screen.getByText(/no recupera automáticamente conversaciones anteriores/i)).toBeTruthy()
  expect(screen.getByText(/para corregir.*conversación/i)).toBeTruthy()
  expect(screen.getByText(/no borra.*conversaciones/i)).toBeTruthy()
  expect(screen.getByText(/petición.*ya.*comenzado/i)).toBeTruthy()
})
it('activates explicitly and never changes consent optimistically', async () => {
  let finish!: (result: unknown) => void
  mocks.setEnabled.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<ProfileMemoryView memory={empty} />)
  fireEvent.click(screen.getByRole('button', { name: 'Activar memoria' }))
  await waitFor(() => expect(mocks.setEnabled).toHaveBeenCalledWith(true))
  expect((screen.getByRole('button', { name: /guardando/i }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('Cambio guardado.')).toBeNull()
  finish({ ok: false, error: 'No se pudo guardar el cambio.' })
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo guardar')
  expect(screen.getByRole('button', { name: 'Activar memoria' })).toBeTruthy()
})
it('disables through a saved action while retaining visible review controls', async () => {
  render(<ProfileMemoryView memory={{ ...empty, enabled: true, observations: [correction] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Desactivar memoria' }))
  await waitFor(() => expect(mocks.setEnabled).toHaveBeenCalledWith(false))
  expect(await screen.findByRole('status')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Confirmar' })).toBeTruthy()
})
it('shows literal quotes, source dates, user-only status and disputed correction target', () => {
  render(<ProfileMemoryView memory={{ ...empty, observations: [correction, old] }} />)
  const correctionCard = screen.getByText('Ahora duermo bien.').closest('article')!
  expect(within(correctionCard).getByText('Extraído · pendiente de tu revisión')).toBeTruthy()
  expect(within(correctionCard).getByText('Antes dormía mal.')).toBeTruthy()
  expect(within(correctionCard).getByText(/sustituiría esta cita anterior/i)).toBeTruthy()
  expect(correctionCard.textContent).toContain('27/10/2026')
  expect(correctionCard.textContent).toContain('Preocupación')
  expect(screen.getByText('Confirmado por ti')).toBeTruthy()
  expect(screen.getByText(/en disputa.*corrección pendiente/i)).toBeTruthy()
  expect(screen.getAllByRole('button', { name: 'Confirmar' })).toHaveLength(1)
})
it.each(['Confirmar', 'Descartar'])('submits %s with exact server version while disabled', async label => {
  render(<ProfileMemoryView memory={{ ...empty, observations: [correction] }} />)
  fireEvent.click(screen.getByRole('button', { name: label }))
  await waitFor(() => expect(mocks.review).toHaveBeenCalledWith({ observationId: newId, action: label === 'Confirmar' ? 'confirm' : 'reject', expectedUpdatedAt: '2026-10-27T12:01:00.123456+00:00' }))
})
it('shows bounded supplemental source and its absence without inventing a prior quote', () => {
  const { rerender } = render(<ProfileMemoryView memory={{ ...empty, observations: [correction] }} replacementSources={{ [oldId]: { quote: 'Cita anterior recuperada.', source_created_at: '2026-10-26T12:00:00+00:00' } }} />)
  expect(screen.getByText('Cita anterior recuperada.')).toBeTruthy()
  rerender(<ProfileMemoryView memory={{ ...empty, observations: [correction] }} />)
  expect(screen.queryByText('Cita anterior recuperada.')).toBeNull()
  expect(screen.getByText(/no se pudo mostrar la cita anterior.*antes de confirmar/i)).toBeTruthy()
})
it('offers reload after stale version instead of a success message', async () => {
  mocks.review.mockResolvedValue({ ok: false, conflict: true, error: 'El dato cambió. Recarga el perfil.' })
  render(<ProfileMemoryView memory={{ ...empty, observations: [correction] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Recarga')
  expect(screen.queryByText('Cambio guardado.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Recargar perfil' }))
  expect(mocks.refresh).toHaveBeenCalled()
})
it('consumes the conflict prompt on reload and keeps fresh server data without reporting success', async () => {
  mocks.review.mockResolvedValue({ ok: false, conflict: true, error: 'El dato cambió. Recarga el perfil.' })
  const { rerender } = render(<ProfileMemoryView memory={{ ...empty, observations: [correction] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Recarga')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Recargar perfil' }))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Recargar perfil' })).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
  rerender(<ProfileMemoryView memory={{ ...empty, observations: [{ ...correction, status: 'confirmed', updated_at: '2026-10-29T20:00:00.654321+00:00' }] }} />)
  expect(screen.getByText('Confirmado por ti')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Recargar perfil' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
})
it('contains transport exceptions and provides retry without private data', async () => {
  mocks.review.mockRejectedValue(new Error('PRIVATE TOKEN'))
  render(<ProfileMemoryView memory={{ ...empty, observations: [correction] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/no se pudo guardar/i)
  expect(document.body.textContent).not.toContain('PRIVATE')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Descartar' }) as HTMLButtonElement).disabled).toBe(false))
})
it('explains background pending and exhausted work without time guarantees', () => {
  render(<ProfileMemoryView memory={{ ...empty, pending_jobs: 2, failed_jobs: 1 }} />)
  expect(screen.getByText(/hay mensajes pendientes de procesar/i)).toBeTruthy()
  expect(screen.getByText(/algunos mensajes no pudieron incorporarse/i)).toBeTruthy()
})
it('has no action controls when memory read is unavailable', () => {
  render(<ProfileMemoryView memory={null} />)
  expect(screen.getByRole('alert').textContent).toMatch(/no se pudo cargar/i)
  expect(screen.queryByRole('button', { name: 'Activar memoria' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Volver a la conversación' }).getAttribute('href')).toBe('/app')
})
it('keeps rejected and superseded history readable without review controls', () => {
  render(<ProfileMemoryView memory={{ ...empty, observations: [{ ...old, disputed: false, status: 'rejected' }, { ...correction, status: 'superseded' }] }} />)
  expect(screen.getByText('Descartado por ti')).toBeTruthy()
  expect(screen.getByText('Sustituido')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull()
})
it.each([['patient', false, false], ['patient', true, true], ['clinician', true, false]] as const)('patient-only navigation %s flag %s', (role, enabled, visible) => {
  render(<SidebarProvider><AppSidebar displayName="Caso ficticio" role={role} profileMemoryEnabled={enabled} /></SidebarProvider>)
  expect(screen.queryByRole('link', { name: 'Lo que recuerda Serenia' }) !== null).toBe(visible)
})

it('links to a bounded older page with precise timestamp and returns to recent', () => {
  const cursor = { source_created_at: '2026-10-27T12:00:00.123456+00:00', id: oldId }
  render(<ProfileMemoryView memory={{ ...empty, next_cursor: cursor }} isOlderPage />)
  const url = new URL(screen.getByRole('link', { name: 'Ver citas anteriores' }).getAttribute('href')!, 'http://localhost')
  expect(url.searchParams.get('before_created_at')).toBe(cursor.source_created_at)
  expect(url.searchParams.get('before_id')).toBe(oldId)
  expect(screen.getByRole('link', { name: 'Volver a citas recientes' }).getAttribute('href')).toBe('/app/perfil')
})
it('has no older link at the end and still provides recent recovery for an empty older page', () => {
  render(<ProfileMemoryView memory={{ ...empty, next_cursor: null }} isOlderPage />)
  expect(screen.queryByRole('link', { name: 'Ver citas anteriores' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Volver a citas recientes' })).toBeTruthy()
})

function SidebarProbe() {
  const { open, openMobile, toggleSidebar } = useSidebar()
  return <><button onClick={toggleSidebar}>Toggle test sidebar</button><output data-testid="sidebar-state">{String(open)}:{String(openMobile)}</output></>
}
it.each([
  ['patient', 'Inicio'], ['patient', 'Sesiones'], ['patient', 'Lo que recuerda Serenia'],
  ['clinician', 'Bandeja'], ['clinician', 'Pacientes'],
] as const)('closes mobile %s navigation %s and preserves desktop state', async (role, label) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  render(<SidebarProvider defaultOpen={false}><AppSidebar displayName="Synthetic" role={role} profileMemoryEnabled /><SidebarProbe /></SidebarProvider>)
  fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
  expect(screen.getByTestId('sidebar-state').textContent).toBe('false:true')
  const link = await screen.findByRole('link', { name: label })
  expect(link.getAttribute('href')).toMatch(/^\/app/)
  fireEvent.click(link)
  await waitFor(() => expect(screen.getByTestId('sidebar-state').textContent).toBe('false:false'))
})
it('preserves desktop keyboard toggle and open state when selecting a shared link', () => {
  render(<SidebarProvider defaultOpen={false}><AppSidebar displayName="Synthetic" role="patient" profileMemoryEnabled /><SidebarProbe /></SidebarProvider>)
  fireEvent.keyDown(window, { key: 'b', metaKey: true })
  expect(screen.getByTestId('sidebar-state').textContent).toBe('true:false')
  fireEvent.click(screen.getByRole('link', { name: 'Lo que recuerda Serenia' }))
  expect(screen.getByTestId('sidebar-state').textContent).toBe('true:false')
  fireEvent.keyDown(window, { key: 'b', metaKey: true })
  expect(screen.getByTestId('sidebar-state').textContent).toBe('false:false')
})

it('leaves an old page conflict behind and submits the exact version of a different page', async () => {
  mocks.review.mockResolvedValueOnce({ ok: false, conflict: true, error: 'Old page conflict' }).mockResolvedValueOnce({ ok: true })
  const { rerender } = render(<ProfileMemoryView key="recent" memory={{ ...empty, observations: [correction] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Old page conflict')
  const older = { ...old, disputed: false, status: 'pending' as const, updated_at: '2026-10-27T11:01:00.654321+00:00' }
  rerender(<ProfileMemoryView key="older-precise-cursor" memory={{ ...empty, observations: [older] }} isOlderPage />)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  await waitFor(() => expect(mocks.review).toHaveBeenLastCalledWith({ observationId: oldId, action: 'confirm', expectedUpdatedAt: older.updated_at }))
})

it('does not let a late action result from an unmounted page mask the destination', async () => {
  let finish!: (result: unknown) => void
  mocks.review.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { rerender } = render(<ProfileMemoryView key="recent" memory={{ ...empty, observations: [correction] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  await waitFor(() => expect(mocks.review).toHaveBeenCalledTimes(1))
  rerender(<ProfileMemoryView key="older" memory={{ ...empty, observations: [old] }} isOlderPage />)
  finish({ ok: false, conflict: true, error: 'Late old page conflict' })
  await waitFor(() => expect((screen.getByRole('button', { name: 'Descartar' }) as HTMLButtonElement).disabled).toBe(false))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText('Confirmado por ti')).toBeTruthy()
})
