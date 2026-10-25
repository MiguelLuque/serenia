import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

// Only the remote Auth boundary is replaced; execute the real cleanup mode and disk writes.
const remote = vi.hoisted(() => ({
  users: new Map<string, string>(), events: [] as string[],
  lookupError: null as null | { status: number; code: string; message: string },
  ambiguousAbsence: false, signoutError: false, deleteError: false,
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { admin: {
  getUserById: async (id: string) => {
    remote.events.push(`lookup:${id}`)
    if (remote.lookupError) return { data: { user: null }, error: remote.lookupError }
    const email = remote.users.get(id)
    return email ? { data: { user: { id, email } }, error: null }
      : { data: { user: null }, error: remote.ambiguousAbsence ? null : { status: 404, code: 'user_not_found', message: 'User not found' } }
  },
  deleteUser: async (id: string) => {
    remote.events.push(`delete:${id}`)
    if (remote.deleteError) return { data: { user: null }, error: { message: 'delete failed', code: 'unexpected_failure' } }
    if (remote.users.get(id)?.includes('-clinician@') && remote.users.size > 1)
      return { data: { user: null }, error: { message: 'reviewed_assessment_has_reviewer', code: '23514' } }
    remote.users.delete(id)
    return { data: { user: { id } }, error: null }
  },
} } }) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => {
  let id: string | undefined
  return { auth: {
    signInWithPassword: async ({ email }: { email: string }) => {
      remote.events.push(`login:${email}`)
      id = [...remote.users].find(([, value]) => value === email)?.[0]
      return id ? { data: { user: { id }, session: { access_token: 'synthetic-test-token' } }, error: null }
        : { data: { user: null, session: null }, error: { message: 'deleted actor cannot log in', code: 'invalid_credentials' } }
    },
    getUser: async () => ({ data: { user: { id } }, error: null }),
    signOut: async ({ scope }: { scope: string }) => {
      remote.events.push(`signout:${id}:${scope}`)
      return { error: remote.signoutError ? { message: 'signout failed', code: 'unexpected_failure' } : null }
    },
  } }
} }))

type Actor = { userId: string; email: string; cleanedAt?: string }
let directory: string
let actors: Record<string, Actor>
let originalArgv: string[]
const readActors = () => JSON.parse(readFileSync(resolve(directory, 'fixtures.json'), 'utf8')).actors as Record<string, Actor>
const saveManifest = () => writeFileSync(resolve(directory, 'fixtures.json'), JSON.stringify({ runId: 'cleanup-test', targetOrigin: 'https://brpozobkoatabctjjadc.supabase.co', password: 'synthetic-only', actors }), { mode: 0o600 })
const cleanup = () => import('../../scripts/hosted-scenarios.mjs')
const deleted = () => remote.events.filter(value => value.startsWith('delete:')).map(value => value.slice(7))

beforeEach(() => {
  vi.resetModules()
  directory = realpathSync(mkdtempSync(resolve(tmpdir(), 'serenia-cleanup-test-')))
  actors = Object.fromEntries(['patient', 'foreign', 'browser', 'clinician', 'restart', 'cron'].map((name, index) => [name, {
    userId: `00000000-0000-4000-8000-00000000000${index + 1}`, email: `serenia-task7-cleanup-test-${name}@example.test`,
  }]))
  remote.users = new Map(Object.values(actors).map(a => [a.userId, a.email]))
  remote.events = []; remote.lookupError = null; remote.ambiguousAbsence = false; remote.signoutError = false; remote.deleteError = false
  saveManifest()
  writeFileSync(resolve(directory, 'runtime.json'), JSON.stringify({ pid: 3210 }), { mode: 0o600 })
  originalArgv = process.argv; process.argv = ['node', 'hosted-scenarios.mjs', 'cleanup']
  vi.stubEnv('SERENIA_ACCEPTANCE_DIR', directory)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://brpozobkoatabctjjadc.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://127.0.0.1:3000')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test')
  vi.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error('absent'), { code: 'ESRCH' }) })
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  process.argv = originalArgv; vi.restoreAllMocks(); vi.unstubAllEnvs()
  rmSync(directory, { recursive: true, force: true })
})

