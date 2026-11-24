export interface CrisisDetection {
  detected: boolean
  matchedTerms: string[]
}

export type CrisisRiskType = 'suicidal_ideation' | 'self_harm' | 'crisis_other' | null
export type CrisisDisposition = 'none' | 'contextual' | 'ambiguous' | 'explicit_current'
export interface CrisisSignalClassification {
  disposition: CrisisDisposition
  riskType: CrisisRiskType
}
export type SafetyClarificationReply = 'affirmative' | 'negative' | 'unclear' | 'skip'

/**
 * High-risk phrase patterns for Spanish-language crisis detection.
 * Each entry is a { label, pattern } pair where `pattern` matches against
 * accent-normalized, lowercased input.
 *
 * Design intent: permissive (prefer false positives over false negatives).
 * This is a guardrail, NOT a clinical screener.
 */
const CRISIS_PATTERNS: { label: string; pattern: RegExp }[] = [
  // suicidio, suicida, suicidarme, suicidarse, etc. — stem match
  { label: 'suicid', pattern: /suicid/i },
  // quitarme/quitarse la vida
  { label: 'quitarme/quitarse la vida', pattern: /quitar(me|se)\s+la\s+vida/i },
  // matarme / matatarse / matarse
  { label: 'matar(me|se)', pattern: /matar(me|se)\b/i },
  // no quiero vivir / no merezco vivir / mejor no estar
  { label: 'no quiero/merezco vivir / mejor no estar', pattern: /no\s+(quiero|merezco)\s+vivir|mejor\s+no\s+estar/i },
  // hacerme daño / hacerme dano (sin tilde)
  { label: 'hacerme dano', pattern: /hacerme\s+dan[oó]/i },
  // autolesión / autolesion / autolesionarme
  { label: 'autolesi(on|onarme)', pattern: /autolesi[oó]n?(arme|arse)?/i },
  // cortarme (stem — includes "cortarme las venas")
  { label: 'cortarme', pattern: /\bcortarme\b/i },
  // acabar con todo
  { label: 'acabar con todo', pattern: /acabar\s+con\s+todo/i },
  // desaparecer para siempre
  { label: 'desaparecer para siempre', pattern: /desaparecer\s+para\s+siempre/i },
  // tirarme desde / tirarme por
  { label: 'tirarme (desde|por)', pattern: /tirarme\s+(desde|por)/i },
]

/**
 * Normalize text for accent-insensitive matching:
 * lowercase + NFD decompose + strip combining diacritics.
 */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Basic keyword-based crisis detection for the most recent user message.
 * Returns { detected: true, matchedTerms: [...] } if any high-risk phrase is found.
 */
export function detectCrisis(text: string): CrisisDetection {
  if (!text) return { detected: false, matchedTerms: [] }

  const normalized = normalize(text)
  const matchedTerms: string[] = []

  for (const { label, pattern } of CRISIS_PATTERNS) {
    if (pattern.test(normalized)) {
      matchedTerms.push(label)
    }
  }

  return { detected: matchedTerms.length > 0, matchedTerms }
}

/**
 * Chat spelling on top of `normalize`: "kiero" → "quiero", "k"/"ke" → "que",
 * and stretched letters ("morirmeee", "siii") collapsed. A third-person
 * preterite "cortó" must not turn into first-person "corto" when the accent
 * is stripped, so it is rewritten before normalising.
 */
function normalizeColloquial(text: string): string {
  return normalize(text.replace(/cort[óò](?![a-záéíóúüñ])/gi, 'cortaron'))
    .replace(/\bkier([oa])\b/g, 'quier$1')
    .replace(/\bk(?:e)?\b/g, 'que')
    .replace(/([a-z])\1{2,}/g, '$1')
}

