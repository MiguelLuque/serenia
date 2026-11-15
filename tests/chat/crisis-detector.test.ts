import { describe, it, expect } from 'vitest'
import { classifyCrisisSignal, classifySafetyClarificationReply, detectCrisis } from '@/lib/shared/chat/crisis-detector'

describe('detectCrisis — positive cases', () => {
  it('detects "suicidio" stem', () => {
    const result = detectCrisis('Tengo pensamientos de suicidio')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('suicid'))).toBe(true)
  })

  it('detects "suicidarme" variant', () => {
    const result = detectCrisis('Estoy pensando en suicidarme')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('suicid'))).toBe(true)
  })

  it('detects "hacerme daño"', () => {
    const result = detectCrisis('a veces quiero hacerme daño')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('dano'))).toBe(true)
  })

  it('detects "autolesion" without tilde (accent-insensitive)', () => {
    // Input lacks accent — normalization should still match
    const result = detectCrisis('Tengo tendencias a la autolesion')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('autolesi'))).toBe(true)
  })

  it('detects "autolesión" with tilde', () => {
    const result = detectCrisis('sufro autolesión frecuente')
    expect(result.detected).toBe(true)
  })

  it('detects "no quiero vivir"', () => {
    const result = detectCrisis('Ya no quiero vivir')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('vivir'))).toBe(true)
  })

  it('detects "quitarme la vida"', () => {
    const result = detectCrisis('Pienso en quitarme la vida')
    expect(result.detected).toBe(true)
  })

  it('detects "matarme"', () => {
    const result = detectCrisis('quiero matarme')
    expect(result.detected).toBe(true)
  })

  it('detects "acabar con todo"', () => {
    const result = detectCrisis('Solo quiero acabar con todo')
    expect(result.detected).toBe(true)
  })

  it('detects "desaparecer para siempre"', () => {
    const result = detectCrisis('Quisiera desaparecer para siempre')
    expect(result.detected).toBe(true)
  })

  it('detects "tirarme desde"', () => {
    const result = detectCrisis('He pensado en tirarme desde el puente')
    expect(result.detected).toBe(true)
  })

  it('detects "mejor no estar"', () => {
    const result = detectCrisis('A veces siento que sería mejor no estar')
    expect(result.detected).toBe(true)
  })

  it('detects "cortarme"', () => {
    const result = detectCrisis('Quiero cortarme las venas')
    expect(result.detected).toBe(true)
  })
})

describe('detectCrisis — negative cases', () => {
  it('returns not detected for everyday stress text', () => {
    const result = detectCrisis('Tengo mucho trabajo y estoy cansado')
    expect(result.detected).toBe(false)
    expect(result.matchedTerms).toHaveLength(0)
  })

  it('returns not detected for empty string', () => {
    const result = detectCrisis('')
    expect(result.detected).toBe(false)
    expect(result.matchedTerms).toHaveLength(0)
  })

  it('returns not detected for unrelated sentence', () => {
    const result = detectCrisis('Hoy fue un día agradable, salí a pasear y me sentí bien.')
    expect(result.detected).toBe(false)
  })
})

describe('detectCrisis — known trade-offs', () => {
  // KNOWN FALSE POSITIVE: the permissive stem-match on "suicid" will also
  // match movie/band titles like "Suicide Squad". This is intentional —
  // for a safety guardrail, false positives are safer than false negatives.
  // The ASQ screener in Plan 4 is the real clinical gate.
  it('EXPECTED false positive: "Suicide Squad" movie title matches suicid stem', () => {
    const result = detectCrisis("La película se llama 'Suicide Squad'")
    // This IS detected — document it as expected behavior, not a bug.
    expect(result.detected).toBe(true)
  })
})

