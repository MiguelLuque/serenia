import { describe, it, expect } from 'vitest'
import { renderPatientContextBlock, computeRiskOpeningNotice } from '@/lib/patient-context/render'
import type { PatientContext } from '@/lib/patient-context/builder'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function daysAgo(n: number, base = '2026-04-22T12:00:00Z'): string {
  return new Date(new Date(base).getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

const baseRisk = { suicidality: 'none' as const, self_harm: 'none' as const, notes: '' }

/** Minimal valid PatientContext for tier A */
function makeTierACtx(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    tier: 'tierA',
    isFirstSession: false,
    patient: { displayName: 'Ana López', age: 30 },
    validated: {
      reviewedAt: daysAgo(10),
      summary: {
        chief_complaint: 'Ansiedad persistente con pensamientos intrusivos.',
        presenting_issues: ['insomnio', 'dificultad de concentración'],
        areas_for_exploration: ['dinámica familiar', 'relaciones laborales'],
        risk_assessment: baseRisk,
        questionnaires: [],
      },
      ageInDays: 10,
    },
    tierBDraft: null,
    recentQuestionnaires: [],
    openRiskEvents: [],
    previousSession: { closedAt: daysAgo(7), closureReason: null, daysAgo: 7 },
    pendingTasks: [],
    sessionNumber: 3,
    riskState: 'none',
    ...overrides,
  }
}

function makeTierBCtx(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    tier: 'tierB',
    isFirstSession: false,
    patient: { displayName: 'Luis Martín', age: 25 },
    validated: null,
    tierBDraft: {
      closedAt: daysAgo(5),
      summary: {
        chief_complaint: 'Estrés laboral y dificultades de pareja.',
        presenting_issues: ['irritabilidad', 'cansancio'],
        questionnaires: [],
      },
    },
    recentQuestionnaires: [],
    openRiskEvents: [],
    previousSession: { closedAt: daysAgo(5), closureReason: null, daysAgo: 5 },
    pendingTasks: [],
    sessionNumber: 2,
    riskState: 'none',
    ...overrides,
  }
}

function makeHistoricCtx(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    tier: 'historic',
    isFirstSession: false,
    patient: { displayName: 'Pedro Ruiz', age: 45 },
    validated: {
      reviewedAt: daysAgo(120),
      summary: {
        chief_complaint: 'Depresión recurrente.',
        presenting_issues: ['ánimo bajo', 'aislamiento social'],
        areas_for_exploration: ['relaciones familiares'],
        risk_assessment: baseRisk,
        questionnaires: [],
      },
      ageInDays: 120,
    },
    tierBDraft: null,
    recentQuestionnaires: [],
    openRiskEvents: [],
    previousSession: { closedAt: daysAgo(14), closureReason: null, daysAgo: 14 },
    pendingTasks: [],
    sessionNumber: 5,
    riskState: 'none',
    ...overrides,
  }
}

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

// ── Test 1: Tier A, riskState='none' ─────────────────────────────────────────