// Cue lists operate on accent-stripped lowercase text. A cue only routes the
// turn to the safety flow; it never estimates severity. First-person wish or
// plan wording is required for the broad "morir/matar" families so that
// talking about a relative's death or another person does not match.
const DEATH_WISH = String.raw`(?:quiero|quisiera|querria|prefiero|preferiria|deseo|desearia|necesito|gustaria)`
const PLACE = String.raw`(?:(?:un|una|el|la|las|los|mi)\s+)?(?:puente|ventana|balcon|azotea|terraza|edificio|vias?|tren|metro|acantilado)`
const JUMP = String.raw`(?:saltar\s+(?:de|del|desde|por)\s+(?:(?:un|una|el|la|las|los|mi)\s+)?(?:puente|ventana|balcon|azotea|terraza|edificio|vias?|tren|metro|acantilado)|saltar\s+a\s+las?\s+vias?|(?:tirarme|lanzarme|arrojarme)\s+(?:de|del|desde|por|a|al)\s+(?:(?:un|una|el|la|las|los|mi)\s+)?(?:puente|ventana|balcon|azotea|terraza|edificio|vias?|tren|metro|acantilado))`
const PILLS_TAKEN = String.raw`\bme\s+(?:he\s+tomado|acabo\s+de\s+tomar|tome)\s+(?:todas\s+las|todas\s+mis|un\s+bote\s+de|una\s+caja\s+de|muchas|demasiadas|\d{2,})\s+pastillas\b`
const SUICIDE_CUES = [
  String.raw`suicid|quitar(me|se)\s+la\s+vida|matar(me|se)|no\s+(quiero|merezco)\s+vivir|mejor\s+no\s+estar|acabar\s+con\s+todo|desaparecer\s+para\s+siempre|tirarme\s+(desde|por)|voy\s+a\s+suicidarme`,
  // morir: "quiero morir", "me quiero morir", "ganas de morirme", "ojalá me muriera"
  String.raw`\b(?:me\s+)?${DEATH_WISH}\s+(?:morir(?:me)?|estar\s+muert[oa])\b|\bganas\s+de\s+(?:morir(?:me)?|matarme)\b|\bojala\s+(?:me\s+)?(?:muriera|muriese|muera|estuviera\s+muert[oa]|estuviese\s+muert[oa]|no\s+despertar[a-z]*)\b`,
  String.raw`\b(?:estaria|estare|estoy)\s+mejor\s+muert[oa]\b|\bmejor\s+muert[oa]\b|\b(?:estarian|estaran|estariais|estaria|estan)\s+(?:todos\s+)?mejor\s+sin\s+mi\b`,
  String.raw`\b(?:pienso|pensando|pensado)\s+(?:mucho\s+)?en\s+(?:la\s+muerte|morir(?:me)?)\b|\bpensamientos?\s+de\s+muerte\b|\bno\s+despertar(?:me)?\b`,
  // matar with the pronoun before the verb: "me quiero matar", "me voy a matar", "me mato"
  String.raw`\bme\s+(?:${DEATH_WISH}|voy\s+a)\s+matar\b|\bme\s+mato\b`,
  // clitic before the verb: \"me voy a quitar la vida\", \"me voy a tirar por la ventana\"
  String.raw`\bme\s+(?:${DEATH_WISH}|voy\s+a)\s+(?:quitar\s+la\s+vida|quitar\s+de\s+en\s+medio|pegar\s+un\s+tiro|(?:tirar|lanzar|arrojar)\s+(?:de|del|desde|por|a|al)\s+${PLACE})\b|\bme\s+quito\s+(?:la\s+vida|de\s+en\s+medio)\b|\bpegarme\s+un\s+tiro\b`,
  String.raw`\bno\s+tengo\s+ganas\s+de\s+(?:vivir|seguir\s+viv[a-z]+)\b|\bno\s+(?:vale|merece)\s+la\s+pena\s+(?:vivir|seguir\s+viv[a-z]+)\b|\b(?:quiero|quisiera)\s+dejar\s+de\s+existir\b|\bsoy\s+una\s+carga\b`,
  PILLS_TAKEN,
  String.raw`\b(?:acabar|terminar)\s+con\s+(?:mi\s+vida|todo)\b|\bquitar(?:me)?\s+de\s+en\s+medio\b|\bquiero\s+desaparecer\b`,
  String.raw`\bno\s+quiero\s+seguir\s+(?:viviendo|vivo|viva|con\s+vida)\b|\bno\s+(?:tiene|le\s+veo|le\s+encuentro|encuentro)\s+sentido\s+(?:a\s+)?(?:vivir|la\s+vida|seguir\s+viv[a-z]+)\b`,
  // method wording
  String.raw`\btomar(?:me)?\s+(?:todas\s+las|todas\s+mis|un\s+bote\s+de|una\s+caja\s+de|muchas)\s+pastillas\b|\bsobredosis\b`,
  String.raw`\b(?:ahorcar|colgar)me\b|\bme\s+(?:${DEATH_WISH}|voy\s+a)\s+(?:ahorcar|colgar)\b`,
  String.raw`\b${JUMP}\b`,
  String.raw`\bcarta\s+de\s+despedida\b`,
  // frequent non-Spanish wording
  String.raw`\bkill\s+myself\b|\bwant\s+to\s+die\b|\bvull\s+morir\b|\bmatar-me\b`,
]
const SUICIDE = new RegExp(SUICIDE_CUES.join('|'), 'i')
const SELF_HARM_CUES = [
  String.raw`hacerme\s+dan[oó]|autolesi[oó]n?(arme|arse|ando)?|cortarme|\bme\s+(?:estoy\s+)?cortando\b|\bme\s+corto\b|\bme\s+hice\s+dan[oó]\b|\bme\s+estoy\s+haciendo\s+dan[oó]\b|\bvoy\s+a\s+cortarme\b|\bvoy\s+a\s+hacerme\s+dan[oó]\b|\bplan\s+para\s+(?:hacerme\s+dan[oó]|cortarme)\b`,
  String.raw`\bme\s+(?:he\s+cortado|corte)\b|\bme\s+(?:hago|he\s+hecho)\s+dan[oó]\b|\bme\s+quemo\s+(?:con|a\s+proposito)\b|\bquemarme\s+(?:con|a\s+proposito)\b|\b(?:lastimar|herir)me\b|\bme\s+lastimo\b`,
  String.raw`\bme\s+(?:quiero|voy\s+a)\s+(?:cortar|hacer\s+dan[oó])\b|\bme\s+he\s+vuelto\s+a\s+cortar\b|\bme\s+hago\s+cortes\b`,
]
const SELF_HARM = new RegExp(SELF_HARM_CUES.join('|'), 'i')
// Everyday hyperbole and grooming that share words with the cues above.
const IDIOMS = /\b(?:me\s+)?(?:(?:quiero|voy\s+a|queria)\s+)?(?:morir(?:me)?|muero|muriendo|moria)\s+de\s+(?:la\s+|el\s+)?(?:risa|verguenza|hambre|sueno|calor|frio|ganas|amor|pena|envidia|miedo|aburrimiento|cansancio|sed|nervios|curiosidad|asco|gusto|felicidad|alegria|ilusion)\b|\b(?:me\s+(?:voy\s+a\s+|quiero\s+)?matar|matarme|me\s+mato)\s+a\s+[a-z]+(?:ar|er|ir)\b|\bme\s+(?:he\s+cortado|corte)\s+(?:cocinando|afeitandome|sin\s+querer|con\s+(?:un|el)\s+(?:papel|folio)|(?:el|un)\s+dedo)\b|\bse\s+me\s+corto\b|\bme\s+corto\s+(?:cuando\s+(?:hablo|tengo\s+que|me\s+toca|estoy\s+con|hay)|el\s+rollo)\b|\b(?:colgarme|me\s+(?:voy\s+a|quiero)\s+colgar)\s+(?:la|el|una?|las|los)\s+(?:medallas?|mochila|bolso|camara|cartel|chaqueta)\b|\bcasi\s+me\s+mato\b|\bme\s+mato\s+[a-z]+(?:ando|iendo)\b|\bme\s+(?:hice|he\s+hecho)\s+dan[oó]\s+(?:en\s+(?:el|la|los|las|un|una)\s+(?:espalda|tobillos?|rodillas?|pie|cuello|hombros?|gimnasio|gym)|entrenando|jugando|corriendo)\b|\bme\s+lastimo\s+(?:el|la|los|las)\s+(?:espalda|tobillos?|rodillas?|pie|cuello|hombros?)\b|\bquiero\s+desaparecer\s+(?:unos\s+dias|un\s+tiempo|una\s+temporada|un\s+rato)\b|\bacabar\s+con\s+todo\s+(?:el|la|los|las)\s+[a-z]+\b|\bsuicidio\s+(?:profesional|politico|comercial|social|laboral|deportivo)\b|\ben\s+la\s+muerte\s+de\s+(?:mi|mis|su|sus|un|una|el|la|los|las)\b|\bno\s+despertar\s+(?:a|al)\b/gi
const GROOMING = /\b(?:me estoy cortando|cortarme|me corto|me he cortado|me corte|me (?:quiero|voy a) cortar)\s+(?:yo\s+)?(?:el pelo|las unas|el cabello|la barba|el flequillo|las puntas|la melena|el bigote|la coleta)\b/i
const DIRECT_METHOD = String.raw`matarme|quitarme la vida|acabar con mi vida|terminar con mi vida|ahorcarme|colgarme|quitarme de en medio|tomarme (?:todas las|todas mis|un bote de|una caja de) pastillas|pegarme un tiro|${JUMP}`
const DIRECT_EXTRA = new RegExp(String.raw`(?<!no )(?<!nunca )(?<!jamas )(?:\bme (?:quiero|voy a) (?:matar|ahorcar|colgar|quitar la vida|quitar de en medio|pegar un tiro|hacer dan[oó]|cortar las venas|(?:tirar|lanzar|arrojar) (?:de|del|desde|por|a|al) ${PLACE}|tomar (?:todas las|todas mis|un bote de|una caja de) pastillas)\b|\bme voy a cortar\b|${PILLS_TAKEN}|\b(?:quiero|voy a) (?:${DIRECT_METHOD})\b|\btengo un plan para (?:${DIRECT_METHOD})\b|\bkill myself\b)`, 'i')
const DENIAL_EXTRA = new RegExp(String.raw`\b(?:no|nunca|jamas)\s+(?:(?:me\s+)?(?:quiero|voy a|quisiera|pienso|he querido|estoy pensando en)\s+(?:morir(?:me)?|matar(?:me)?|ahorcar(?:me)?|colgar(?:me)?|desaparecer|estar muert[oa]|${DIRECT_METHOD})|tengo ganas de (?:morir(?:me)?|matarme)|pienso en (?:la muerte|morir(?:me)?)|(?:pienso|tengo intencion de|tengo ninguna intencion de)\s+(?:hacerme dan[oó]|cortarme|autolesionarme|suicidarme|matarme|quitarme la vida)|me (?:quiero|voy a) (?:cortar|hacer dan[oó]|quitar la vida)|me (?:he cortado|corte|hago dan[oó]|he hecho dan[oó]|lastimo|quemo))\b`, 'i')
// First-person requests for immediate help or statements of being in danger
// now, written without naming self-harm or suicide. The urgent-send notice
// asks people to say exactly this, so these clauses must count as an explicit
// current signal ('crisis_other'). Each cue must close its clause so that
// "necesito ayuda urgente con el informe" or "estoy en peligro de suspender"
// stay ordinary.
const URGENT_TAIL = String.raw`(?:\s+(?:por\s+favor|ahora(?:\s+mismo)?|ya))*\s*$`
const URGENT_HELP = new RegExp(String.raw`(?:^|\b)(?:(?:necesito|me\s+hace\s+falta|pido)\s+(?:una\s+)?ayuda\s+(?:inmediata|urgente|urgentemente|ya|ahora(?:\s+mismo)?)|necesito\s+que\s+me\s+ayuden\s+(?:ya|ahora(?:\s+mismo)?|urgentemente)|(?:estoy|me\s+siento)\s+en\s+peligro|no\s+estoy\s+a\s+salvo|temo\s+por\s+mi\s+(?:vida|seguridad)|^(?:socorro|auxilio))${URGENT_TAIL}`, 'i')
const URGENT_HELP_NEGATED = /\b(?:no|nunca|jamas|ya\s+no|tampoco)\s+(?:(?:creo\s+que\s+)?(?:necesito|me\s+hace\s+falta|pido)|estoy\s+en\s+peligro|me\s+siento\s+en\s+peligro|temo)\b|\b(?:no\s+se\s+si|no\s+creo\s+que|quizas|quiza|a\s+lo\s+mejor|no\s+estoy\s+segur[oa]\s+de\s+si)\b/i
type ClauseClassification = { disposition: CrisisDisposition; riskType: Exclude<CrisisRiskType, null> }

