// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { expect, it, vi, afterEach } from 'vitest'
import { AssessmentEditor } from '@/components/clinician/assessment-editor'
import { AssessmentView } from '@/components/clinician/assessment-view'
import type { AssessmentSummary } from '@/lib/server/assessments/generator'
import type { SessionDetail } from '@/lib/server/clinician/session-detail'
const actions = vi.hoisted(() => ({ saveAssessmentAction: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@/app/app/clinica/sesion/[sessionId]/actions', () => ({ ...actions, markReviewedAction: vi.fn(), regenerateAssessmentAction: vi.fn(), rejectAssessmentAction: vi.fn() }))
afterEach(cleanup)
const summary: AssessmentSummary = { chief_complaint: 'Synthetic', presenting_issues: [], mood_affect: '', cognitive_patterns: [], risk_assessment: { suicidality: 'none', self_harm: 'none', heteroaggression: 'plan', substance_use_acute: 'confirmed', notes: '' }, questionnaires: [], areas_for_exploration: [], preliminary_impression: '', recommended_actions_for_clinician: [], patient_facing_summary: 'Summary', proposed_tasks: [] }
it('the clinician sees heteroaggression and acute substance risk', () => {
 const detail: SessionDetail = { session: { id: 's', userId: 'u', openedAt: '2026-01-01', closedAt: '2026-01-02', closureReason: 'user_request', conversationId: 'c' }, patient: { userId: 'u', displayName: 'Synthetic' }, assessment: { id: 'a', status: 'draft_ai', summary, generatedBy: 'ai', createdAt: '2026-01-02', clinicalNotes: null, rejectionReason: null }, messages: [], inheritedTasks: [], regenerationInProgress: false }
 render(<AssessmentView detail={detail} />)
 expect(screen.getByText('Plan de agresión')).toBeTruthy(); expect(screen.getByText('Consumo agudo confirmado')).toBeTruthy()
})
it('the clinician can edit both risk fields and save them with the whole assessment', async () => {
 render(<AssessmentEditor assessmentId="a" sessionId="s" userId="u" initial={summary} initialClinicalNotes={null} inheritedTasks={[]} onCancel={() => {}} onSaved={() => {}} />)
 fireEvent.change(screen.getByLabelText('Heteroagresión'), { target: { value: 'verbal' } })
 fireEvent.change(screen.getByLabelText('Consumo agudo de sustancias'), { target: { value: 'suspected' } })
 fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
 await waitFor(() => expect(actions.saveAssessmentAction.mock.calls[0]?.[0]?.summary.risk_assessment).toEqual({ suicidality: 'none', self_harm: 'none', heteroaggression: 'verbal', substance_use_acute: 'suspected', notes: '' }))
})
it.each(['reviewed_modified', 'reviewed_confirmed'] as const)('removes draft review actions after refresh to %s while retaining editing', status => {
 const detail: SessionDetail = { session: { id: 's', userId: 'u', openedAt: '2026-01-01', closedAt: '2026-01-02', closureReason: 'user_request', conversationId: 'c' }, patient: { userId: 'u', displayName: 'Synthetic' }, assessment: { id: 'a', status: 'draft_ai', summary, generatedBy: 'ai', createdAt: '2026-01-02', clinicalNotes: null, rejectionReason: null }, messages: [], inheritedTasks: [], regenerationInProgress: false }
 const view = render(<AssessmentView detail={detail} />)
 expect(screen.getByRole('button', { name: 'Marcar como revisado sin cambios' })).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: 'Rechazar informe' }))
 expect(screen.getByLabelText('Motivo del rechazo')).toBeTruthy()
 view.rerender(<AssessmentView detail={{ ...detail, assessment: { ...detail.assessment!, id: 'reviewed-a', status } }} />)
 expect(screen.queryByRole('button', { name: 'Marcar como revisado sin cambios' })).toBeNull()
 expect(screen.queryByRole('button', { name: 'Rechazar informe' })).toBeNull()
 expect(screen.queryByLabelText('Motivo del rechazo')).toBeNull()
 expect((screen.getByRole('button', { name: 'Editar informe' }) as HTMLButtonElement).disabled).toBe(false)
})