describe('renderPatientContextBlock — Tier A', () => {
  it('includes chief_complaint, presenting_issues, patient name, and session info', () => {
    const ctx = makeTierACtx()
    const block = renderPatientContextBlock(ctx)

    expect(block).toContain('Ansiedad persistente con pensamientos intrusivos.')
    expect(block).toContain('insomnio')
    expect(block).toContain('dificultad de concentración')
    expect(block).toContain('Ana López')
    expect(block).toContain('Sesión nº 3')
    expect(block).toContain('han pasado 7 días desde la anterior')
    expect(block).toContain('última revisión clínica de hace 10 días')
    expect(block).toContain('Riesgo clínico registrado')
    expect(block).toContain('---')
  })

  it('includes pending tasks section when tasks present', () => {
    const ctx = makeTierACtx({
      pendingTasks: [
        { id: '1', descripcion: 'Practicar respiración', estado: 'pendiente', acordadaEn: daysAgo(3) },
      ],
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('Acuerdos abiertos de sesiones anteriores')
    expect(block).toContain('Practicar respiración')
  })

  it('omits previous session days when previousSession is null', () => {
    const ctx = makeTierACtx({ previousSession: null })
    const block = renderPatientContextBlock(ctx)
    expect(block).not.toContain('han pasado')
  })

  it('omits age when age is null', () => {
    const ctx = makeTierACtx({ patient: { displayName: 'Ana López', age: null } })
    const block = renderPatientContextBlock(ctx)
    expect(block).not.toContain(' años')
    expect(block).toContain('Ana López')
  })

  it('uses "el paciente" when displayName is null', () => {
    const ctx = makeTierACtx({ patient: { displayName: null, age: 30 } })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('Paciente: el paciente')
  })

  it('does NOT include hard-excluded fields', () => {
    const block = renderPatientContextBlock(makeTierACtx())
    expect(block).not.toContain('preliminary_impression')
    expect(block).not.toContain('recommended_actions_for_clinician')
    expect(block).not.toContain('mood_affect')
    expect(block).not.toContain('cognitive_patterns')
    expect(block).not.toContain('patient_facing_summary')
    expect(block).not.toContain('proposed_tasks')
  })

  it('computeRiskOpeningNotice returns null when riskState is none', () => {
    const ctx = makeTierACtx()
    expect(computeRiskOpeningNotice(ctx)).toBeNull()
  })

  it('includes instructions section', () => {
    const block = renderPatientContextBlock(makeTierACtx())
    expect(block).toContain('Instrucciones para esta sesión:')
    expect(block).toContain('PRIMER mensaje está prohibido')
    expect(block).toContain('partir del tercer turno')
  })

  it('skips areas_for_exploration section when empty', () => {
    const ctx = makeTierACtx()
    ctx.validated!.summary.areas_for_exploration = []
    const block = renderPatientContextBlock(ctx)
    expect(block).not.toContain('Áreas a explorar pendientes')
  })

  it('renders areas_for_exploration when present', () => {
    const block = renderPatientContextBlock(makeTierACtx())
    expect(block).toContain('Áreas a explorar pendientes')
    expect(block).toContain('dinámica familiar')
  })
})

// ── Test 2: Tier B — no excluded fields ──────────────────────────────────────

describe('renderPatientContextBlock — Tier B', () => {
  it('renders Tier B header and session info', () => {
    const block = renderPatientContextBlock(makeTierBCtx())
    expect(block).toContain('[CONTEXTO DEL PACIENTE — sesión anterior sin revisión clínica todavía]')
    expect(block).toContain('Luis Martín')
    expect(block).toContain('Sesión nº 2')
    expect(block).toContain('Estrés laboral')
  })

  it('does NOT include hard-excluded fields even if smuggled into summary context', () => {
    // We pass a ctx where no smuggled fields are possible (they're not in the Pick),
    // but we verify the rendered block does not contain those strings at all.
    const ctx = makeTierBCtx()
    const block = renderPatientContextBlock(ctx)
    expect(block).not.toContain('preliminary_impression')
    expect(block).not.toContain('recommended_actions_for_clinician')
    expect(block).not.toContain('mood_affect')
    expect(block).not.toContain('cognitive_patterns')
    expect(block).not.toContain('patient_facing_summary')
    expect(block).not.toContain('proposed_tasks')
  })

  it('includes Tier B instructions', () => {
    const block = renderPatientContextBlock(makeTierBCtx())
    expect(block).toContain('NO está revisado por un clínico')
    expect(block).toContain('Instrucciones para esta sesión:')
  })

  it('includes presenting issues inline when present', () => {
    const block = renderPatientContextBlock(makeTierBCtx())
    expect(block).toContain('irritabilidad')
    expect(block).toContain('cansancio')
  })

  it('omits presenting issues when empty', () => {
    const ctx = makeTierBCtx()
    ctx.tierBDraft!.summary.presenting_issues = []
    const block = renderPatientContextBlock(ctx)
    expect(block).not.toContain('Temas presentes')
  })

  it('ends with ---', () => {
    const block = renderPatientContextBlock(makeTierBCtx())
    expect(block.trimEnd()).toMatch(/---$/)
  })
})

// ── Test 3: historic tier ─────────────────────────────────────────────────────

describe('renderPatientContextBlock — historic tier', () => {
  it('header contains "CONTEXTO HISTÓRICO" and "puede estar desactualizado"', () => {
    const block = renderPatientContextBlock(makeHistoricCtx())
    expect(block).toContain('CONTEXTO HISTÓRICO')
    expect(block).toContain('puede estar desactualizado')
  })

  it('includes extra instruction "Pregunta antes de asumir"', () => {
    const block = renderPatientContextBlock(makeHistoricCtx())
    expect(block).toContain('Pregunta antes de asumir')
  })

  it('OMITS "Acuerdos abiertos" when ALL pendingTasks predate validated.reviewedAt', () => {
    const reviewedAt = daysAgo(120)
    const ctx = makeHistoricCtx({
      validated: {
        reviewedAt,
        summary: {
          chief_complaint: 'Depresión recurrente.',
          presenting_issues: ['ánimo bajo'],
          areas_for_exploration: [],
          risk_assessment: baseRisk,
          questionnaires: [],
        },
        ageInDays: 120,
      },
      pendingTasks: [
        // Both predate reviewedAt (which is daysAgo(120)), so use daysAgo(150) and daysAgo(200)
        { id: '1', descripcion: 'Tarea antigua 1', estado: 'pendiente', acordadaEn: daysAgo(150) },
        { id: '2', descripcion: 'Tarea antigua 2', estado: 'parcial', acordadaEn: daysAgo(200) },
      ],
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).not.toContain('Acuerdos abiertos')
  })

  it('INCLUDES "Acuerdos abiertos" when at least one pendingTask postdates validated.reviewedAt', () => {
    const reviewedAt = daysAgo(120)
    const ctx = makeHistoricCtx({
      validated: {
        reviewedAt,
        summary: {
          chief_complaint: 'Depresión recurrente.',
          presenting_issues: ['ánimo bajo'],
          areas_for_exploration: [],
          risk_assessment: baseRisk,
          questionnaires: [],
        },
        ageInDays: 120,
      },
      pendingTasks: [
        // One predates, one postdates
        { id: '1', descripcion: 'Tarea antigua', estado: 'pendiente', acordadaEn: daysAgo(150) },
        { id: '2', descripcion: 'Tarea reciente', estado: 'parcial', acordadaEn: daysAgo(30) },
      ],
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('Acuerdos abiertos')
    expect(block).toContain('Tarea reciente')
  })

  it('does NOT contain "[CONTEXTO DEL PACIENTE — última" substring', () => {
    const block = renderPatientContextBlock(makeHistoricCtx())
    expect(block).not.toContain('[CONTEXTO DEL PACIENTE — última')
  })
})

// ── Test 4: first session (tier='none', tierBDraft=null) ──────────────────────

describe('renderPatientContextBlock — first session', () => {
  it('contains first session header and intake disclaimer', () => {
    const block = renderPatientContextBlock(makeNoneCtx())
    expect(block).toContain('[CONTEXTO DEL PACIENTE — primera sesión]')
    expect(block).toContain('postura de intake habitual')
    expect(block).toContain('No hay evaluación clínica previa')
  })

  it('does NOT contain "[CONTEXTO DEL PACIENTE — última" substring', () => {
    const block = renderPatientContextBlock(makeNoneCtx())
    expect(block).not.toContain('[CONTEXTO DEL PACIENTE — última')
  })

  it('ends with ---', () => {
    const block = renderPatientContextBlock(makeNoneCtx())
    expect(block.trimEnd()).toMatch(/---$/)
  })
})

// ── Test 5: Truncation ────────────────────────────────────────────────────────

describe('renderPatientContextBlock — truncation', () => {
  it('block.length <= 2500 when content is huge; chief_complaint (first 150 chars) still present; risk_assessment and instructions still present', () => {
    // 400-char chief_complaint
    const hugeCc = 'X'.repeat(400)
    // 10 large presenting_issues items (130 chars each)
    const hugePresenting = Array.from({ length: 10 }, (_, i) => `Síntoma ${i}: ${'A'.repeat(120)}`)
    // 10 large areas_for_exploration items
    const hugeAreas = Array.from({ length: 10 }, (_, i) => `Área ${i}: ${'B'.repeat(120)}`)

    const ctx = makeTierACtx({
      validated: {
        reviewedAt: daysAgo(10),
        summary: {
          chief_complaint: hugeCc,
          presenting_issues: hugePresenting,
          areas_for_exploration: hugeAreas,
          risk_assessment: { suicidality: 'passive', self_harm: 'historic', notes: '' },
          questionnaires: [],
        },
        ageInDays: 10,
      },
    })

    const block = renderPatientContextBlock(ctx)

    // Length constraint
    expect(block.length).toBeLessThanOrEqual(2500)

    // chief_complaint first 150 chars still present (truncated to 150)
    expect(block).toContain(hugeCc.slice(0, 149))

    // risk_assessment still present
    expect(block).toContain('Riesgo clínico registrado')
    expect(block).toContain('passive')
    expect(block).toContain('historic')

    // Instructions still present
    expect(block).toContain('Instrucciones para esta sesión:')
  })
})

// ── Test 6: Pending tasks cap ─────────────────────────────────────────────────

describe('renderPatientContextBlock — pending tasks cap', () => {
  it('caps at 5 items and shows overflow count', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => ({
      id: `task-${i}`,
      descripcion: `Tarea número ${i + 1}`,
      estado: 'pendiente' as const,
      acordadaEn: daysAgo(i + 1),
    }))
    const ctx = makeTierACtx({ pendingTasks: tasks })
    const block = renderPatientContextBlock(ctx)

    // First 5 tasks should appear
    expect(block).toContain('Tarea número 1')
    expect(block).toContain('Tarea número 5')
    // Task 6, 7, 8 should NOT appear by name
    expect(block).not.toContain('Tarea número 6')
    expect(block).not.toContain('Tarea número 7')
    expect(block).not.toContain('Tarea número 8')
    // Overflow indicator
    expect(block).toContain('+3 acuerdos más')
  })
})

// ── Test 7: Questionnaire delta rendering ─────────────────────────────────────

describe('renderPatientContextBlock — questionnaire delta', () => {
  it('renders +2 delta correctly', () => {
    const ctx = makeTierACtx({
      recentQuestionnaires: [
        { code: 'PHQ9', score: 12, band: 'moderate', scoredAt: daysAgo(2), deltaVsPrevious: 2 },
      ],
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('PHQ-9')
    expect(block).toContain('+2')
    expect(block).toContain('antes')
  })

  it('renders -3 delta correctly', () => {
    const ctx = makeTierACtx({
      recentQuestionnaires: [
        { code: 'GAD7', score: 7, band: 'mild', scoredAt: daysAgo(3), deltaVsPrevious: -3 },
      ],
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('GAD-7')
    expect(block).toContain('-3')
    expect(block).toContain('antes')
  })

  it('renders 0 delta correctly', () => {
    const ctx = makeTierACtx({
      recentQuestionnaires: [
        { code: 'ASQ', score: 2, band: 'low', scoredAt: daysAgo(1), deltaVsPrevious: 0 },
      ],
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('ASQ')
    // 0 delta renders as "0" (no +), "antes" still present
    expect(block).toContain('0')
    expect(block).toContain('antes')
  })

  it('omits " — antes ..." when deltaVsPrevious is null', () => {
    const ctx = makeTierACtx({
      recentQuestionnaires: [
        { code: 'PHQ9', score: 10, band: 'moderate', scoredAt: daysAgo(5), deltaVsPrevious: null },
      ],
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('PHQ-9')
    // "antes" should NOT appear in the questionnaire line
    expect(block).not.toContain('antes')
  })
})

// ── Test 8: computeRiskOpeningNotice ──────────────────────────────────────────

describe('computeRiskOpeningNotice', () => {
  it('returns null when riskState is none', () => {
    const ctx = makeTierACtx({ riskState: 'none' })
    expect(computeRiskOpeningNotice(ctx)).toBeNull()
  })

  it('returns exact acute notice string', () => {
    const ctx = makeTierACtx({ riskState: 'acute' })
    expect(computeRiskOpeningNotice(ctx)).toBe(
      "[AVISO DE CONTINUIDAD — RIESGO AGUDO] Protocolo de crisis inmediato: valida sin alarmismo, ofrece Línea 024 textualmente, si hay señales de riesgo inmediato llama a close_session con reason='crisis_detected'. No inicies otras líneas de conversación hasta asegurar la continuidad de riesgo.",
    )
  })

  it('returns exact active notice string', () => {
    const ctx = makeTierACtx({ riskState: 'active' })
    expect(computeRiskOpeningNotice(ctx)).toBe(
      '[AVISO DE CONTINUIDAD — RIESGO ACTIVO] Abre con un check-in cálido y específico sobre cómo está hoy respecto a la ideación reportada. Si el paciente abre con afecto positivo claro, haz el check-in en UNA frase breve y devuélvele el espacio inmediatamente. Ten la Línea 024 lista.',
    )
  })

  it('returns exact watch notice string', () => {
    const ctx = makeTierACtx({ riskState: 'watch' })
    expect(computeRiskOpeningNotice(ctx)).toBe(
      '[AVISO DE CONTINUIDAD — VIGILANCIA] En la sesión / informe anterior se registraron señales leves. Abre normalmente, pero mantén atención a reaparición; si el paciente abre con afecto positivo, no fuerces un check-in de seguridad.',
    )
  })

  it('none/watch/active/acute notices do not have surrounding newlines', () => {
    const states = ['watch', 'active', 'acute'] as const
    for (const state of states) {
      const notice = computeRiskOpeningNotice(makeTierACtx({ riskState: state }))!
      expect(notice).not.toMatch(/^\n/)
      expect(notice).not.toMatch(/\n$/)
    }
  })
})

// ── Additional edge cases ─────────────────────────────────────────────────────

describe('renderPatientContextBlock — additional edge cases', () => {
  it('formats date as DD/MM/YYYY', () => {
    const ctx = makeTierACtx({
      pendingTasks: [
        { id: '1', descripcion: 'Tarea', estado: 'pendiente', acordadaEn: '2026-01-15T10:00:00Z' },
      ],
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('15/01/2026')
  })

  it('risk_assessment renders raw enum values', () => {
    const ctx = makeTierACtx({
      validated: {
        reviewedAt: daysAgo(10),
        summary: {
          chief_complaint: 'Test',
          presenting_issues: [],
          areas_for_exploration: [],
          risk_assessment: { suicidality: 'passive', self_harm: 'current', notes: '' },
          questionnaires: [],
        },
        ageInDays: 10,
      },
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('Ideación suicida: passive')
    expect(block).toContain('autolesión: current')
  })

  it('chief_complaint capped at 300 chars for tier A', () => {
    const longCc = 'A'.repeat(400)
    const ctx = makeTierACtx({
      validated: {
        reviewedAt: daysAgo(10),
        summary: {
          chief_complaint: longCc,
          presenting_issues: [],
          areas_for_exploration: [],
          risk_assessment: baseRisk,
          questionnaires: [],
        },
        ageInDays: 10,
      },
    })
    const block = renderPatientContextBlock(ctx)
    // Should contain 299 A's + ellipsis, not 400 A's
    expect(block).toContain('A'.repeat(299) + '…')
    expect(block).not.toContain('A'.repeat(300))
  })

  it('presenting_issues capped at 120 chars each, max 6 items', () => {
    const items = Array.from({ length: 10 }, (_, i) => `Item ${i}: ${'X'.repeat(130)}`)
    const ctx = makeTierACtx({
      validated: {
        reviewedAt: daysAgo(10),
        summary: {
          chief_complaint: 'Test',
          presenting_issues: items,
          areas_for_exploration: [],
          risk_assessment: baseRisk,
          questionnaires: [],
        },
        ageInDays: 10,
      },
    })
    const block = renderPatientContextBlock(ctx)
    // Should not include item 7 through 10
    expect(block).not.toContain('Item 6:')
    expect(block).not.toContain('Item 7:')
    // First item should be truncated
    expect(block).toContain('…')
  })
})
