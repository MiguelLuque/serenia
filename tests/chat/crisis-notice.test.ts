import { describe, it, expect } from 'vitest'
import { buildCrisisNotice } from '@/lib/shared/chat/crisis-notice'
import type { SafetyState } from '@/lib/server/chat/safety-state'

// =============================================================================
// Plan 7 T3a v2 + Plan 8 Fase 2 — `buildCrisisNotice` traduce un `SafetyState`
// (+ resultado del detector léxico) a la variante de notice apropiada.
// Función pura. Variantes ASQ renombradas a C-SSRS con granularidad de 5 bandas.
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

describe('buildCrisisNotice — cssrs_negative (caso del bug del smoke)', () => {
  const baseState: SafetyState = {
    kind: 'cssrs_negative',
    scoredAt: NOW,
  }

  it('sin crisis → variante negativo con anti-repregunta', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: noCrisis(),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS NEGATIVO YA APLICADO]')
    expect(out).toContain('6 preguntas')
    expect(out).toContain('NO repitas la pregunta textual de seguridad')
    expect(out).toContain('señal NUEVA Y específica')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('crisis con término ambiguo ("acabar con todo") → variante SIN RE-ESCALADA', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: crisisWith(['acabar con todo']),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS NEGATIVO YA APLICADO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('crisis con término ambiguo ("desaparecer para siempre") → variante SIN RE-ESCALADA', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: crisisWith(['desaparecer para siempre']),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS NEGATIVO YA APLICADO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('crisis con alta señal "suicid" → prepende RE-ESCALADA + variante negativo', () => {
    const out = buildCrisisNotice({
      safetyState: baseState,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS NEGATIVO YA APLICADO]')
    expect(out).toContain('suicid')
    // RE-ESCALADA debe ir ANTES de la variante negativo.
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

describe('buildCrisisNotice — cssrs_low_risk (ideación pasiva)', () => {
  const state: SafetyState = { kind: 'cssrs_low_risk', scoredAt: NOW }

  it('sin crisis → variante bajo riesgo (NO inyecta protocolo de crisis)', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS BAJO RIESGO]')
    expect(out).toContain('ideación pasiva')
    expect(out).toContain('NO actives protocolo de crisis')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('crisis con alta señal → RE-ESCALADA + variante bajo riesgo', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS BAJO RIESGO]')
  })

  it('crisis con término ambiguo → variante sin RE-ESCALADA', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['acabar con todo']),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS BAJO RIESGO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })
})

describe('buildCrisisNotice — cssrs_moderate_risk (ideación con método sin plan)', () => {
  const state: SafetyState = { kind: 'cssrs_moderate_risk', scoredAt: NOW }

  it('sin crisis → variante riesgo moderado (profundización, sin crisis aguda)', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO MODERADO]')
    expect(out).toContain('Refuerza activamente la red de apoyo')
    expect(out).toContain('NO cierres en crisis')
    expect(out).not.toContain('[RE-ESCALADA')
  })

  it('crisis con alta señal → RE-ESCALADA + variante riesgo moderado', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['matar(me|se)']),
    })
    expect(out).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO MODERADO]')
  })
})

describe('buildCrisisNotice — cssrs_high_risk (intención sin plan)', () => {
  const state: SafetyState = { kind: 'cssrs_high_risk', scoredAt: NOW }

  it('sin crisis → variante riesgo alto (Línea 024 + revisión clínica mismo día)', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO ALTO]')
    expect(out).toContain('Línea 024')
    expect(out).toContain('REVISIÓN CLÍNICA EL MISMO DÍA')
  })

  it('crisis con alta señal NO añade RE-ESCALADA (banda alta ya activa)', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[CONTEXTO DE SEGURIDAD — C-SSRS RIESGO ALTO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })
})

describe('buildCrisisNotice — cssrs_acute_risk (lifetime)', () => {
  const state: SafetyState = {
    kind: 'cssrs_acute_risk',
    scoredAt: NOW,
    flags: [{ reason: 'suicidality', itemOrder: 6 }],
    behaviorRecent: false,
  }

  it('sin crisis → variante riesgo agudo (imperativa) lifetime', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[RESULTADO C-SSRS — RIESGO AGUDO]')
    expect(out).toContain('Activa el protocolo de crisis AHORA')
    expect(out).not.toContain('CONDUCTA RECIENTE')
  })

  it('crisis con alta señal NO degrada acute (no se prepende RE-ESCALADA)', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[RESULTADO C-SSRS — RIESGO AGUDO]')
    expect(out).not.toContain('[RE-ESCALADA')
  })
})

describe('buildCrisisNotice — cssrs_acute_risk + behaviorRecent (override 6b)', () => {
  const state: SafetyState = {
    kind: 'cssrs_acute_risk',
    scoredAt: NOW,
    flags: [{ reason: 'acute_risk', itemOrder: 7 }],
    behaviorRecent: true,
  }

  it('sin crisis → variante CONDUCTA RECIENTE (cierre inmediato + alerta URGENTE)', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[RESULTADO C-SSRS — RIESGO AGUDO + CONDUCTA RECIENTE]')
    expect(out).toContain('últimos 3 meses')
    expect(out).toContain('alerta URGENTE')
    expect(out).toContain('close_session_crisis')
  })

  it('crisis con alta señal NO degrada (acute reciente ya es máximo)', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[RESULTADO C-SSRS — RIESGO AGUDO + CONDUCTA RECIENTE]')
    expect(out).not.toContain('[RE-ESCALADA')
  })
})

describe('buildCrisisNotice — cssrs_pending', () => {
  const state: SafetyState = {
    kind: 'cssrs_pending',
    proposedAt: NOW,
  }

  it('sin crisis → variante pending', () => {
    const out = buildCrisisNotice({ safetyState: state, crisis: noCrisis() })
    expect(out).toContain('[C-SSRS PROPUESTO PENDIENTE]')
    expect(out).toContain('NO propongas otro cuestionario')
    expect(out).toContain('NO hagas la pregunta textual de seguridad')
    expect(out).toContain('Si rechaza')
  })

  it('crisis con alta señal → variante pending sigue prevaleciendo (sin RE-ESCALADA)', () => {
    const out = buildCrisisNotice({
      safetyState: state,
      crisis: crisisWith(['suicid']),
    })
    expect(out).toContain('[C-SSRS PROPUESTO PENDIENTE]')
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
    kind: 'cssrs_negative',
    scoredAt: NOW,
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
