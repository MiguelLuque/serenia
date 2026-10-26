/** Server-only configuration: this experimental clinical variant is for
 * supervised fictional cases, never selectable by a message/request body. */
export function clinicalPilotEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  if (env.FEATURE_CLINICAL_CONVERSATION_PILOT !== 'on') return false
  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
    throw new Error('Clinical conversation pilot requires development or test; production is not supported')
  }
  return true
}
