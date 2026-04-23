import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { assemblePlan6ContextPieces } from '@/lib/chat/assemble-plan6-prompt'
import { buildChatSystemPrompt } from '@/lib/chat/system-prompt'
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
  it('injects the retake hint as a bullet INSIDE the Instructions section (not below the separator)', () => {
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

    const hintIndex = patientContextBlock.indexOf('el PHQ-9 del paciente era severo')
    const instructionsIndex = patientContextBlock.indexOf('Instrucciones para esta sesión:')
    const finalSeparatorIndex = patientContextBlock.lastIndexOf('\n\n---')

    expect(hintIndex).toBeGreaterThan(instructionsIndex)
    // Must be inside Instructions, i.e. before the closing separator.
    expect(hintIndex).toBeLessThan(finalSeparatorIndex)
    // Must be rendered as a bullet.
    expect(patientContextBlock).toContain('- el PHQ-9 del paciente era severo')
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

// ── Plan-mandated integration scenarios (plan line 582-586) ─────────────────

describe('buildChatSystemPrompt — plan-mandated system-prompt ordering', () => {
  const BASE = 'BASE_PROMPT_TOKEN\n\n'
  const RISK = '[AVISO DE CONTINUIDAD — RIESGO ACTIVO] RISK_BODY\n\n---\n\n'
  const CRISIS = '[AVISO DE SEGURIDAD — ALERTA ACTIVADA]\nCRISIS_BODY\n\n---\n\n'
  const QNAIRE = '[RESULTADO DE CUESTIONARIO — PHQ9]\nQ_BODY\n\n---\n\n'
  const TIME = '[AVISO DE TIEMPO]\nTIME_BODY\n\n---\n\n'
  const BLOCK = '[CONTEXTO DEL PACIENTE — primera sesión]\nBLOCK_BODY\n\n---'

  it('concatenates in the exact plan order: base → risk → crisis → questionnaire → time → block', () => {
    const prompt = buildChatSystemPrompt({
      basePrompt: BASE,
      riskOpeningNotice: RISK,
      crisisNotice: CRISIS,
      questionnaireNotice: QNAIRE,
      timeNotice: TIME,
      patientContextBlock: BLOCK,
    })

    const baseIdx = prompt.indexOf('BASE_PROMPT_TOKEN')
    const riskIdx = prompt.indexOf('RISK_BODY')
    const crisisIdx = prompt.indexOf('CRISIS_BODY')
    const qnaireIdx = prompt.indexOf('Q_BODY')
    const timeIdx = prompt.indexOf('TIME_BODY')
    const blockIdx = prompt.indexOf('BLOCK_BODY')

    expect(baseIdx).toBeLessThan(riskIdx)
    expect(riskIdx).toBeLessThan(crisisIdx)
    expect(crisisIdx).toBeLessThan(qnaireIdx)
    expect(qnaireIdx).toBeLessThan(timeIdx)
    expect(timeIdx).toBeLessThan(blockIdx)
  })

  it('flag-off semantics: empty block + empty risk → prompt is basePrompt + per-turn notices, no Plan-6 artifacts', () => {
    // Plan line 583: "Flag off → system prompt idéntico al pre-Plan-6."
    // The pre-Plan-6 assembly was basePrompt concatenated with crisisNotice, questionnaireNotice, timeNotice.
    // With Plan-6 pieces empty, buildChatSystemPrompt must produce a string byte-equal to the pre-Plan-6 assembly.
    const flagOff = buildChatSystemPrompt({
      basePrompt: BASE,
      riskOpeningNotice: '',
      crisisNotice: CRISIS,
      questionnaireNotice: QNAIRE,
      timeNotice: TIME,
      patientContextBlock: '',
    })

    expect(flagOff).toBe(BASE + CRISIS + QNAIRE + TIME)
    expect(flagOff).not.toContain('[AVISO DE CONTINUIDAD')
    expect(flagOff).not.toContain('[CONTEXTO DEL PACIENTE')
  })

  it('risk + crisis adjacent do not glue onto the same line (separator fix)', () => {
    // Regression: before the T10 fix, riskOpeningNotice ended with "." and
    // crisisNotice started with "[AVISO DE SEGURIDAD …", producing
    // "…de riesgo.[AVISO DE SEGURIDAD…" on the same line. The separator fix
    // appends "\n\n---\n\n" to every risk notice.
    const prompt = buildChatSystemPrompt({
      basePrompt: BASE,
      riskOpeningNotice: RISK,
      crisisNotice: CRISIS,
      questionnaireNotice: '',
      timeNotice: '',
      patientContextBlock: '',
    })

    expect(prompt).not.toMatch(/riesgo\.\[AVISO DE SEGURIDAD/)
    // Risk block must be terminated by the project separator before crisis starts.
    expect(prompt).toContain('\n\n---\n\n[AVISO DE SEGURIDAD')
  })
})

// ── logContextInjection — writes one row via service role ───────────────────

describe('logContextInjection — plan line 586 ("una fila escrita")', () => {
  // Mock the service-role client so the assertion runs without a live DB.
  const insertMock = vi.fn()
  const fromMock = vi.fn(() => ({ insert: insertMock }))

  beforeEach(() => {
    insertMock.mockReset()
    insertMock.mockResolvedValue({ error: null })
    fromMock.mockClear()
    vi.resetModules()
    vi.doMock('@/lib/supabase/server', () => ({
      createServiceRoleClient: () => ({ from: fromMock }),
    }))
  })

  afterEach(() => {
    vi.doUnmock('@/lib/supabase/server')
  })

  it('inserts exactly one row into patient_context_injections with the full telemetry payload', async () => {
    const { logContextInjection } = await import('@/lib/patient-context/telemetry')

    await logContextInjection({
      userId: 'user-1',
      sessionId: 'session-1',
      tier: 'tierA',
      riskState: 'watch',
      blockCharCount: 1234,
      pendingTasksCount: 2,
      riskTriggered: true,
      lastValidatedAssessmentId: 'assessment-tierA',
      truncatedSections: ['areas_for_exploration'],
    })

    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('patient_context_injections')
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      session_id: 'session-1',
      tier: 'tierA',
      risk_state: 'watch',
      block_char_count: 1234,
      pending_tasks_count: 2,
      risk_triggered: true,
      last_validated_assessment_id: 'assessment-tierA',
      truncated_sections: ['areas_for_exploration'],
    })
  })

  it('propagates insert errors so the caller can .catch them (fire-and-forget semantics)', async () => {
    insertMock.mockResolvedValue({ error: new Error('RLS violation') })
    const { logContextInjection } = await import('@/lib/patient-context/telemetry')

    await expect(
      logContextInjection({
        userId: 'u',
        sessionId: 's',
        tier: 'none',
        riskState: 'none',
        blockCharCount: 0,
        pendingTasksCount: 0,
        riskTriggered: false,
        lastValidatedAssessmentId: null,
        truncatedSections: [],
      }),
    ).rejects.toThrow('RLS violation')
  })
})
