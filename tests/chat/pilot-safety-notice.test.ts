import { describe, expect, it } from 'vitest'
import { detectCrisis } from '@/lib/shared/chat/crisis-detector'
import { buildPilotSafetyNotice } from '@/lib/shared/chat/pilot-safety-notice'
import type { SafetyState } from '@/lib/shared/chat/safety-state'

const SCORED_AT = '2026-10-25T09:00:00.000Z'
const noCrisis = { detected: false, matchedTerms: [] }

it.each([
  { kind: 'cssrs_pending', proposedAt: SCORED_AT },
  { kind: 'cssrs_negative', scoredAt: SCORED_AT },
  { kind: 'cssrs_low_risk', scoredAt: SCORED_AT },
  { kind: 'cssrs_moderate_risk', scoredAt: SCORED_AT },
  { kind: 'textual_check_completed', lastAssistantCheckAt: SCORED_AT, lastPatientResponseAt: SCORED_AT },
] satisfies SafetyState[])('does not let prior %j veto timely attention to a new founded concern', safetyState => {
  const notice = buildPilotSafetyNotice({ crisis: detectCrisis('Estoy pensando en hacerme daño ahora y necesito ayuda.'), safetyState })
  expect(notice).toContain('sin esperar')
  expect(notice).not.toContain('NO hagas la pregunta textual de seguridad')
  expect(notice).not.toContain('NO ofrezcas Línea 024')
  expect(notice).not.toContain('descartó el plano agudo')
  expect(notice).toContain('no veta')
})

describe('pilot safety notice — lexical observation and repair', () => {
  it('does not invent a safety observation when there is no lexical match or prior assessment', () => {
    expect(buildPilotSafetyNotice({ crisis: noCrisis, safetyState: { kind: 'never_assessed' } })).toBe('')
  })

  it.each([
    ['an everyday object', 'Quiero cortarme el pelo.'],
    ['a correction repeating the detected term', 'No, me refiero a cortarme el pelo.'],
    ['another person and a past event', 'Mi hermano habló de suicidio hace años.'],
  ])('keeps %s available for contextual interpretation instead of categorical re-escalation', (_kind, text) => {
    const notice = buildPilotSafetyNotice({
      crisis: detectCrisis(text),
      safetyState: { kind: 'cssrs_negative', scoredAt: SCORED_AT },
    })

    expect(notice).toMatch(/observación léxica sin confirmar/i)
    expect(notice).toMatch(/historial/i)
    expect(notice).toMatch(/sujeto/i)
    expect(notice).toMatch(/temporalidad/i)
    expect(notice).toMatch(/correcci[oó]n/i)
    expect(notice).toMatch(/retoma.*(?:demanda|tema|agenda)/i)
    expect(notice).not.toContain('[RE-ESCALADA')
    expect(notice).not.toContain('categóricamente distinta')
  })

  it('does not treat a denial as proof of safety and still prioritizes a founded new signal', () => {
    const notice = buildPilotSafetyNotice({
      crisis: detectCrisis('No tengo pensamientos de suicidio; estoy a salvo.'),
      safetyState: { kind: 'never_assessed' },
    })

    expect(notice).toMatch(/negación.*no garantiza.*ausencia de riesgo/i)
    expect(notice).toMatch(/señal NUEVA Y fundada/i)
    expect(notice).toMatch(/prioriza.*seguridad/i)
    expect(notice).toContain('Línea 024')
    expect(notice).toContain('112')
    expect(notice).not.toContain('Lo que cuentas necesita apoyo inmediato')
  })

  it.each([
    [{ kind: 'cssrs_negative', scoredAt: SCORED_AT }, 'C-SSRS NEGATIVO YA APLICADO'],
    [{ kind: 'cssrs_low_risk', scoredAt: SCORED_AT }, 'C-SSRS BAJO RIESGO'],
    [{ kind: 'cssrs_moderate_risk', scoredAt: SCORED_AT }, 'C-SSRS RIESGO MODERADO'],
  ] satisfies Array<[SafetyState, string]>)('retains the structured non-acute state %j without re-escalating a label alone', (safetyState, label) => {
    const notice = buildPilotSafetyNotice({ crisis: detectCrisis('La guía habla de prevenir el suicidio.'), safetyState })

    expect(notice).toContain(label)
    expect(notice).toMatch(/instrucciones del estado.*prevalecen/i)
    expect(notice).not.toContain('[RE-ESCALADA')
  })

  it('retains the pending-screen limits rather than adding a parallel safety interview', () => {
    const notice = buildPilotSafetyNotice({
      crisis: detectCrisis('Quiero cortarme el pelo.'),
      safetyState: { kind: 'cssrs_pending', proposedAt: SCORED_AT },
    })

    expect(notice).toContain('C-SSRS PROPUESTO PENDIENTE')
    expect(notice).toContain('NO propongas otro cuestionario')
    expect(notice).toContain('no veta')
    expect(notice).toContain('sin esperar')
  })
})

