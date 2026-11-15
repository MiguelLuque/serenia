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

const SUICIDE = /suicid|quitar(me|se)\s+la\s+vida|matar(me|se)|no\s+(quiero|merezco)\s+vivir|mejor\s+no\s+estar|acabar\s+con\s+todo|desaparecer\s+para\s+siempre|tirarme\s+(desde|por)/i
const SELF_HARM = /hacerme\s+dan[oó]|autolesi[oó]n?(arme|arse)?|cortarme|\bme\s+(?:estoy\s+)?cortando\b|\bme\s+corto\b|\bme\s+hice\s+dan[oó]\b/i
type ClauseClassification = { disposition: CrisisDisposition; riskType: Exclude<CrisisRiskType, null> }

/** Conversation routing heuristic only; this does not estimate clinical severity or diagnose. */
export function classifyCrisisSignal(text: string): CrisisSignalClassification {
  const normalized = normalize(text)
  const clauses = normalized.split(/[;,]|\s+(?:y|pero|aunque|sin embargo)\s+/).map(part => part.trim())
  const results = clauses.flatMap<ClauseClassification>((rawClause, index) => {
    const previous = clauses[index - 1] ?? ''
    const sharedWant = index > 0 && /\bquiero\b/i.test(previous) && /\b(quitarme la vida|suicid|autolesion)/i.test(rawClause)
    const clause = sharedWant ? `quiero ${rawClause}` : rawClause
    if (/\b(?:me estoy cortando|cortarme|me corto)\s+(?:el pelo|las unas|el cabello)\b/i.test(clause)) return []
    const suicide = SUICIDE.test(clause)
    const selfHarm = SELF_HARM.test(clause)
    if (!suicide && !selfHarm) return []
    const riskType = selfHarm ? 'self_harm' : 'suicidal_ideation'
    const context = /\b(pelicula|serie|cancion|libro|clase|estudiamos|vimos|guia|articulo|amigo|amiga|hermano|hermana|dijo|dice|hablo|cita|personaje|antes|cuando era)\b/i.test(clause)
    const past = /\b(hace anos|el ano pasado|en el pasado|antes|cuando era)\b/i.test(clause)
    const denial = /\b(no|nunca|jamas)\b/i.test(clause)
    const uncertainNegation = /\b(no puedo dejar de|no quiero dejar de|no se si|no estoy seguro|no estoy segura)\b/i.test(clause)
    const clearDenial = denial && (/\b(no quiero|no pienso|no estoy pensando|no tengo|no voy a)\b/i.test(clause)) && !uncertainNegation && !/\b(no quiero vivir)\b/i.test(clause)
    const currentAction = /\b(me estoy cortando|me corto|me hice dano hoy)\b/i.test(clause)
    const explicit = !context && !past && !uncertainNegation && !clearDenial && (
      (currentAction && !/\b(me hice dano hoy)\b/i.test(clause)) ||
      (!/\b(me hice dano hoy)\b/i.test(clause) && /\b(ahora|hoy|actualmente)\b/i.test(clause) && /\b(yo|me|estoy|tengo|quiero|pienso|pensando|siento)\b/i.test(clause)) ||
      (!denial && /\b(quiero|estoy pensando|pienso|me estoy)\b/i.test(clause) && !/\b(a veces|a menudo)\b/i.test(clause))
    )
    const disposition = explicit ? 'explicit_current' : (context || past || clearDenial ? 'contextual' : 'ambiguous')
    return [{ disposition, riskType } as ClauseClassification]
  })
  if (!results.length) return { disposition: 'none', riskType: null }
  const explicit: ClauseClassification | undefined = results.find(result => result.disposition === 'explicit_current')
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
