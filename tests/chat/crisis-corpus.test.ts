import { describe, it, expect } from 'vitest'
import { classifyCrisisSignal } from '@/lib/shared/chat/crisis-detector'

// Regression corpus from the 2026-11-23 audit. Each list fixes the routing of
// a phrasing family: explicit → fixed resources reply and risk event;
// ambiguous → one clarifying safety question; none → ordinary conversation.
// Wording changes here are clinical decisions and need professional review.
const explicitSuicide = [
  'me quiero matar', 'me voy a matar', 'quiero matarme', 'voy a matarme',
  'quiero suicidarme', 'me quiero suicidar',
  'quiero acabar con mi vida', 'voy a acabar con mi vida', 'quiero terminar con mi vida',
  'quiero ahorcarme', 'me voy a colgar', 'quiero quitarme de en medio',
  'me voy a tomar todas las pastillas', 'voy a tomarme todas las pastillas',
  'voy a saltar de un puente', 'voy a tirarme por la ventana', 'voy a tirarme a las vías',
  'tengo un plan para matarme', 'I want to kill myself',
  'Me quiero matar, no aguanto más',
]

const ambiguousSuicide = [
  'quiero morir', 'me quiero morir', 'quiero morirme', 'quisiera morirme',
  'tengo ganas de morirme', 'ojalá estuviera muerto', 'ojalá me muriera',
  'ojala no despertar mañana', 'quiero dormirme y no despertar',
  'no quiero seguir viviendo', 'ya no quiero vivir', 'no quiero vivir',
  'no tiene sentido vivir', 'no le veo sentido a la vida',
  'estaría mejor muerta', 'todos estarían mejor sin mí',
  'quiero desaparecer', 'pienso en la muerte todo el tiempo',
  'he pensado en tomarme todas las pastillas',
  'no aguanto más, quiero terminar con todo',
  'he escrito una carta de despedida', 'si me deja me mato', 'vull morir',
]

const selfHarm = [
  'me he cortado esta mañana', 'ayer me corté', 'me quemo con cigarrillos',
  'a veces me hago daño', 'me he hecho daño otra vez', 'me corto los brazos cuando estoy mal',
]

const everyday = [
  'me muero de risa', 'me quiero morir de la vergüenza', 'me muero de ganas de verte',
  'estoy muerto de cansancio', 'me voy a matar a estudiar esta semana', 'me mato a trabajar',
  'mi abuela se va a morir', 'mi perro murió ayer', 'mi tía murió el año pasado',
  'quiero matar a mi jefe', 'voy a colgar la ropa', 'voy a colgar el teléfono',
  'tengo que tomar las pastillas de la tensión', 'voy a saltar a la piscina',
  'quiero terminar con esto del trabajo', 'no quiero seguir aquí en esta empresa',
  'me he cortado cocinando', 'me corté el pelo', 'me he cortado las uñas',
]

const denials = [
  'no me quiero morir', 'no quiero morir', 'no me voy a matar', 'nunca me he cortado',
  'no quiero acabar con mi vida', 'no tengo ganas de morirme',
]

describe('crisis routing corpus', () => {
  it.each(explicitSuicide)('routes explicit suicidal intent to the fixed safety reply: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType: 'suicidal_ideation' })
  })

  it.each(ambiguousSuicide)('asks the safety question for a death wish without stated intent: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'ambiguous', riskType: 'suicidal_ideation' })
  })

  it.each(selfHarm)('never leaves first-person self-harm unrouted: %s', text => {
    const result = classifyCrisisSignal(text)
    expect(result.riskType).toBe('self_harm')
    expect(['ambiguous', 'explicit_current']).toContain(result.disposition)
  })

  it.each(everyday)('does not interrupt everyday wording: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'none', riskType: null })
  })

  it.each(denials)('keeps a clear denial out of the safety interruption: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('contextual')
  })
})
