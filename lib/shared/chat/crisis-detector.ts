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

const SUICIDE = /suicid|quitar(me|se)\s+la\s+vida|matar(me|se)|no\s+(quiero|merezco)\s+vivir|mejor\s+no\s+estar|acabar\s+con\s+todo|desaparecer\s+para\s+siempre|tirarme\s+(desde|por)|voy\s+a\s+suicidarme/i
const SELF_HARM = /hacerme\s+dan[oó]|autolesi[oó]n?(arme|arse|ando)?|cortarme|\bme\s+(?:estoy\s+)?cortando\b|\bme\s+corto\b|\bme\s+hice\s+dan[oó]\b|\bme\s+estoy\s+haciendo\s+dan[oó]\b|\bvoy\s+a\s+cortarme\b|\bvoy\s+a\s+hacerme\s+dan[oó]\b|\bplan\s+para\s+(?:hacerme\s+dan[oó]|cortarme)\b/i
type ClauseClassification = { disposition: CrisisDisposition; riskType: Exclude<CrisisRiskType, null> }

/** Conversation routing heuristic only; this does not estimate clinical severity or diagnose. */
export function classifyCrisisSignal(text: string): CrisisSignalClassification {
  let normalized = normalize(text)
  const quotedContexts: ClauseClassification[] = []
  const quotePattern = /«[^»]*»|“[^”]*”|‘[^’]*’|"[^"]*"|'[^']*'/g
  const quoteRanges: Array<{ start: number; end: number; replacement: string }> = []
  const reportingLead = /(?:mi|un|una|el|la)\s+(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana)\s+(?:me\s+)?(?:dijo|dice|conto|cuenta|cree|piensa|comento|comenta|pregunto|pregunta)\s*[:,]?\s*$/i
  const embeddedLead = /^(?:(?:hoy|ayer|ahora)\s+)?(?:mi|un|una|el|la)\s+(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana)\s+(?:me\s+)?(?:dijo|dice|conto|cuenta|comento|comenta|pregunto|pregunta)\s*[:,]?\s*[“‘"']?/i
  const reportingTail = /^\s*[,;]?\s*(?:me\s+)?(?:dijo|dice|conto|cuenta|comento|comenta|pregunto|pregunta)\s+(?:(?:mi|un|una|el|la)\s+)?(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana|el|ella)\b/i
  for (const match of normalized.matchAll(quotePattern)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const quoteText = match[0].slice(1, -1)
    const suicideCue = SUICIDE.test(quoteText)
    const selfHarmCue = SELF_HARM.test(quoteText)
    if (!suicideCue && !selfHarmCue) continue
    const prefix = normalized.slice(0, start)
    const suffix = normalized.slice(end)
    const leadMatch = reportingLead.exec(prefix)
    const tailMatch = reportingTail.exec(suffix)
    const embeddedAttribution = embeddedLead.test(quoteText)
    const attributed = Boolean(leadMatch || tailMatch || embeddedAttribution)
    const mediaContext = /\b(pelicula|serie|cancion|libro|titulo)\b[^.!?]*$/i.test(prefix) || /^\s*(?:es|se llama|el titulo es)\b/i.test(suffix)
    const thirdPartyFrame = /\b(?:mi|un|una|el|la)\s+(?:amigo|amiga|pareja|companero|companera|madre|padre|hermano|hermana)\s+(?:cree|piensa)\s+que\s+(?:yo\s+)?estoy pensando\s*:\s*$/i.test(prefix)
    const negativeSelfFrame = /\bno\s+estoy pensando\s*:\s*$/i.test(prefix)
    const affirmativeSelfFrame = /\b(?:yo\s+)?(?:estoy pensando|pienso)\s*:\s*$/i.test(prefix) && !negativeSelfFrame && !thirdPartyFrame
    if (attributed || mediaContext) {
      quotedContexts.push({ disposition: 'contextual', riskType: suicideCue ? 'suicidal_ideation' : 'self_harm' })
    } else if (affirmativeSelfFrame) {
      quoteRanges.push({ start, end, replacement: ` ${quoteText} ` })
      continue
    } else {
      quotedContexts.push({ disposition: 'ambiguous', riskType: suicideCue ? 'suicidal_ideation' : 'self_harm' })
    }
    quoteRanges.push({
      start: leadMatch ? start - leadMatch[0].length : start,
      end: tailMatch ? end + tailMatch[0].length : end,
      replacement: ' ',
    })
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
    const clause = sharedWant ? `quiero ${item.text}` : item.text
    if (/\b(?:me estoy cortando|cortarme|me corto)\s+(?:el pelo|las unas|el cabello)\b/i.test(clause)) return []
    const suicide = SUICIDE.test(clause)
    const selfHarm = SELF_HARM.test(clause)
    if (!suicide && !selfHarm) return []
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
    const denial = /\b(no|nunca|jamas)\b/i.test(clause)
    const uncertainNegation = /\b(no puedo dejar de|no quiero dejar de|no voy a dejar de|no dejo de|no me atrevo a|no creo que quiera|no se si|no estoy seguro|no estoy segura)\b/i.test(clause)
    const clearDenial = /\b(?:no|nunca|jamas)\s+(?:(?:me\s+)?(?:quiero|voy a)\s+(?:suicidar(?:me)?|matarme|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme)|estoy pensando en (?:suicidarme|autolesionarme|hacerme dan[oó]|cortarme)|me estoy (?:cortando|haciendo dan[oó]|autolesionando)|me corto(?: ahora)?|tengo pensamientos? de (?:suicidio|autolesion|hacerme dan[oó]))\b/i.test(clause)
    const currentAction = /\b(me estoy cortando|me corto|me hice dano hoy)\b/i.test(clause)
    const directIntentOrBehavior = /\b(no solo quiero\s+(?:suicidarme|matarme|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme las venas)|(?<!no )(?:me\s+)?quiero\s+(?:suicidar(?:me)?|matarme|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme las venas)|(?<!no )(?:me\s+)?voy a (?:suicidar(?:me)?|quitarme la vida|hacerme dan[oó]|autolesionarme|cortarme)|(?<!no )estoy pensando en (?:suicidarme|matarme|quitarme la vida|autolesionarme|cortarme|hacerme dan[oó])|tengo un plan para (?:quitarme la vida|suicidarme|hacerme dan[oó]|autolesionarme|cortarme)|me estoy (?:cortando|haciendo dan[oó]|autolesionando)|me corto ahora)\b/i.test(clause)
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

export function classifySafetyClarificationReply(text: string): SafetyClarificationReply {
  const value = normalize(text).trim().replace(/[.!?¿¡]+$/g, '')
  if (/^(cambiemos de tema|cambiar de tema|prefiero hablar de otra cosa|pasemos a otra cosa|skip|saltar)$/.test(value)) return 'skip'
  if (/^no,? no estoy pensando en eso$/.test(value)) return 'negative'
  if (/^(si|sí|no|no lo se|no se|no estoy seguro|no estoy segura|quizas|quizá)$/.test(value)) {
    if (value === 'si' || value === 'sí') return 'affirmative'
    if (value === 'no') return 'negative'
  }
  return 'unclear'
}
