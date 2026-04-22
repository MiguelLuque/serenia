import { describe, it, expect } from 'vitest'
import { sortInboxRows, type InboxRow } from '@/lib/clinician/inbox'

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