describe('scoped hosted cleanup', () => {
  it('deletes every patient before the reviewer and marks only after global signout and deletion', async () => {
    await cleanup()
    expect(deleted()).toEqual(['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004'])
    for (const a of Object.values(readActors())) {
      expect(a.cleanedAt).toMatch(/^\d{4}-/)
      expect(remote.events.indexOf(`signout:${a.userId}:global`)).toBeLessThan(remote.events.indexOf(`delete:${a.userId}`))
    }
    expect(remote.users.size).toBe(0)
  })
  it('resumes three durably cleaned IDs only after exact absence checks, preserving their timestamps', async () => {
    for (const name of ['patient', 'foreign', 'browser']) {
      actors[name].cleanedAt = '2026-10-25T07:28:00.000Z'; remote.users.delete(actors[name].userId)
    }
    saveManifest(); await cleanup()
    expect(remote.events.slice(0, 3)).toEqual(['lookup:00000000-0000-4000-8000-000000000001', 'lookup:00000000-0000-4000-8000-000000000002', 'lookup:00000000-0000-4000-8000-000000000003'])
    expect(deleted()).toEqual(['00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004'])
    for (const name of ['patient', 'foreign', 'browser']) expect(readActors()[name].cleanedAt).toBe('2026-10-25T07:28:00.000Z')
  })
  it('blocks an inconsistent cleaned marker before deleting any remaining actor', async () => {
    actors.browser.cleanedAt = '2026-10-25T07:28:00.000Z'; saveManifest()
    await expect(cleanup()).rejects.toThrow(/absent/)
    expect(deleted()).toEqual([]); expect(remote.users.size).toBe(6)
  })
  it.each([
    { status: 500, code: 'unexpected_failure', message: 'lookup failed' },
    { status: 404, code: 'other_error', message: 'not verified absent' },
  ])('propagates unverified lookup failure $code without deleting', async error => {
    actors.patient.cleanedAt = '2026-10-25T07:28:00.000Z'; remote.users.delete(actors.patient.userId); saveManifest()
    remote.lookupError = error
    await expect(cleanup()).rejects.toThrow()
    expect(remote.events).toEqual([`lookup:${actors.patient.userId}`]); expect(readActors()).toEqual(actors)
  })
  it('does not infer absence from a successful null lookup', async () => {
    actors.patient.cleanedAt = '2026-10-25T07:28:00.000Z'; remote.users.delete(actors.patient.userId); saveManifest(); remote.ambiguousAbsence = true
    await expect(cleanup()).rejects.toThrow(/absent/)
    expect(deleted()).toEqual([])
  })
  it.each(['EPERM', 'EACCES'])('fails closed on a PID probe %s before Auth access', async code => {
    vi.mocked(process.kill).mockImplementation(() => { throw Object.assign(new Error(code), { code }) })
    await expect(cleanup()).rejects.toThrow(code)
    expect(remote.events).toEqual([]); expect(readActors()).toEqual(actors)
  })
  it('blocks a live recorded runtime', async () => {
    vi.mocked(process.kill).mockReturnValue(true)
    await expect(cleanup()).rejects.toThrow(/Stop only/)
    expect(remote.events).toEqual([])
  })
  it.each(['signout', 'delete'])('does not falsely mark an actor when %s fails', async failure => {
    remote.signoutError = failure === 'signout'; remote.deleteError = failure === 'delete'
    await expect(cleanup()).rejects.toThrow(`${failure} failed`)
    expect(readActors()).toEqual(actors)
    expect(remote.users.size).toBe(6)
  })
  it('retains fixture validation before any delete', async () => {
    actors.patient.email = 'unrelated@example.test'; saveManifest()
    await expect(cleanup()).rejects.toThrow(/Recorded generated fixture/)
    expect(remote.events).toEqual([])
  })
  it('handles the separate restart-only state after ESRCH', async () => {
    actors = { restart: actors.restart }; remote.users = new Map([[actors.restart.userId, actors.restart.email]]); saveManifest()
    await cleanup()
    expect(deleted()).toEqual(['00000000-0000-4000-8000-000000000005'])
    expect(readActors().restart.cleanedAt).toBeDefined()
  })
})
