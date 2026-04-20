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
