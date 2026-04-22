import 'server-only'

export const QUESTIONNAIRE_COOLDOWN_DAYS = 14

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
}

export function shouldAdministerPHQ9(lastAdministeredAt: Date | null): boolean {
  if (!lastAdministeredAt) return true
  return daysSince(lastAdministeredAt) >= QUESTIONNAIRE_COOLDOWN_DAYS
}

export function shouldAdministerGAD7(lastAdministeredAt: Date | null): boolean {
  if (!lastAdministeredAt) return true
  return daysSince(lastAdministeredAt) >= QUESTIONNAIRE_COOLDOWN_DAYS
}

export function shouldAdministerASQ(opts: {
  triggeredByRiskSignal: boolean
  lastAdministeredAt: Date | null
}): boolean {
  if (!opts.triggeredByRiskSignal) return false
  if (!opts.lastAdministeredAt) return false
  return daysSince(opts.lastAdministeredAt) >= 1
}

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