describe('classifyCrisisSignal — conversation routing', () => {
  it.each([
    'La película se llama Suicide Squad',
    'En clase estudiamos la prevención del suicidio',
    'Mi amigo dijo "quiero matarme"',
    'Mi hermana se autolesionó el año pasado',
    'No tengo pensamientos de suicidio',
    'Hace años pensé en suicidarme',
  ])('keeps contextual mention ordinary: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('contextual')
  })

  it.each([
    ['Estoy pensando en suicidarme ahora', 'suicidal_ideation'],
    ['Quiero hacerme daño ahora', 'self_harm'],
  ] as const)('routes direct current personal disclosure: %s', (text, riskType) => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType })
  })

  it('does not let context mask a separate current personal disclosure', () => {
    expect(classifyCrisisSignal('Mi amigo dijo que quiere matarse, y yo estoy pensando en suicidarme ahora.').disposition).toBe('explicit_current')
  })

  it('does not let a denial mask a contradictory current statement', () => {
    expect(classifyCrisisSignal('No quiero hacerme daño, pero ahora estoy pensando en cortarme.').disposition).toBe('explicit_current')
  })

  it('marks uncertain first-person cues ambiguous', () => {
    expect(classifyCrisisSignal('A veces pienso en desaparecer para siempre').disposition).toBe('ambiguous')
  })

  it('keeps a topic clause contextual without hiding personal current disclosure in another clause', () => {
    expect(classifyCrisisSignal('Hoy tengo clase sobre suicidio').disposition).toBe('contextual')
    expect(classifyCrisisSignal('Mi amigo habló de suicidio y yo estoy pensando en suicidarme').disposition).toBe('explicit_current')
  })

  it.each(['me corto ahora', 'me estoy cortando'])('recognizes current first-person cutting: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType: 'self_harm' })
  })

  it('does not infer intentionality from a general statement of having been hurt', () => {
    expect(classifyCrisisSignal('me hice daño hoy').disposition).toBe('ambiguous')
  })

  it.each(['No puedo dejar de pensar en suicidarme', 'No sé si quiero suicidarme'])('treats conflicted suicidal thoughts as ambiguous: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('ambiguous')
  })

  it('treats a clear denial as contextual', () => {
    expect(classifyCrisisSignal('No quiero suicidarme').disposition).toBe('contextual')
  })

  it('returns the personal current topic when another clause is contextual', () => {
    expect(classifyCrisisSignal('Quiero hacerme daño ahora; hoy vimos suicidio en clase')).toEqual({
      disposition: 'explicit_current', riskType: 'self_harm',
    })
  })

  it.each([
    'Quiero cortarme el pelo',
    'Me corto el pelo',
    'Me corto las uñas',
  ])('does not route ordinary grooming as safety signal: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'none', riskType: null })
  })

  it.each(['Me estoy cortando el pelo', 'Me estoy cortando las uñas'])('does not route ongoing grooming as current self-harm: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'none', riskType: null })
  })

  it('uses the ambiguous clause topic when earlier context mentioned another topic', () => {
    expect(classifyCrisisSignal('Mi hermano habló de suicidio y no sé si autolesionarme')).toEqual({
      disposition: 'ambiguous', riskType: 'self_harm',
    })
  })

  it('treats not wanting to live as ambiguous rather than a clear denial', () => {
    expect(classifyCrisisSignal('No quiero vivir')).toEqual({
      disposition: 'ambiguous', riskType: 'suicidal_ideation',
    })
  })

  it.each(['No quiero suicidarme', 'No estoy pensando en suicidarme'])('retains unequivocal denial: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('contextual')
  })

  it.each(['No quiero dejar de pensar en suicidarme', 'No quiero dejar de autolesionarme'])('keeps risk when negation scopes over stopping the thought: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('ambiguous')
  })

  it.each(['No voy a suicidarme', 'No voy a autolesionarme'])('treats a clear future denial as contextual: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('contextual')
  })

  it('carries shared querer scope into the next coordinated clause', () => {
    expect(classifyCrisisSignal('Quiero cortarme el pelo y quitarme la vida')).toEqual({
      disposition: 'explicit_current', riskType: 'suicidal_ideation',
    })
  })

  it.each([
    'No quiero cortarme el pelo y quitarme la vida',
    'No quiero cortarme el pelo y matarme',
  ])('does not propagate positive intent from a negated coordination: %s', text => {
    expect(classifyCrisisSignal(text).disposition).not.toBe('explicit_current')
  })

  it.each(['No voy a dejar de pensar en suicidarme', 'No voy a dejar de autolesionarme'])('treats negation over stopping as ambiguous: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('ambiguous')
  })

  it.each(['Quiero desaparecer para siempre', 'Quiero acabar con todo'])('keeps broad expressions ambiguous without a direct current signal: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('ambiguous')
  })

  it('propagates a positive querer only across clear y coordination', () => {
    for (const text of ['Quiero cortarme el pelo y quitarme la vida', 'Quiero cortarme el pelo y matarme']) {
      expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType: 'suicidal_ideation' })
    }
  })

  it('does not propagate querer across punctuation', () => {
    expect(classifyCrisisSignal('Quiero cortarme el pelo; suicidarme es un tema complejo').disposition).not.toBe('explicit_current')
  })

  it.each(['Estoy pensando en suicidarme ahora', 'Quiero hacerme daño ahora', 'quiero matarme', 'Quiero cortarme las venas'])('retains accepted direct personal signals: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('explicit_current')
  })

  it.each(['Hoy quiero desaparecer para siempre', 'Ahora quiero acabar con todo'])('does not let temporal words elevate a broad expression: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'ambiguous', riskType: 'suicidal_ideation' })
  })

  it.each([
    ['Tengo un plan para quitarme la vida', 'suicidal_ideation'],
    ['Voy a suicidarme esta noche', 'suicidal_ideation'],
    ['Voy a cortarme ahora', 'self_harm'],
    ['Me estoy haciendo daño', 'self_harm'],
    ['Me estoy autolesionando', 'self_harm'],
  ] as const)('recognizes explicit intent, plan, or behavior: %s', (text, riskType) => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType })
  })

  it.each([
    'No me estoy haciendo daño',
    'No me estoy autolesionando',
    'No me estoy cortando',
    'No me corto ahora',
    'No me quiero suicidar',
    'No me voy a suicidar',
  ])('does not treat a direct negation as explicit current: %s', text => {
    expect(classifyCrisisSignal(text).disposition).not.toBe('explicit_current')
  })

  it.each([
    ['Me quiero suicidar', 'suicidal_ideation'],
    ['Me voy a suicidar', 'suicidal_ideation'],
    ['Voy a quitarme la vida', 'suicidal_ideation'],
    ['Voy a hacerme daño esta noche', 'self_harm'],
    ['Tengo un plan para hacerme daño', 'self_harm'],
    ['Tengo un plan para cortarme', 'self_harm'],
  ] as const)('recognizes explicit personal intent or plan: %s', (text, riskType) => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType })
  })

  it('lets a positive clause retain priority after a separate direct denial', () => {
    expect(classifyCrisisSignal('No me quiero suicidar, pero me voy a suicidar')).toEqual({
      disposition: 'explicit_current', riskType: 'suicidal_ideation',
    })
  })

  it.each(['No dejo de pensar en suicidarme', 'No me atrevo a suicidarme'])('keeps non-denial negation ambiguous: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('ambiguous')
  })

  it('does not treat "no solo quiero" as a clear denial', () => {
    expect(classifyCrisisSignal('No solo quiero suicidarme').disposition).toBe('explicit_current')
  })

  it('does not treat a general wish to talk about suicide as direct intent', () => {
    expect(classifyCrisisSignal('No solo quiero hablar de suicidio').disposition).toBe('contextual')
  })

  it.each(['Estoy pensando en suicidarme al hablar de suicidio', 'Estoy pensando en suicidarme en clase mientras hablamos de suicidio'])('does not let topic context hide personal intent: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType: 'suicidal_ideation' })
  })

  it('keeps a quoted third-party statement contextual', () => {
    expect(classifyCrisisSignal('Mi amigo dijo "quiero matarme"')).toEqual({
      disposition: 'contextual', riskType: 'suicidal_ideation',
    })
  })

  it.each([
    ['Estoy pensando en hacerme daño', 'self_harm'],
    ['Voy a autolesionarme', 'self_harm'],
    ['Tengo un plan para autolesionarme', 'self_harm'],
  ] as const)('recognizes direct self-harm intent: %s', (text, riskType) => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType })
  })

  it.each(['Quiero hacerme daño y matarme', 'Quiero matarme y hacerme daño'])('prioritizes explicit suicide topic across mixed direct signals: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType: 'suicidal_ideation' })
  })

  it.each(['Nunca me voy a suicidar', 'Jamás quiero autolesionarme'])('recognizes scoped categorical denial: %s', text => {
    expect(classifyCrisisSignal(text).disposition).toBe('contextual')
  })

  it('leaves uncertain negation ambiguous', () => {
    expect(classifyCrisisSignal('No creo que quiera suicidarme').disposition).toBe('ambiguous')
  })

  it.each([
    'Estoy pensando en hacerme daño o suicidarme',
    'Estoy pensando en suicidarme o hacerme daño',
  ])('prefers suicidal ideation when a single clause contains both topics: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType: 'suicidal_ideation' })
  })

  it.each(['Quiero suicidarme con mi amigo', 'Mi amigo está conmigo, quiero suicidarme'])('does not let a companion mention suppress personal intent: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'explicit_current', riskType: 'suicidal_ideation' })
  })

  it('keeps a direct third-party quote contextual', () => {
    expect(classifyCrisisSignal('Mi amigo dijo "quiero matarme"').disposition).toBe('contextual')
  })

  it('does not resolve a third-party attribution about the user as explicit or contextual', () => {
    expect(classifyCrisisSignal('Mi amigo cree que quiero suicidarme').disposition).toBe('ambiguous')
  })

  it.each(['Mi amigo me dijo "quiero matarme"', 'Mi madre dijo "quiero suicidarme"'])('keeps quoted third-party intent contextual: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'contextual', riskType: 'suicidal_ideation' })
  })

  it.each([
    'Un amigo me dijo "quiero matarme"',
    'Mi pareja me contó "quiero suicidarme"',
    'Mi compañero me comentó "quiero matarme"',
  ])('recognizes reported speech from additional third parties: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'contextual', riskType: 'suicidal_ideation' })
  })

  it.each([
    '«Mi amigo me dijo: “quiero matarme”»',
    '“Mi madre dijo: ‘quiero suicidarme’”',
  ])('keeps punctuated typographic third-party quotes contextual: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'contextual', riskType: 'suicidal_ideation' })
  })

  it('still routes a direct personal clause after an attributed quote', () => {
    expect(classifyCrisisSignal('«Mi amigo me dijo: “quiero matarme”», y yo quiero suicidarme')).toEqual({
      disposition: 'explicit_current', riskType: 'suicidal_ideation',
    })
  })

  it('does not let attribution about someone else suppress the speaker direct intent', () => {
    expect(classifyCrisisSignal('Quiero suicidarme porque mi amigo cree que exagero')).toEqual({
      disposition: 'explicit_current', riskType: 'suicidal_ideation',
    })
  })

  it('does not propagate a quoted speaker intention into a coordinated topic', () => {
    expect(classifyCrisisSignal('«Mi amigo me dijo: “quiero matarme y autolesionarme”»').disposition).toBe('contextual')
  })

  it('does not propagate intention from a quote into the next clause', () => {
    expect(classifyCrisisSignal('Mi amigo me dijo: “quiero matarme” y autolesionarme me da miedo').disposition).not.toBe('explicit_current')
  })

  it('retains speaker intention across coordinated self-harm topics', () => {
    expect(classifyCrisisSignal('Quiero suicidarme y autolesionarme')).toEqual({
      disposition: 'explicit_current', riskType: 'suicidal_ideation',
    })
  })

  it.each(['«Quiero matarme», dijo mi amigo', '“Quiero suicidarme”, contó mi pareja'])('links a following attribution to the preceding quote: %s', text => {
    expect(classifyCrisisSignal(text)).toEqual({ disposition: 'contextual', riskType: 'suicidal_ideation' })
  })

  it('keeps later direct personal intent after a postposed quote attribution', () => {
    expect(classifyCrisisSignal('«Quiero matarme», dijo mi amigo, y yo también quiero suicidarme')).toEqual({
      disposition: 'explicit_current', riskType: 'suicidal_ideation',
    })
  })
})

describe('classifySafetyClarificationReply', () => {
  it.each([['sí', 'affirmative'], ['No', 'negative'], ['no lo sé', 'unclear'], ['cambiemos de tema', 'skip']] as const)(
    'classifies %s as %s', (text, category) => expect(classifySafetyClarificationReply(text)).toBe(category),
  )
  it.each(['maybe', 'sí y no', 'sí, pero no estoy seguro'])('leaves unsupported or compound reply unclear: %s', text => {
    expect(classifySafetyClarificationReply(text)).toBe('unclear')
  })
  it('recognizes a negated safety clarification as negative', () => {
    expect(classifySafetyClarificationReply('No, no estoy pensando en eso')).toBe('negative')
  })
})