const THIRD_PARTY_LEAD = /^(?:(?:mi|un|una|el|la)\s+)?(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana|hijo|hija)\s+(?:me\s+)?(?:dijo|dice|conto|cuenta|cree|piensa|comento|comenta|pregunto|pregunta|escribio|escribe)\b/i
const THIRD_PARTY_TAIL = /^(?:me\s+)?(?:dijo|dice|conto|cuenta|comento|comenta|pregunto|pregunta|escribio|escribe)\s+(?:(?:mi|un|una|el|la)\s+)?(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana|hijo|hija|el|ella)\b/i

/** Immediate-help wording with no self-harm or suicide cue in the clause. */
function urgentHelpClause(clause: string, following: string): ClauseClassification[] {
  const text = clause.replace(/^[\s"'“”‘’«»¡¿]+|[\s"'“”‘’«»!?]+$/g, '')
  if (!URGENT_HELP.test(text) || URGENT_HELP_NEGATED.test(text)) return []
  const reported = THIRD_PARTY_LEAD.test(text) || THIRD_PARTY_TAIL.test(following.replace(/^[\s"'“”‘’«»]+/, ''))
    || /\b(pelicula|serie|cancion|libro|clase|articulo|dijo|dice|personaje|antes|cuando era|hace anos|el ano pasado|en el pasado)\b/i.test(text)
  return [{ disposition: reported ? 'contextual' : 'explicit_current', riskType: 'crisis_other' }]
}

/** Conversation routing heuristic only; this does not estimate clinical severity or diagnose. */
export function classifyCrisisSignal(text: string): CrisisSignalClassification {
  let normalized = normalizeColloquial(text)
  const quotedContexts: ClauseClassification[] = []
  type QuoteSpan = { start: number; end: number; opener: string; closer: string; closed: boolean; parent: QuoteSpan | null; children: QuoteSpan[] }
  const quotePairs: Record<string, string> = { '«': '»', '“': '”', '‘': '’', '"': '"', "'": "'" }
  const quoteSpans: QuoteSpan[] = []
  const quoteStack: QuoteSpan[] = []
  for (let i = 0; i < normalized.length; i++) {
    const character = normalized[i]
    const current = quoteStack[quoteStack.length - 1]
    if (current && character === current.closer) {
      current.end = i + 1
      current.closed = true
      quoteStack.pop()
      continue
    }
    if (quotePairs[character]) {
      const span: QuoteSpan = { start: i, end: normalized.length, opener: character, closer: quotePairs[character], closed: false, parent: current ?? null, children: [] }
      if (current) current.children.push(span)
      quoteSpans.push(span)
      quoteStack.push(span)
    }
  }
  const reportingLead = /(?:mi|un|una|el|la)\s+(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana)\s+(?:me\s+)?(?:dijo|dice|conto|cuenta|cree|piensa|comento|comenta|pregunto|pregunta)\s*[:,]?\s*$/i
  const reportingTail = /^\s*[,;]?\s*(?:me\s+)?(?:dijo|dice|conto|cuenta|comento|comenta|pregunto|pregunta)\s+(?:(?:mi|un|una|el|la)\s+)?(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana|el|ella)\b/i
  const quoteRanges: Array<{ start: number; end: number; replacement: string }> = []
  for (const span of quoteSpans) {
    const innerStart = span.start + 1
    const innerEnd = span.end - (span.closed ? 1 : 0)
    let quoteText = normalized.slice(innerStart, innerEnd)
    for (const child of [...span.children].reverse()) {
      quoteText = `${quoteText.slice(0, child.start - innerStart)} ${quoteText.slice(child.end - innerStart)}`
    }
    const suicideCue = SUICIDE.test(quoteText)
    const selfHarmCue = SELF_HARM.test(quoteText)
    if (!suicideCue && !selfHarmCue) continue
    const prefix = normalized.slice(0, span.start)
    const suffix = normalized.slice(span.end)
    const leadMatch = reportingLead.exec(prefix)
    const tailMatch = reportingTail.exec(suffix)
    const innerPrefix = span.parent ? normalized.slice(span.parent.start + 1, span.start) : ''
    const innerSuffix = span.parent ? normalized.slice(span.end, span.parent.end - (span.parent.closed ? 1 : 0)) : ''
    const internallyAttributed = Boolean(span.parent && (reportingLead.test(innerPrefix) || reportingTail.test(innerSuffix)))
    const attributed = Boolean(leadMatch || tailMatch || internallyAttributed)
    const recentPrefix = prefix.slice(Math.max(prefix.lastIndexOf(';'), prefix.lastIndexOf('.'), prefix.lastIndexOf('!'), prefix.lastIndexOf('?')) + 1)
    const mediaContext = /\b(?:pelicula|serie|cancion|libro|titulo)\s+(?:se llama|trata de|es|lleva por titulo)\s*$/i.test(recentPrefix)
      || /\b(?:oyo|escucho|vio|leyo)\s+(?:en|de)\s+(?:(?:una|la|esta|esa)\s+)?(?:pelicula|serie|cancion|libro)\s+(?:la\s+)?(?:frase|linea|letra|expresion)\s*$/i.test(recentPrefix)
      || /\b(?:en|de)\s+(?:(?:una|la|esta|esa)\s+)?(?:pelicula|serie|cancion|libro)\b.*\b(?:personaje\s+(?:dice|dijo|oye|oyo|escucha|escucho)|(?:la\s+)?(?:frase|linea|letra|expresion))\s*$/i.test(recentPrefix)
    const thirdPartyFrame = /\b(?:mi|un|una|el|la)\s+(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana)\s+(?:cree|piensa|dice)\s+que\s+(?:yo\s+)?estoy pensando\s*:\s*$/i.test(prefix)
    const negativeSelfFrame = /\bno\s+(?:estoy pensando|pienso)\s*:\s*$/i.test(prefix)
    const affirmativeSelfFrame = /\b(?:yo\s+)?(?:estoy pensando|pienso)\s*:\s*$/i.test(prefix) && !negativeSelfFrame && !thirdPartyFrame
    const suffixEndorsement = !span.parent && /^\s*es mi intencion\b/i.test(suffix)
    const ownFrame = !span.parent && (affirmativeSelfFrame || suffixEndorsement)
    if (attributed || mediaContext) quotedContexts.push({ disposition: 'contextual', riskType: suicideCue ? 'suicidal_ideation' : 'self_harm' })
    else if (ownFrame) continue
    else quotedContexts.push({ disposition: 'ambiguous', riskType: suicideCue ? 'suicidal_ideation' : 'self_harm' })

    if (!span.parent) {
      const removeTail = tailMatch ? tailMatch[0].length : 0
      const removeLead = leadMatch ? leadMatch[0].length : 0
      if (ownFrame) {
        const ownContent = quoteText
        if (suffixEndorsement) {
          quoteRanges.push({ start: span.start, end: span.end + /^\s*es mi intencion\b/i.exec(suffix)![0].length, replacement: ` ${ownContent} ` })
        } else quoteRanges.push({ start: span.start, end: span.end, replacement: ` ${ownContent} ` })
      } else {
        quoteRanges.push({ start: span.start - removeLead, end: span.end + removeTail, replacement: ' ' })
      }
    }
  }
  for (const range of quoteRanges.reverse()) normalized = `${normalized.slice(0, range.start)}${range.replacement}${normalized.slice(range.end)}`
  normalized = normalized.trim()
  const clauses: Array<{ text: string; separator: 'start' | 'and' | 'other' }> = []
  const separators = /([;,.!?]|\s+(y|pero|aunque|sin embargo|porque)\s+)/g
  let previousEnd = 0
  let previousSeparator: 'start' | 'and' | 'other' = 'start'
  for (const match of normalized.matchAll(separators)) {
    const separatorIndex = match.index ?? 0
    let quoteCloser = ''
    for (const character of normalized.slice(0, separatorIndex)) {
      if (quoteCloser) {
        if (character === quoteCloser) quoteCloser = ''
      } else if (character === '«') quoteCloser = '»'
      else if (character === '“') quoteCloser = '”'
      else if (character === '‘') quoteCloser = '’'
      else if (character === '"' || character === "'") quoteCloser = character
    }
    if (quoteCloser) continue
    const clauseText = normalized.slice(previousEnd, separatorIndex).trim()
    if (clauseText) clauses.push({ text: clauseText, separator: previousSeparator })
    previousEnd = separatorIndex + match[0].length
    previousSeparator = match[2] === 'y' ? 'and' : 'other'
  }
  const lastClause = normalized.slice(previousEnd).trim()
  if (lastClause) clauses.push({ text: lastClause, separator: previousSeparator })

  const results = [...quotedContexts, ...clauses.flatMap<ClauseClassification>((item, index) => {
    const previous = clauses[index - 1]?.text ?? ''
    const previousDenies = /\b(no|nunca|jamas)\b/i.test(previous)
    const previousIsAttributed = /^(?:(?:mi|un|una|el|la)\s+)?(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana)\s+(?:me\s+)?(?:dijo|dice|conto|cuenta|cree|piensa|comento|comenta|pregunto|pregunta)\b/i.test(previous.replace(/^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g, ''))
    const sharedWant = item.separator === 'and' && /\bquiero\s+(?:suicidarme|matarme|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme (?:el pelo|las unas|el cabello))\b/i.test(previous) && !previousDenies && !previousIsAttributed && /\b(quitarme la vida|suicid|autolesion|matarme)\b/i.test(item.text)
    const clause = (sharedWant ? `quiero ${item.text}` : item.text).replace(IDIOMS, ' ')
    if (GROOMING.test(clause)) return []
    const suicide = SUICIDE.test(clause)
    const selfHarm = SELF_HARM.test(clause)
    if (!suicide && !selfHarm) return urgentHelpClause(clause, clauses[index + 1]?.text ?? '')
    const riskType = suicide ? 'suicidal_ideation' : 'self_harm'
    const attributionClause = clause.replace(/^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g, '')
    const attributionLead = /^(?:(?:mi|un|una|el|la)\s+)?(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana)\s+(?:me\s+)?(dijo|dice|conto|cuenta|cree|piensa|comento|comenta|pregunto|pregunta)\b/i.exec(attributionClause)
    const quotedClause = /^[\s"'“‘«][\s\S]*["'”’»]\s*$/.test(clause)
    const followingAttribution = clauses[index + 1]?.text ?? ''
    const postposedQuoteAttribution = quotedClause && /^(?:me\s+)?(?:dijo|dice|conto|cuenta|comento|comenta|pregunto|pregunta)\s+(?:(?:mi|un|una|el|la)\s+)?(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana|el|ella)\b/i.test(followingAttribution)
    const attributedQuote = Boolean((attributionLead && /^(dijo|dice|conto|cuenta|comento|comenta|pregunto|pregunta)$/i.test(attributionLead[1])) || postposedQuoteAttribution)
    const attributedBelief = Boolean(attributionLead && /^(cree|piensa)$/i.test(attributionLead[1]))
    const context = /\b(pelicula|serie|cancion|libro|clase|estudiamos|vimos|guia|articulo|dijo|dice|hablo|cita|personaje|antes|cuando era)\b/i.test(clause) || attributedQuote || /\b(hablar|hablo|tema|conversar)\s+(?:de|sobre)\s+suicid/i.test(clause)
    const past = /\b(hace anos|el ano pasado|en el pasado|antes|cuando era)\b/i.test(clause)
    const uncertainNegation = /\b(no puedo dejar de|no quiero dejar de|no voy a dejar de|no dejo de|no me atrevo a|no creo que (?:quiera|voy a)|no se si|no estoy seguro|no estoy segura)\b/i.test(clause)
    const clearDenial = /\b(?:no|nunca|jamas)\s+(?:(?:me\s+)?(?:quiero|voy a)\s+(?:suicidar(?:me)?|matarme|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme)|estoy pensando en (?:suicidarme|autolesionarme|hacerme dan[oó]|cortarme)|me estoy (?:cortando|haciendo dan[oó]|autolesionando)|me corto(?: ahora)?|tengo pensamientos? de (?:suicidio|autolesion|hacerme dan[oó]))\b/i.test(clause) || DENIAL_EXTRA.test(clause)
    const currentAction = /\b(me estoy cortando|me corto|me hice dano hoy)\b/i.test(clause)
    const directIntentOrBehavior = /\b(no solo quiero\s+(?:suicidarme|matarme|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme las venas)|(?<!no )(?:me\s+)?quiero\s+(?:suicidar(?:me)?|matarme|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme las venas)|(?<!no )(?:me\s+)?voy a (?:suicidar(?:me)?|matarme|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme)|(?<!no )estoy pensando en (?:suicidarme|matarme|quitarme la vida|autolesionarme|cortarme|hacerme dan[oó])|estoy pensando\s*:\s*voy a (?:suicidarme|autolesionarme|hacerme dan[oó]|cortarme)|tengo un plan para (?:quitarme la vida|suicidarme|hacerme dan[oó]|autolesionarme|cortarme)|me estoy (?:cortando|haciendo dan[oó]|autolesionando)|me corto ahora)\b/i.test(clause) || DIRECT_EXTRA.test(clause)
    const explicit = !attributedQuote && !attributedBelief && !past && !uncertainNegation && !clearDenial && !/\b(me hice dano hoy)\b/i.test(clause) && (
      (currentAction && !/\b(me hice dano hoy)\b/i.test(clause)) ||
      directIntentOrBehavior
    )
    const disposition = explicit ? 'explicit_current' : (context || past || clearDenial ? 'contextual' : 'ambiguous')
    return [{ disposition, riskType } as ClauseClassification]
  })]
  if (!results.length) return { disposition: 'none', riskType: null }
  const explicit: ClauseClassification | undefined = results.find(result => result.disposition === 'explicit_current' && result.riskType === 'suicidal_ideation')
    ?? results.find(result => result.disposition === 'explicit_current')
  if (explicit) return explicit
  const ambiguous: ClauseClassification | undefined = results.find(result => result.disposition === 'ambiguous')
  if (ambiguous) return ambiguous
  const contextual: ClauseClassification = results[0]
  return contextual
}

// Short replies that deny without any further content.
const BARE_DENIAL = /^(?:no+|nop|nope|nah|para nada|que va|en absoluto|nunca|jamas|claro que no|ni de cona|ni de broma|era (?:una )?broma|no,? (?:para nada|que va|en absoluto|gracias|tranquil[oa]|nunca|jamas|claro que no))$/
// After a leading "no": content that affirms risk despite the "no".
const NO_BUT_RISK = /\b(?:plan(?:es|eado|ificado)?|pastillas|cuerda|cuchill[oa]|navaja|preparad[oa]s?|lo he pensado|lo pienso|pienso en ello|pensado en hacerlo|intentado|lo intente|ganas no me faltan|tengo ganas|a veces si|se como hacerlo|como hacerlo|esta noche|esta tarde|hoy mismo|manana|anoche|luego|mas tarde|voy a hacerlo|lo voy a hacer|lo hare|ya lo he hecho|ya lo hice|ya me he|me acabo de|si que|pero si)\b/
// After a leading "no": wording that leaves the answer open.
const NO_HEDGE = /^(?:ahora mismo|ahora|exactamente|del todo|siempre|todavia(?: no)?|aun(?: no)?|de momento|por ahora|mucho|creo|bueno|mas o menos|tanto|se)\b/
// "no" that starts a statement rather than answering: "no puedo más".
const NO_AS_STATEMENT = /^(?:puedo mas|aguanto mas|dejo de|paro de|pienso en otra cosa|te voy a mentir|lo descarto|me importaria|veo (?:otra )?salida|es la primera vez|estoy bien|quiero (?:contestar|responder|hablar de eso|decirlo)|se\b|lo se\b)/
// Plain denials written without a comma after "no".
const NO_DENIAL_PHRASE = /^(?:(?:estoy pensando|pienso) en (?:eso|ello|nada de eso|hacerlo|hacer(?:me)? nada)|(?:quiero|voy a|pienso) (?:hacerlo|hacer(?:me)? nada)|(?:es|era) eso|tengo (?:intencion|ningun plan|planes|pensamientos)|me pasa(?: nada)?|lo estoy|es mi caso|no\b)/

export function classifySafetyClarificationReply(text: string): SafetyClarificationReply {
  const value = normalizeColloquial(text).trim().replace(/[.!?¿¡]+$/g, '')
  if (/^(?:cambiemos de tema|cambiar de tema|prefiero hablar de otra cosa|pasemos a otra cosa)(?:$|[,;.!?:]\s+)|^(?:skip|saltar)$/.test(value)) return 'skip'
  const signal = classifyCrisisSignal(value)
  if (signal.disposition !== 'explicit_current' && /^(?:(?:quiero|prefiero|me gustaria)\s+hablar\s+(?:de|del|sobre)|(?:quiero|prefiero)\s+conversar\s+(?:de|sobre)|hablemos\s+(?:de|sobre)|podemos hablar\s+(?:de|sobre))\s+.+$/.test(value)) return 'skip'
  const uncertain = /\b(?:no se|no lo se|no estoy seguro|no estoy segura|quizas|quiza|no puedo afirmar|no lo tengo claro)\b/.test(value)
  const conflictsWithYes = /^(?:si|sí)\s+y\s+no\b/.test(value) || /\bpero\s+no\s+(?:estoy pensando|pienso|tengo pensamientos?|quiero)\b/.test(value)
  // Stated intent, plan or act is an affirmative answer however it starts.
  if (signal.disposition === 'explicit_current') return 'affirmative'
  if (BARE_DENIAL.test(value)) return 'negative'
  const leadingNo = /^no+\b([\s,.;:!]*)([\s\S]*)$/.exec(value)
  if (leadingNo) {
    const answeredWithPause = /[,.;:!]/.test(leadingNo[1])
    const rest = leadingNo[2].trim()
    if (uncertain || NO_HEDGE.test(rest)) return 'unclear'
    if (/^(?:pero|aunque|sin embargo)\s+si\b/.test(rest)) return 'unclear'
    if (NO_BUT_RISK.test(rest)) return 'affirmative'
    // A remaining risk cue that is not a clear denial cannot count as "no".
    if (signal.disposition === 'ambiguous') return 'unclear'
    if (!answeredWithPause && NO_AS_STATEMENT.test(rest)) return 'unclear'
    if (answeredWithPause || !rest || signal.disposition === 'contextual' || NO_DENIAL_PHRASE.test(rest) || /^(?:pero|aunque|sin embargo|solo|es que|porque|gracias|para nada|tranquil[oa]|de verdad|en serio)\b/.test(rest)) return 'negative'
    return 'unclear'
  }
  if (/^(?:si|sip|claro que si|pues si|creo que si|la verdad es que si)\b/.test(value) && !uncertain && !conflictsWithYes) return 'affirmative'
  if (!uncertain && /^(?:tengo un plan|lo tengo (?:planeado|pensado|decidido)|a veces|muchas veces|todo el rato|constantemente|cada dia)\b/.test(value)) return 'affirmative'
  // A death wish or self-harm cue as the whole answer confirms the concern.
  if (!uncertain && signal.disposition === 'ambiguous') return 'affirmative'
  return 'unclear'
}
