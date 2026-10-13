import { describe, it, expect, vi } from 'vitest'
import { sortInboxRows, getClinicianInbox, type InboxRow } from '@/lib/server/clinician/inbox'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'

function makeRow(overrides: Partial<InboxRow>): InboxRow {
  return {
    sessionId: 's',
    userId: 'u',
    displayName: null,
    closedAt: null,
    closureReason: null,
    assessmentStatus: null,
    hasCrisis: false,
    topRisk: null,
    sessionNumber: 1,
    daysSincePrevious: null,
    trendsByCode: {},
    openTasksCount: 0,
    riskState: 'none',
    ...overrides,
  }
}

describe('sortInboxRows', () => {
  it('places unreviewed (draft_ai) rows before reviewed, and sorts by closed_at desc within each group', () => {
    const draftOld = makeRow({
      sessionId: 'draft-old',
      assessmentStatus: 'draft_ai',
      closedAt: '2026-04-10T10:00:00.000Z',
    })
    const reviewedNew = makeRow({
      sessionId: 'reviewed-new',
      assessmentStatus: 'reviewed_confirmed',
      closedAt: '2026-04-22T10:00:00.000Z',
    })
    const draftNew = makeRow({
      sessionId: 'draft-new',
      assessmentStatus: 'draft_ai',
      closedAt: '2026-04-21T10:00:00.000Z',
    })

    const sorted = sortInboxRows([reviewedNew, draftOld, draftNew])

    expect(sorted.map((r) => r.sessionId)).toEqual([
      'draft-new',
      'draft-old',
      'reviewed-new',
    ])
  })

  it('treats rows without an assessment (null) as unreviewed', () => {
    const noAssessment = makeRow({
      sessionId: 'none',
      assessmentStatus: null,
      closedAt: '2026-04-01T10:00:00.000Z',
    })
    const reviewed = makeRow({
      sessionId: 'reviewed',
      assessmentStatus: 'reviewed_confirmed',
      closedAt: '2026-04-22T10:00:00.000Z',
    })

    const sorted = sortInboxRows([reviewed, noAssessment])

    expect(sorted.map((r) => r.sessionId)).toEqual(['none', 'reviewed'])
  })
})

describe('inbox operational priority', () => {
 it('urgent risk precedes routine reviews and manual failures remain pending', () => {
  const rows = [makeRow({ sessionId: 'routine', assessmentStatus: 'draft_ai', closedAt: '2026-10-11' }), makeRow({ sessionId: 'acute', assessmentStatus: 'reviewed_confirmed', riskState: 'acute', closedAt: '2026-01-01' }), makeRow({ sessionId: 'manual', assessmentStatus: 'requires_manual_review', closedAt: '2026-02-01' }), makeRow({ sessionId: 'reviewed', assessmentStatus: 'reviewed_confirmed', closedAt: '2026-10-10' })]
  expect(sortInboxRows(rows).map(row => row.sessionId)).toEqual(['acute','routine','manual','reviewed'])
 })
})


describe('bounded inbox RPC boundary', () => {
 it.each(['draft_ai','pending_clinician_review','reviewed_confirmed','reviewed_modified','rejected','superseded','requires_manual_review'] as const)('accepts valid database status %s through the actual page reader',async assessmentStatus=>{
  const row=makeRow({assessmentStatus})
  const rpc=vi.fn().mockResolvedValue({data:{rows:[row],hasMore:false},error:null})
  expect(await getClinicianInbox({rpc} as unknown as SupabaseClient<Database>,{pendingOnly:false})).toEqual([row])
 })
 it('prioritizes an older pending clinician review above a newer reviewed row at the same risk',()=>{
  const pending=makeRow({sessionId:'pending',assessmentStatus:'pending_clinician_review',closedAt:'2026-01-01'})
  const reviewed=makeRow({sessionId:'reviewed',assessmentStatus:'reviewed_confirmed',closedAt:'2026-10-13'})
  expect(sortInboxRows([reviewed,pending]).map(row=>row.sessionId)).toEqual(['pending','reviewed'])
 })
 it('requests a filtered page before any rows reach the UI', async () => {
  const rpc=vi.fn().mockResolvedValue({ data: { rows: [], hasMore: false }, error: null })
  expect(await getClinicianInbox({ rpc } as unknown as SupabaseClient<Database>, { page: 3, pendingOnly: true })).toEqual([])
  expect(rpc).toHaveBeenCalledWith('get_clinician_inbox_page', { p_offset: 200, p_limit: 100, p_pending_only: true })
 })
 it('propagates DB errors instead of rendering an empty successful inbox', async () => {
  const rpc=vi.fn().mockResolvedValue({ data: null, error: Error('read failed') })
  await expect(getClinicianInbox({ rpc } as unknown as SupabaseClient<Database>)).rejects.toThrow('read failed')
 })
 it('rejects a malformed clinical risk snapshot at the UI boundary', async () => {
  const rpc=vi.fn().mockResolvedValue({ data: { rows: [makeRow({ riskState: 'invented' as InboxRow['riskState'] })], hasMore: false }, error: null })
  await expect(getClinicianInbox({ rpc } as unknown as SupabaseClient<Database>)).rejects.toThrow()
 })
})
