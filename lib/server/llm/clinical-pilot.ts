/** Server-only configuration: this experimental clinical variant is for
 * supervised fictional cases, never selectable by a message/request body. */
export function clinicalPilotEnabled(env: Readonly<Record<string, string | undefined>> = process.env, userId?: string): boolean {
  if (env.FEATURE_CLINICAL_CONVERSATION_PILOT !== 'on') return false
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return true
  if (env.NODE_ENV === 'production' && env.VERCEL === '1') {
    const ids = (env.CLINICAL_PILOT_REVIEW_USER_IDS ?? '').split(',').map(id => id.trim().toLowerCase())
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    if (ids.some(id => !uuid.test(id))) throw new Error('Clinical conversation pilot requires an explicit review account allowlist')
    // The caller supplies the owner verified by Auth or by the owned workflow
    // session, never a request-body field, email guess or editable metadata.
    return userId !== undefined && ids.includes(userId.toLowerCase())
  }
  throw new Error('Clinical conversation pilot requires development/test or an enrolled Vercel review')
}
