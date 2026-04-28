import { describe, it, expect } from 'vitest'
import { buildCrisisNotice } from '@/lib/chat/crisis-notice'
import type { SafetyState } from '@/lib/chat/safety-state'

// =============================================================================
// Plan 7 T3a v2 — `buildCrisisNotice` traduce un `SafetyState` (+ resultado del
// detector léxico) a la variante de notice apropiada. Función pura.
// =============================================================================

const NOW = '2026-04-28T12:00:00Z'

function noCrisis() {
  return { detected: false, matchedTerms: [] as string[] }
}

function crisisWith(terms: string[]) {
  return { detected: true, matchedTerms: terms }
}

describe('buildCrisisNotice — never_assessed', () => {
  it('sin crisis → string vacío', () => {
    const out = buildCrisisNotice({
      safetyState: { kind: 'never_assessed' },
      crisis: noCrisis(),
    })
    expect(out).toBe('')
  })

  it('con crisis → variante "primera vez" no imperativa', () => {
    const out = buildCrisisNotice({
      safetyState: { kind: 'never_assessed' },
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[AVISO DE SEGURIDAD — POSIBLE SEÑAL]')
    expect(out).toContain('Lee el contexto')
    expect(out).toContain('suicid')
    // No debe llevar el override RE-ESCALADA (no había cribado previo).
    expect(out).not.toContain('[RE-ESCALADA')
  })
})

describe('buildCrisisNotice — asq_negative (caso del bug del smoke)', () => {
  const baseState: SafetyState = {
    kind: 'asq_negative',
    scoredAt: NOW,
    coversAcuteIdeation: true,
  }

  it('sin crisis → variante 3 con cláusula del item 5', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: noCrisis(),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    expect(out).toContain('item 5')
    expect(out).toContain('¿estás pensando en suicidarte ahora mismo?')
    expect(out).toContain('NO repitas la pregunta textual de seguridad')
    expect(out).toContain('señal NUEVA Y específica')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('coversAcuteIdeation=false → variante 3 sin cláusula del item 5', () => {
    const out = buildCrisisNotice({
      safetyState: { ...baseState, coversAcuteIdeation: false },
      crisis: noCrisis(),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    expect(out).not.toContain('item 5')
  })

  it('crisis con término ambiguo ("acabar con todo") → variante 3 SIN RE-ESCALADA', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: crisisWith(['acabar con todo']),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('crisis con término ambiguo ("desaparecer para siempre") → variante 3 SIN RE-ESCALADA', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: crisisWith(['desaparecer para siempre']),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('crisis con alta señal "suicid" → prepende RE-ESCALADA + variante 3', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    expect(out).toContain('suicid')
    // RE-ESCALADA debe ir ANTES de la variante 3.
    const idxReEsc = out.indexOf('[RE-ESCALADA')
    const idxBase = out.indexOf('[CONTEXTO DE SEGURIDAD')
    expect(idxReEsc).toBeLessThan(idxBase)
  })

  it('crisis con alta señal "cortarme" → prepende RE-ESCALADA', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: crisisWith(['cortarme']),
    })
    expect(out).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
  })

  it('crisis con alta señal "tirarme (desde|por)" → prepende RE-ESCALADA', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: crisisWith(['tirarme (desde|por)']),
    })
    expect(out).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
  })
})

describe('buildCrisisNotice — asq_positive_non_acute', () => {
  const state: SafetyState = {
    kind: 'asq_positive_non_acute',
    scoredAt: NOW,
    flags: [{ reason: 'suicidality', itemOrder: 1 }],
  }

  it('sin crisis → variante positivo no agudo', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — ASQ POSITIVO NO AGUDO]')
    expect(out).toContain('seguimiento clínico')
    expect(out).toContain('NO repitas la pregunta textual de seguridad')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('crisis con alta señal "matar(me|se)" → RE-ESCALADA + variante positivo', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['matar(me|se)']),
    })
    expect(out).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — ASQ POSITIVO NO AGUDO]')
  })
})

describe('buildCrisisNotice — asq_acute_risk', () => {
  const state: SafetyState = {
    kind: 'asq_acute_risk',
    scoredAt: NOW,
    flags: [{ reason: 'acute_risk', itemOrder: 5 }],
  }

  it('sin crisis → variante riesgo agudo (imperativa)', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[RESULTADO DE CUESTIONARIO — ASQ — RIESGO AGUDO]')
    expect(out).toContain('Activa el protocolo de crisis AHORA')
  })

  it('crisis con alta señal NO degrada acute (no se prepende RE-ESCALADA)', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[RESULTADO DE CUESTIONARIO — ASQ — RIESGO AGUDO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })
})

describe('buildCrisisNotice — asq_proposed_pending', () => {
  const state: SafetyState = {
    kind: 'asq_proposed_pending',
    proposedAt: NOW,
  }

  it('sin crisis → variante pending', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[ASQ PROPUESTO PENDIENTE]')
    expect(out).toContain('NO propongas otro cuestionario')
    expect(out).toContain('NO hagas la pregunta textual de seguridad')
    expect(out).toContain('Si rechaza')
  })

  it('crisis con alta señal → variante pending sigue prevaleciendo (sin RE-ESCALADA)', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[ASQ PROPUESTO PENDIENTE]')
    expect(out).not.toContain('[RE-ESCALADA')
  })
})

describe('buildCrisisNotice — textual_check_completed', () => {
  const state: SafetyState = {
    kind: 'textual_check_completed',
    lastAssistantCheckAt: NOW,
    lastPatientResponseAt: NOW,
  }

  it('sin crisis → variante check textual completado', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — CHECK TEXTUAL YA REALIZADO]')
    expect(out).toContain('NO vuelvas a preguntar por seguridad')
  })

  it('crisis con alta señal → RE-ESCALADA + variante check textual', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['quitarme/quitarse la vida']),
    })
    expect(out).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — CHECK TEXTUAL YA REALIZADO]')
  })

  it('crisis con término ambiguo → variante sin RE-ESCALADA', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['no quiero/merezco vivir / mejor no estar']),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — CHECK TEXTUAL YA REALIZADO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })
})

describe('buildCrisisNotice — alta señal vs ambiguo (subgrupo)', () => {
  const negativeState: SafetyState = {
    kind: 'asq_negative',
    scoredAt: NOW,
    coversAcuteIdeation: true,
  }

  const HIGH_SIGNAL = [
    'suicid',
    'quitarme/quitarse la vida',
    'matar(me|se)',
    'hacerme dano',
    'autolesi(on|onarme)',
    'cortarme',
    'tirarme (desde|por)',
  ]
  const AMBIGUOUS = [
    'no quiero/merezco vivir / mejor no estar',
    'acabar con todo',
    'desaparecer para siempre',
  ]

  it.each(HIGH_SIGNAL)('alta señal "%s" → RE-ESCALADA', (label) => {
    const out = buildCrisisNotice({
      safetyState: negativeState,
      crisis: crisisWith([label]),
    })
    expect(out).toContain('[RE-ESCALADA')
  })

  it.each(AMBIGUOUS)('ambiguo "%s" → SIN RE-ESCALADA', (label) => {
    const out = buildCrisisNotice({
      safetyState: negativeState,
      crisis: crisisWith([label]),
    })
    expect(out).not.toContain('[RE-ESCALADA')
  })
})
