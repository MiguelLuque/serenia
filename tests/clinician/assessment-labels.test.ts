import { describe, expect, it } from 'vitest'
import { assessmentStatusLabel } from '@/lib/shared/clinician/assessment-labels'

describe('assessmentStatusLabel', () => {
  it('shows pending review as a neutral badge', () => {
    expect(assessmentStatusLabel('pending_clinician_review')).toEqual({ label: 'Sin revisar', variant: 'outline' })
    expect(assessmentStatusLabel('draft_ai')).toEqual({ label: 'Sin revisar', variant: 'outline' })
  })

  it('keeps manual regeneration in red because it needs action', () => {
    expect(assessmentStatusLabel('requires_manual_review').variant).toBe('destructive')
  })
})
