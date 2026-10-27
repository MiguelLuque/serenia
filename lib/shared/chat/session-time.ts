export const SESSION_MAX_DURATION_MS = 60 * 60 * 1000
export const SESSION_INACTIVITY_MS = 30 * 60 * 1000

/** A server sample; clients use elapsed monotonic time, never their wall clock. */
export function sessionTiming(openedAt: string, serverNow = Date.now()) {
  const expiresAt = Date.parse(openedAt) + SESSION_MAX_DURATION_MS
  if (!Number.isFinite(expiresAt) || !Number.isFinite(serverNow)) throw new Error('Invalid session clock')
  return { serverNow, expiresAt }
}

export function isSessionInactive(session: { last_activity_at: string }, now = Date.now()) {
  return now - Date.parse(session.last_activity_at) >= SESSION_INACTIVITY_MS
}