describe('pilot safety notice — structured high and acute requirements', () => {
  it.each([noCrisis, detectCrisis('No, me refiero a cortarme el pelo.')])('retains high-risk actions independently of a lexical correction: %j', crisis => {
    const notice = buildPilotSafetyNotice({ crisis, safetyState: { kind: 'cssrs_high_risk', scoredAt: SCORED_AT } })

    expect(notice).toContain('C-SSRS RIESGO ALTO')
    expect(notice).toContain('Ofrece la Línea 024 textualmente AHORA')
    expect(notice).toContain('Solicita revisión clínica prioritaria')
    expect(notice).toContain('NO propongas otros cuestionarios ni sigas la exploración normal')
  })

  it('retains acute lifetime requirements without inventing the recent-behavior override', () => {
    const notice = buildPilotSafetyNotice({
      crisis: detectCrisis('La guía habla de prevenir el suicidio.'),
      safetyState: { kind: 'cssrs_acute_risk', scoredAt: SCORED_AT, flags: [{ reason: 'suicidality', itemOrder: 6 }], behaviorRecent: false },
    })

    expect(notice).toContain('[RESULTADO C-SSRS — RIESGO AGUDO]')
    expect(notice).toContain('Activa el protocolo de crisis AHORA')
    expect(notice).toContain('close_session_crisis')
    expect(notice).toContain('No pidas aceptación del paciente para el cierre por crisis')
    expect(notice).not.toContain('[RESULTADO C-SSRS — RIESGO AGUDO + CONDUCTA RECIENTE]')
  })

  it('preserves immediate closure for the structured recent-behavior override even with a correction', () => {
    const notice = buildPilotSafetyNotice({
      crisis: detectCrisis('No, me refiero a cortarme el pelo.'),
      safetyState: { kind: 'cssrs_acute_risk', scoredAt: SCORED_AT, flags: [{ reason: 'acute_risk', itemOrder: 7 }], behaviorRecent: true },
    })

    expect(notice).toContain('[RESULTADO C-SSRS — RIESGO AGUDO + CONDUCTA RECIENTE]')
    expect(notice).toContain('Llama a close_session_crisis inmediatamente')
    expect(notice).toContain('NO continúes la exploración terapéutica')
    expect(notice).toContain('No pidas aceptación del paciente para el cierre por crisis')
    expect(notice).toMatch(/confirma el cierre solo si la herramienta/i)
  })

  it.each([
    { kind: 'cssrs_negative', scoredAt: SCORED_AT },
    { kind: 'cssrs_low_risk', scoredAt: SCORED_AT },
    { kind: 'cssrs_moderate_risk', scoredAt: SCORED_AT },
    { kind: 'cssrs_high_risk', scoredAt: SCORED_AT },
    { kind: 'cssrs_acute_risk', scoredAt: SCORED_AT, flags: [], behaviorRecent: false },
    { kind: 'cssrs_acute_risk', scoredAt: SCORED_AT, flags: [{ reason: 'acute_risk', itemOrder: 7 }], behaviorRecent: true },
  ] satisfies SafetyState[])('does not promise unverified operational outcomes for %j', safetyState => {
    const notice = buildPilotSafetyNotice({ crisis: noCrisis, safetyState })

    expect(notice).not.toMatch(/el psicólogo verá|recibe alerta|la sesión se cierra en este turno|EL MISMO DÍA|revisión clínica inmediata/i)
    expect(notice).toMatch(/no afirmes.*(?:alerta|revisión|cerrado)/i)
  })

  it('does not mutate lexical evidence or the supplied structured state', () => {
    const crisis = Object.freeze({ detected: true, matchedTerms: Object.freeze(['suicid']) as unknown as string[] })
    const safetyState = Object.freeze({ kind: 'cssrs_acute_risk' as const, scoredAt: SCORED_AT, flags: Object.freeze([{ reason: 'acute_risk', itemOrder: 7 }]) as unknown as unknown[], behaviorRecent: true })
    const before = JSON.stringify({ crisis, safetyState })

    buildPilotSafetyNotice({ crisis, safetyState })

    expect(JSON.stringify({ crisis, safetyState })).toBe(before)
  })
})
