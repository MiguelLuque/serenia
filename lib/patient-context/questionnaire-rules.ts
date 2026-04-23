import 'server-only'
import type { PatientContext } from '@/lib/patient-context/builder'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * MS_PER_DAY
const FOURTEEN_DAYS_MS = 14 * MS_PER_DAY

type QuestionnaireEntry = PatientContext['recentQuestionnaires'][number]
type QuestionnaireCode = QuestionnaireEntry['code']

/**
 * Returns the first entry in the array with the given code (most-recent-first
 * ordering assumed, matching builder.ts DB query order).
 */
function findMostRecent(
  entries: PatientContext['recentQuestionnaires'],
  code: QuestionnaireCode,
): QuestionnaireEntry | undefined {
  return entries.find((e) => e.code === code)
}

/**
 * Computes a retake hint for a PHQ-9 or GAD-7 entry.
 *
 * Priority: severe preempts moderate for the same code.
 * Returns null if no rule matches.
 */
function computeHintForEntry(
  entry: QuestionnaireEntry,
  label: 'PHQ-9' | 'GAD-7',
  nowMs: number,
): string | null {
  const scoredAtMs = new Date(entry.scoredAt).getTime()
  const ageMs = nowMs - scoredAtMs

  // Severe rule: score >= 15 AND age strictly > 7 days
  if (entry.score >= 15 && ageMs > SEVEN_DAYS_MS) {
    return `el ${label} del paciente era severo y tiene más de una semana; considera proponerlo de nuevo si el encuadre de la sesión lo permite.`
  }

  // Moderate rule: score >= 10 AND age strictly > 14 days
  if (entry.score >= 10 && ageMs > FOURTEEN_DAYS_MS) {
    return `el último ${label} del paciente estaba en rango moderado y tiene más de dos semanas; si la sesión lo permite, podría ser un buen momento para re-administrarlo.`
  }

  return null
}

/**
 * Analyses the patient's most recent PHQ-9 and GAD-7 results and returns a
 * Spanish-language hint when re-administration may be appropriate, or null
 * if no rule fires.
 *
 * @param ctx  - Patient context produced by `buildPatientContext`.
 * @param now  - Reference timestamp; defaults to `new Date()`. Pass a fixed
 *               value in tests for deterministic output.
 */
export function computeQuestionnaireRetakeHint(
  ctx: PatientContext,
  now: Date = new Date(),
): string | null {
  const nowMs = now.getTime()
  const hints: string[] = []

  const phq9 = findMostRecent(ctx.recentQuestionnaires, 'PHQ9')
  if (phq9) {
    const hint = computeHintForEntry(phq9, 'PHQ-9', nowMs)
    if (hint) hints.push(hint)
  }

  const gad7 = findMostRecent(ctx.recentQuestionnaires, 'GAD7')
  if (gad7) {
    const hint = computeHintForEntry(gad7, 'GAD-7', nowMs)
    if (hint) hints.push(hint)
  }

  if (hints.length === 0) return null
  return hints.join(' ')
}
