import 'server-only'
import { z } from 'zod'

type ProfileEnvironment = Readonly<Record<string, string | undefined>>
const uuid = z.uuid()

// null preserves the existing unrestricted local opt-in; [] fails closed on Vercel.
export function progressiveProfileReviewUserIds(env: ProfileEnvironment = process.env): readonly string[] | null {
  if (env.VERCEL !== '1') return null
  if (env.FEATURE_PROGRESSIVE_PROFILE !== 'on') return []
  const ids = (env.PROFILE_REVIEW_USER_IDS ?? '').split(',').map(id => id.trim().toLowerCase())
  if (ids.length < 1 || ids.length > 10 || ids.some(id => !uuid.safeParse(id).success) || new Set(ids).size !== ids.length) return []
  return ids
}

export function progressiveProfileAvailable(env: ProfileEnvironment = process.env): boolean {
  if (env.FEATURE_PROGRESSIVE_PROFILE !== 'on') return false
  const ids = progressiveProfileReviewUserIds(env)
  return ids === null || ids.length > 0
}

export function progressiveProfileEnabled(env: ProfileEnvironment = process.env, userId?: string): boolean {
  if (!progressiveProfileAvailable(env)) return false
  const ids = progressiveProfileReviewUserIds(env)
  return ids === null || (typeof userId === 'string' && ids.includes(userId.toLowerCase()))
}
