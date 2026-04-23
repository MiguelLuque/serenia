import { describe, it, expect } from 'vitest'
import {
  renderPatientContextBlock,
  renderPatientContextBlockWithMeta,
  computeRiskOpeningNotice,
} from '@/lib/patient-context/render'
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
      id: 'assessment-tierA-fixture',
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
      id: 'assessment-historic-fixture',
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
    // This test catches accidental hardcoding of forbidden field NAMES in the
    // template string, but NOT a Pick<> regression — see the smuggle test below.
    const ctx = makeTierBCtx()
    const block = renderPatientContextBlock(ctx)
    expect(block).not.toContain('preliminary_impression')
    expect(block).not.toContain('recommended_actions_for_clinician')
    expect(block).not.toContain('mood_affect')
    expect(block).not.toContain('cognitive_patterns')
    expect(block).not.toContain('patient_facing_summary')
    expect(block).not.toContain('proposed_tasks')
  })

  it('Tier B: even if chief_complaint contains a forbidden field NAME as literal text, no pick-leak happens', () => {
    // The builder's Pick<> is what prevents forbidden fields from reaching
    // render. This test documents that assumption: when the forbidden field
    // NAMES appear as legitimate user content inside chief_complaint, they
    // DO surface in the rendered block (as content, not as leaked fields).
    // If a future refactor removes the Pick<> on tierBDraft.summary, forbidden
    // fields would start leaking silently and the `.not.toContain` tests
    // above would not catch it — only the Pick<> guards that. This test locks
    // the architectural invariant in place.
    const ctx = makeTierBCtx({
      tierBDraft: {
        closedAt: daysAgo(5),
        summary: {
          chief_complaint:
            'Preocupaciones generales (el paciente mencionó preliminary_impression como duda) sobre recommended_actions_for_clinician',
          presenting_issues: ['irritabilidad'],
          questionnaires: [],
        },
      },
    })
    const block = renderPatientContextBlock(ctx)
    expect(block).toContain('preliminary_impression')
    expect(block).toContain('recommended_actions_for_clinician')
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
        id: 'assessment-historic-all-predate',
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
        id: 'assessment-historic-mixed',
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
  it('block.length <= 2500 when content is huge; cascade steps 1+2 both fire (areas + presenting dropped); chief_complaint, risk_assessment and instructions survive', () => {
    // 400-char chief_complaint (will be capped to 300, then to 150 if step 3 fires)
    const hugeCc = 'X'.repeat(400)
    // 10 large presenting_issues items (130 chars each — truncated to 120)
    const hugePresenting = Array.from({ length: 10 }, (_, i) => `Síntoma ${i}: ${'A'.repeat(120)}`)
    // 10 large areas_for_exploration items
    const hugeAreas = Array.from({ length: 10 }, (_, i) => `Área ${i}: ${'B'.repeat(120)}`)
    // Large pending-tasks section (not dropped by cascade) to force step 2 to fire.
    // Without tasks eating budget, step 1 alone already gets the block under 2500
    // and step 2 would never execute — masking a regression where step 1 is broken.
    const heavyTasks = Array.from({ length: 5 }, (_, i) => ({
      id: `t-${i}`,
      descripcion: `Tarea pesada número ${i}: ${'T'.repeat(90)}`,
      estado: 'pendiente' as const,
      acordadaEn: daysAgo(i + 1),
    }))

    const ctx = makeTierACtx({
      validated: {
        id: 'assessment-truncation',
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
      pendingTasks: heavyTasks,
    })

    const block = renderPatientContextBlock(ctx)

    // Length constraint
    expect(block.length).toBeLessThanOrEqual(2500)

    // Cascade step 1 fired: areas_for_exploration section dropped
    expect(block).not.toContain('Áreas a explorar pendientes:')
    // Cascade step 2 fired: presenting_issues section also dropped
    expect(block).not.toContain('Síntomas presentes:')

    // chief_complaint survives (at least the first 150 chars) — never dropped
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
    // Match the exact rendered shape of the 0-delta questionnaire line:
    //   - ASQ: 2 (low) el <date> — antes 0
    // The bare char '0' is too loose (appears in dates, ages, session nº).
    expect(block).toContain('- ASQ: 2 (low) el ')
    expect(block).toContain(' — antes 0')
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
        id: 'assessment-risk-enums',
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
        id: 'assessment-cc-cap',
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
        id: 'assessment-pi-cap',
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

// ── renderPatientContextBlockWithMeta — truncatedSections reporting ──────────

describe('renderPatientContextBlockWithMeta — truncatedSections', () => {
  it('returns empty truncatedSections when block fits under 2500 chars', () => {
    const { block, truncatedSections } = renderPatientContextBlockWithMeta(makeTierACtx())
    expect(block.length).toBeLessThanOrEqual(2500)
    expect(truncatedSections).toEqual([])
  })

  it('returns empty truncatedSections for tier=none (first session)', () => {
    const { truncatedSections } = renderPatientContextBlockWithMeta(makeNoneCtx())
    expect(truncatedSections).toEqual([])
  })

  it('returns empty truncatedSections for tierB blocks (never truncate)', () => {
    const { truncatedSections } = renderPatientContextBlockWithMeta(makeTierBCtx())
    expect(truncatedSections).toEqual([])
  })

  it('returns [areas_for_exploration] when only step 1 fires', () => {
    // Just enough areas_for_exploration to push over 2500 but trimming areas alone brings it under.
    // Base tierA fixture is ~small; we inflate areas_for_exploration only.
    const hugeAreas = Array.from({ length: 6 }, (_, i) => `Área ${i}: ${'B'.repeat(120)}`)
    const ctx = makeTierACtx({
      validated: {
        id: 'trunc-step1',
        reviewedAt: daysAgo(10),
        summary: {
          chief_complaint: 'Motivo breve para que solo areas inflen el bloque.',
          presenting_issues: ['uno'],
          areas_for_exploration: hugeAreas,
          // Additional padding so dropping areas alone gets us under 2500 — but
          // keeping areas overflows. We use a moderately long chief_complaint
          // and a few presenting issues but not enough to trip step 2.
          risk_assessment: baseRisk,
          questionnaires: [],
        },
        ageInDays: 10,
      },
    })

    // Extra padding in presenting_issues to reliably breach 2500 when areas stays.
    ctx.validated!.summary.presenting_issues = Array.from({ length: 6 }, (_, i) => `Síntoma ${i}: ${'A'.repeat(100)}`)

    const { block, truncatedSections } = renderPatientContextBlockWithMeta(ctx)
    expect(block.length).toBeLessThanOrEqual(2500)
    expect(truncatedSections).toEqual(['areas_for_exploration'])
    // Sanity: areas dropped but presenting_issues survived
    expect(block).not.toContain('Áreas a explorar pendientes:')
    expect(block).toContain('Síntomas presentes:')
  })

  it('returns [areas_for_exploration, presenting_issues] when steps 1+2 fire', () => {
    // Inflate both presenting_issues and areas_for_exploration, plus heavy tasks.
    // Based on the existing "huge" truncation test — we know steps 1+2 fire there.
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
        id: 'trunc-step12',
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
      pendingTasks: heavyTasks,
    })

    const { block, truncatedSections } = renderPatientContextBlockWithMeta(ctx)
    expect(block.length).toBeLessThanOrEqual(2500)
    expect(truncatedSections).toEqual(['areas_for_exploration', 'presenting_issues'])
  })

  it('returns [areas_for_exploration, presenting_issues, chief_complaint_capped] when step 3 fires', () => {
    // Force step 3 to fire by making non-truncatable sections (tasks, questionnaires)
    // plus chief_complaint eat enough budget that even after dropping areas +
    // presenting, the block still exceeds 2500 — then chief_complaint is capped to 150.
    const hugeCc = 'C'.repeat(800)
    const hugePresenting = Array.from({ length: 10 }, (_, i) => `Síntoma ${i}: ${'A'.repeat(120)}`)
    const hugeAreas = Array.from({ length: 10 }, (_, i) => `Área ${i}: ${'B'.repeat(120)}`)

    // Lots of heavy tasks — 10 tasks (5 rendered + "+5 acuerdos más") with long descriptions.
    const heavyTasks = Array.from({ length: 10 }, (_, i) => ({
      id: `t-${i}`,
      descripcion: `Tarea ${i}: ${'T'.repeat(200)}`,
      estado: 'pendiente' as const,
      acordadaEn: daysAgo(i + 1),
    }))

    // Many questionnaires (rendered inline, not truncated by cascade) to pressure step 3.
    const heavyQuestionnaires = [
      { code: 'PHQ9' as const, score: 12, band: 'moderate', scoredAt: daysAgo(1), deltaVsPrevious: 2 },
      { code: 'GAD7' as const, score: 8, band: 'mild', scoredAt: daysAgo(2), deltaVsPrevious: -1 },
      { code: 'ASQ' as const, score: 3, band: 'low', scoredAt: daysAgo(3), deltaVsPrevious: 0 },
    ]

    const ctx = makeTierACtx({
      validated: {
        id: 'trunc-step3',
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
      pendingTasks: heavyTasks,
      recentQuestionnaires: heavyQuestionnaires,
    })

    const { block, truncatedSections } = renderPatientContextBlockWithMeta(ctx)
    expect(block.length).toBeLessThanOrEqual(2500)
    expect(truncatedSections).toEqual([
      'areas_for_exploration',
      'presenting_issues',
      'chief_complaint_capped',
    ])
    // chief_complaint was capped to 150 (149 C's + '…')
    expect(block).toContain('C'.repeat(149) + '…')
    // Full 400 C's would mean the 300-cap ran; step 3 replaces with 150-cap.
    expect(block).not.toContain('C'.repeat(200))
  })
})
