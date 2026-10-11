import { expect, it } from 'vitest'
import fixture from '../fixtures/risk-parity.json'
import { derivePatientRiskState } from '@/lib/server/risk-rules'
it.each(fixture.vectors)('$name: shared literal SQL/TypeScript parity vector', vector => {
 expect(derivePatientRiskState({ lastValidatedAssessment: vector.reviewedAt ? { reviewedAt: vector.reviewedAt, suicidality: vector.suicidality as 'none'|'passive'|'active'|'acute' } : null, openRiskEvents: vector.events, previousSession: vector.previous, now: new Date(fixture.now) })).toBe(vector.expected)
})

import schemas from '../fixtures/assessment-risk-parity.json'
import { AssessmentSchema } from '@/lib/server/assessments/generator'
it.each(schemas)('$name: full assessment SQL/TypeScript load parity', item => { expect(AssessmentSchema.safeParse(item.summary).success).toBe(item.expected) })
