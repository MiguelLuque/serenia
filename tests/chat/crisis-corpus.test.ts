import { describe, it, expect } from 'vitest'
import { classifyCrisisSignal, classifySafetyClarificationReply } from '@/lib/shared/chat/crisis-detector'

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

  // Second pass (2026-11-23): clitic-first verbs, chat spelling, acts already
  // done, and everyday wording that used to interrupt the conversation.
  it.each([
    'me voy a quitar la vida', 'me quiero quitar la vida', 'me voy a tirar por la ventana',
    'me voy a tirar a las vías del tren', 'me voy a pegar un tiro', 'voy a saltar del balcón',
    'me he tomado todas las pastillas', 'me he tomado un bote de pastillas', 'me acabo de tomar 30 pastillas',
    'me kiero matar', 'me voy a cortar las venas', 'me quiero hacer daño', 'me voy a hacer daño',
  ])('routes clitic-first or completed acts to the fixed safety reply: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('explicit_current')
  })
  it.each([
    'kiero morirme', 'no kiero vivir', 'quiero morirmeee', 'me quito de en medio',
    'no tengo ganas de vivir', 'no vale la pena vivir', 'me gustaría morirme', 'ojalá me muera',
    'quiero dejar de existir', 'soy una carga para todos', 'tengo pensamientos de muerte',
    'me quiero cortar', 'me he vuelto a cortar', 'me hago cortes',
  ])('never leaves colloquial first-person risk unrouted: %s', text => {
    expect(['ambiguous', 'explicit_current']).toContain(classifyCrisisSignal(text).disposition)
  })
  it.each([
    'se me cortó la llamada', 'se me corto la llamada', 'mi novia me cortó', 'me cortó el rollo',
    'me corto cuando hablo en público', 'me corto yo el pelo', 'voy a cortarme la melena',
    'me quiero cortar el pelo', 'voy a colgarme la medalla', 'me voy a colgar la mochila',
    'voy a saltar al metro', 'me corté el dedo', 'me he cortado el dedo pelando patatas',
    'casi me mato con la moto', 'me mato trabajando', 'me hice daño en la espalda',
    'me he hecho daño en el tobillo', 'me lastimo la rodilla corriendo', 'quiero desaparecer unos días',
    'quiero acabar con todo el trabajo pendiente', 'intento no despertar al bebé',
    'es un suicidio profesional', 'pienso en la muerte de mi padre',
  ])('does not interrupt everyday wording (second pass): %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('none')
  })
  it('keeps real self-harm next to the everyday exclusions', () => {
    expect(classifyCrisisSignal('me corto los brazos cuando estoy mal').disposition).not.toBe('none')
    expect(classifyCrisisSignal('me hago daño en los brazos').disposition).not.toBe('none')
    expect(classifyCrisisSignal('quiero acabar con todo').disposition).not.toBe('none')
    expect(classifyCrisisSignal('quiero desaparecer').disposition).not.toBe('none')
  })
})

// Answers to the clarifying safety question. "negative" is the only category
// that ends the safety flow without showing resources, so anything short of a
// plain denial must stay out of it.
describe('safety clarification reply corpus', () => {
  it.each([
    'no, pero tengo un plan', 'no aunque tengo las pastillas preparadas', 'no, pero tengo una cuerda',
    'no pero ya tengo todo preparado', 'no pero sé cómo hacerlo', 'no, pero ganas no me faltan',
    'no, pero lo he pensado', 'no, pero ya lo he intentado antes', 'no. pero lo pienso mucho',
    'no, ya me he tomado las pastillas', 'no, ya lo he hecho', 'no, ya me he cortado',
    'no, voy a hacerlo esta noche', 'no, esta noche', 'no, lo haré mañana',
    'me quiero matar', 'quiero morirme', 'tengo un plan', 'creo que sí', 'pues sí', 'sip', 'siii',
  ])('shows resources when the answer affirms risk: %s', text => {
    expect(classifySafetyClarificationReply(text)).toBe('affirmative')
  })
  it.each([
    'no quiero vivir', 'no quiero seguir viviendo', 'no merezco vivir', 'no, solo quiero morirme',
    'no, pero me quiero morir', 'no, solo cortarme un poco', 'no, matarme no, solo hacerme daño',
    'no puedo más', 'no aguanto más', 'no dejo de pensarlo', 'no paro de pensarlo', 'no pienso en otra cosa',
    'no te voy a mentir, sí', 'no lo descarto', 'no me importaría morirme', 'no veo otra salida',
    'no es la primera vez', 'no estoy bien', 'no quiero contestar',
    'no ahora mismo', 'no exactamente', 'no del todo', 'no siempre', 'no, todavía no', 'no de momento',
    'no por ahora', 'no mucho', 'no creo', 'no, bueno, sí', 'no pero sí', 'hoy no',
  ])('never takes a hedged or risk-bearing "no" as a denial: %s', text => {
    expect(classifySafetyClarificationReply(text)).not.toBe('negative')
  })
  it.each([
    'no', 'No.', 'nop', 'nah', 'noo', 'para nada', 'qué va', 'k va', 'en absoluto', 'nunca', 'jamás',
    'claro que no', 'ni de coña', 'era broma', 'no, para nada', 'no gracias', 'no, estoy bien',
    'no, no estoy pensando en eso', 'no estoy pensando en eso', 'no quiero hacerme daño',
    'no pienso hacerme daño', 'no tengo intención de hacerme daño', 'no, pero gracias por preguntar',
    'no, pero estoy muy triste', 'no, solo estoy cansado',
  ])('accepts a plain denial: %s', text => {
    expect(classifySafetyClarificationReply(text)).toBe('negative')
  })
})

