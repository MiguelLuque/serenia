import { describe, expect, it } from 'vitest'
import { progressiveProfileAvailable, progressiveProfileEnabled, progressiveProfileReviewUserIds } from '@/lib/server/profile/config'
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const hosted = { VERCEL: '1', FEATURE_PROGRESSIVE_PROFILE: 'on' }
describe('hosted profile owner allowlist', () => {
  it.each([undefined, '', '*', 'pablo@example.test', 'not-uuid', `${owner},${owner}`, 'abcdefab-1111-4111-8111-111111111111,ABCDEFAB-1111-4111-8111-111111111111', Array.from({ length: 11 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`).join(',')])('fails closed for invalid list %s', list => {
    expect(progressiveProfileEnabled({ ...hosted, PROFILE_REVIEW_USER_IDS: list }, owner)).toBe(false)
  })
  it('requires a verified caller and accepts only listed IDs', () => {
    const env = { ...hosted, PROFILE_REVIEW_USER_IDS: owner }
    expect(progressiveProfileEnabled(env)).toBe(false)
    expect(progressiveProfileEnabled(env, other)).toBe(false)
    expect(progressiveProfileEnabled(env, owner)).toBe(true)
  })
  it('preserves explicit local opt-in without a list or owner', () => {
    expect(progressiveProfileEnabled({ FEATURE_PROGRESSIVE_PROFILE: 'on' })).toBe(true)
    expect(progressiveProfileEnabled({ VERCEL: '0', FEATURE_PROGRESSIVE_PROFILE: 'on', PROFILE_REVIEW_USER_IDS: '*' })).toBe(true)
    expect(progressiveProfileEnabled({ ...hosted, FEATURE_PROGRESSIVE_PROFILE: 'off', PROFILE_REVIEW_USER_IDS: owner }, owner)).toBe(false)
  })
})

it('exposes only valid bounded normalized owners for hosted recovery and availability', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `abcdefab-1111-4111-8111-${String(i).padStart(12, '0')}`)
  const env = { ...hosted, PROFILE_REVIEW_USER_IDS: ids.map(id => ` ${id.toUpperCase()} `).join(',') }
  expect(progressiveProfileAvailable(env)).toBe(true)
  expect(progressiveProfileReviewUserIds(env)).toEqual(ids)
  expect(progressiveProfileEnabled(env, ids[9].toUpperCase())).toBe(true)
  expect(progressiveProfileAvailable({ ...hosted })).toBe(false)
  expect(progressiveProfileReviewUserIds(hosted)).toEqual([])
  expect(progressiveProfileReviewUserIds({ FEATURE_PROGRESSIVE_PROFILE: 'on' })).toBeNull()
})
