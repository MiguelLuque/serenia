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
const SELF_HARM = /hacerme\s+dan[oó]|autolesi[oó]n?(arme|arse)?|cortarme/i

/** Conversation routing heuristic only; this does not estimate clinical severity or diagnose. */
export function classifyCrisisSignal(text: string): CrisisSignalClassification {
  const normalized = normalize(text)
  const suicide = SUICIDE.test(normalized)
  const selfHarm = SELF_HARM.test(normalized)
  if (!suicide && !selfHarm) return { disposition: 'none', riskType: null }

  const personalCurrent = /\b(yo|me|mi|estoy|tengo|quiero|pienso|pensando|siento|voy)\b/i.test(normalized) &&
    /\b(ahora|hoy|actualmente|estoy|tengo|quiero|pienso|pensando|siento|voy|me)\b/i.test(normalized)
  const context = /\b(pelicula|serie|cancion|libro|clase|estudiamos|guia|articulo|amigo|amiga|hermano|hermana|dijo|dice|cita|personaje|hace anos|antes|cuando era)\b/i.test(normalized)
  const denial = /\b(no|nunca|jamás|jamas)\b/i.test(normalized)
  const directCurrent = /\b(ahora|hoy|actualmente)\b/i.test(normalized) && /\b(yo|me|estoy|tengo|quiero|pienso|pensando|siento)\b/i.test(normalized)
  if (directCurrent && (suicide || selfHarm)) {
    return { disposition: 'explicit_current', riskType: suicide ? 'suicidal_ideation' : 'self_harm' }
  }
  if (personalCurrent && !/\b(pero|aunque|sin embargo)\b/i.test(normalized) && !context && !denial && !/\b(a veces|a menudo|hace anos|en el pasado)\b/i.test(normalized)) {
    return { disposition: 'explicit_current', riskType: suicide ? 'suicidal_ideation' : 'self_harm' }
  }
  if (context || denial || /\b(hace años|antes|en el pasado|cuando era)\b/i.test(normalized)) {
    // A direct current clause takes precedence over contextual or negated clauses.
    if (personalCurrent && /\b(pero|aunque|sin embargo)\b/i.test(normalized) && /\b(ahora|hoy|actualmente)\b/i.test(normalized)) {
      return { disposition: 'explicit_current', riskType: suicide ? 'suicidal_ideation' : 'self_harm' }
    }
    return { disposition: 'contextual', riskType: suicide ? 'suicidal_ideation' : 'self_harm' }
  }
  return { disposition: 'ambiguous', riskType: suicide ? 'suicidal_ideation' : 'self_harm' }
}

export function classifySafetyClarificationReply(text: string): SafetyClarificationReply {
  const value = normalize(text).trim().replace(/[.!?¿¡]+$/g, '')
  if (/^(cambiemos de tema|cambiar de tema|prefiero hablar de otra cosa|pasemos a otra cosa|skip|saltar)$/.test(value)) return 'skip'
  if (/^(si|sí|no|no lo se|no se|no estoy seguro|no estoy segura|quizas|quizá)$/.test(value)) {
    if (value === 'si' || value === 'sí') return 'affirmative'
    if (value === 'no') return 'negative'
  }
  return 'unclear'
}
