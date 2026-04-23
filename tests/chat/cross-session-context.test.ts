import { describe, it, expect } from 'vitest'
import { assemblePlan6ContextPieces } from '@/lib/chat/assemble-plan6-prompt'
import type { PatientContext } from '@/lib/patient-context/builder'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-04-22T12:00:00Z')

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

const baseRisk = { suicidality: 'none' as const, self_harm: 'none' as const, notes: '' }

function makeNoneCtx(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    tier: 'none',
    isFirstSession: true,
    patient: { displayName: null, age: null },
    validated: null,
    tierBDraft: null,
    recentQuestionnaires: [],
    openRiskEvents: [],
    previousSession: null,
    pendingTasks: [],
    sessionNumber: 1,
    riskState: 'none',
    ...overrides,
  }
}

function makeTierACtx(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    tier: 'tierA',
    isFirstSession: false,
    patient: { displayName: 'Ana López', age: 30 },
    validated: {
      id: 'assessment-tierA',
      reviewedAt: daysAgo(10),
      summary: {
        chief_complaint: 'Ansiedad persistente.',
        presenting_issues: ['insomnio'],
        areas_for_exploration: ['dinámica familiar'],
        risk_assessment: baseRisk,
        questionnaires: [],
      },
      ageInDays: 10,
    },
    tierBDraft: null,
    recentQuestionnaires: [],
    openRiskEvents: [],
    previousSession: { closedAt: daysAgo(7), closureReason: null, daysAgo: 7 },
    pendingTasks: [
      { id: 't1', descripcion: 'Respiración', estado: 'pendiente', acordadaEn: daysAgo(7) },
      { id: 't2', descripcion: 'Diario', estado: 'parcial', acordadaEn: daysAgo(5) },
    ],
    sessionNumber: 3,
    riskState: 'none',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('assemblePlan6ContextPieces — tier=none (first session)', () => {
  it('produces a first-session block, empty risk notice, and tier=none telemetry', () => {
    const ctx = makeNoneCtx()
    const { patientContextBlock, riskOpeningNotice, telemetry } = assemblePlan6ContextPieces(ctx, NOW)

    expect(patientContextBlock).toContain('[CONTEXTO DEL PACIENTE — primera sesión]')
    expect(patientContextBlock).toContain('postura de intake habitual')
    expect(riskOpeningNotice).toBe('')

    expect(telemetry).toEqual({
      tier: 'none',
      riskState: 'none',
      blockCharCount: patientContextBlock.length,
      pendingTasksCount: 0,
      riskTriggered: false,
      lastValidatedAssessmentId: null,
      truncatedSections: [],
    })
  })
})

describe('assemblePlan6ContextPieces — tier=tierA with riskState=watch', () => {
  it('includes a full context block and the watch continuity notice; telemetry is populated', () => {
    const ctx = makeTierACtx({ riskState: 'watch' })
    const { patientContextBlock, riskOpeningNotice, telemetry } = assemblePlan6ContextPieces(ctx, NOW)

    // Context block includes patient name, session number, and tier-A header.
    expect(patientContextBlock).toContain('Ana López')
    expect(patientContextBlock).toContain('Sesión nº 3')
    expect(patientContextBlock).toContain('última revisión clínica de hace 10 días')

    // Risk notice is the exact "watch" string.
    expect(riskOpeningNotice).toContain('[AVISO DE CONTINUIDAD — VIGILANCIA]')
    expect(riskOpeningNotice.length).toBeGreaterThan(0)

    expect(telemetry.tier).toBe('tierA')
    expect(telemetry.riskState).toBe('watch')
    expect(telemetry.riskTriggered).toBe(true)
    expect(telemetry.pendingTasksCount).toBe(2)
    expect(telemetry.lastValidatedAssessmentId).toBe('assessment-tierA')
    expect(telemetry.truncatedSections).toEqual([])
    expect(telemetry.blockCharCount).toBe(patientContextBlock.length)
  })

  it('riskState=none produces empty riskOpeningNotice and riskTriggered=false', () => {
    const ctx = makeTierACtx({ riskState: 'none' })
    const { riskOpeningNotice, telemetry } = assemblePlan6ContextPieces(ctx, NOW)

    expect(riskOpeningNotice).toBe('')
    expect(telemetry.riskTriggered).toBe(false)
  })

  it('riskState=acute surfaces the acute continuity notice', () => {
    const ctx = makeTierACtx({ riskState: 'acute' })
    const { riskOpeningNotice, telemetry } = assemblePlan6ContextPieces(ctx, NOW)

    expect(riskOpeningNotice).toContain('[AVISO DE CONTINUIDAD — RIESGO AGUDO]')
    expect(telemetry.riskTriggered).toBe(true)
    expect(telemetry.riskState).toBe('acute')
  })
})

describe('assemblePlan6ContextPieces — retake hint integration', () => {
  it('appends the retake hint on its own line after the context block when hint fires', () => {
    // PHQ-9 score=18 (severe) scored 10 days ago → severe rule fires (>7 days).
    const ctx = makeTierACtx({
      recentQuestionnaires: [
        {
          code: 'PHQ9',
          score: 18,
          band: 'severe',
          scoredAt: daysAgo(10),
          deltaVsPrevious: null,
        },
      ],
    })
    const { patientContextBlock } = assemblePlan6ContextPieces(ctx, NOW)

    expect(patientContextBlock).toContain('PHQ-9 del paciente era severo')
    // Hint should be on a new line after the block's content.
    const hintIndex = patientContextBlock.indexOf('el PHQ-9 del paciente era severo')
    expect(hintIndex).toBeGreaterThan(0)
    // The character immediately before the hint should be a newline.
    expect(patientContextBlock.charAt(hintIndex - 1)).toBe('\n')
  })

  it('omits the hint line when no retake rule fires', () => {
    const ctx = makeTierACtx() // no questionnaires → no hint
    const { patientContextBlock } = assemblePlan6ContextPieces(ctx, NOW)

    expect(patientContextBlock).not.toContain('considera proponerlo de nuevo')
    expect(patientContextBlock).not.toContain('re-administrarlo')
  })
})

describe('assemblePlan6ContextPieces — truncatedSections propagation', () => {
  it('bubbles up the truncatedSections from renderPatientContextBlockWithMeta', () => {
    // Huge summary to trip step 1+2 of truncation (mirrors render.test.ts huge-truncation fixture).
    const hugeCc = 'X'.repeat(400)
    const hugePresenting = Array.from({ length: 10 }, (_, i) => `Síntoma ${i}: ${'A'.repeat(120)}`)
    const hugeAreas = Array.from({ length: 10 }, (_, i) => `Área ${i}: ${'B'.repeat(120)}`)
    const heavyTasks = Array.from({ length: 5 }, (_, i) => ({
      id: `t-${i}`,
      descripcion: `Tarea pesada número ${i}: ${'T'.repeat(90)}`,
      estado: 'pendiente' as const,
      acordadaEn: daysAgo(i + 1),
    }))

    const ctx = makeTierACtx({
      validated: {
        id: 'assessment-trunc',
        reviewedAt: daysAgo(10),
        summary: {
          chief_complaint: hugeCc,
          presenting_issues: hugePresenting,
          areas_for_exploration: hugeAreas,
          risk_assessment: baseRisk,
          questionnaires: [],
        },
        ageInDays: 10,
      },
      pendingTasks: heavyTasks,
    })

    const { telemetry } = assemblePlan6ContextPieces(ctx, NOW)
    expect(telemetry.truncatedSections).toEqual(['areas_for_exploration', 'presenting_issues'])
  })
})
