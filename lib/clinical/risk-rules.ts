import 'server-only'

export type PatientRiskState = 'none' | 'watch' | 'active' | 'acute'

const DECAY_WINDOW_MS = 21 * 24 * 60 * 60 * 1000

export function derivePatientRiskState(input: {
  lastValidatedAssessment: {
    reviewedAt: string
    suicidality: 'none' | 'passive' | 'active' | 'acute'
  } | null
  openRiskEvents: Array<{ severity: string; createdAt: string }>
  previousSession: { closedAt: string; closureReason: string | null } | null
  now?: Date
}): PatientRiskState {
  const now = input.now ?? new Date()
  const { lastValidatedAssessment, openRiskEvents, previousSession } = input

  if (openRiskEvents.some((e) => e.severity === 'critical')) return 'acute'

  if (lastValidatedAssessment?.suicidality === 'acute') return 'acute'

  if (lastValidatedAssessment?.suicidality === 'active') return 'active'

  if (lastValidatedAssessment?.suicidality === 'none') {
    const reviewedAtMs = new Date(lastValidatedAssessment.reviewedAt).getTime()
    const allEventsOlder = openRiskEvents.every(
      (e) => reviewedAtMs > new Date(e.createdAt).getTime()
    )
    const crisisSessionOlder =
      previousSession?.closureReason === 'crisis_detected'
        ? reviewedAtMs > new Date(previousSession.closedAt).getTime()
        : true
    if (allEventsOlder && crisisSessionOlder) return 'none'
  }

  if (
    lastValidatedAssessment?.suicidality === 'passive' &&
    new Date(lastValidatedAssessment.reviewedAt).getTime() >
      now.getTime() - DECAY_WINDOW_MS
  ) {
    return 'watch'
  }

  if (
    openRiskEvents.some(
      (e) =>
        e.severity === 'high' &&
        new Date(e.createdAt).getTime() > now.getTime() - DECAY_WINDOW_MS
    )
  ) {
    return 'watch'
  }

  if (
    previousSession?.closureReason === 'crisis_detected' &&
    new Date(previousSession.closedAt).getTime() > now.getTime() - DECAY_WINDOW_MS
  ) {
    return 'watch'
  }

  return 'none'
}
