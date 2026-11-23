import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { getOpenSessionRiskSignals, OPEN_RISK_SIGNAL_LIMIT } from '@/lib/server/clinician/open-risk'

type Call = { table: string; method: string; args: unknown[] }
type Result = { data: unknown; error: unknown }

/** Minimal chainable fake: records every filter and resolves per table. */
function fakeSupabase(results: Record<string, Result>) {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'in', 'not', 'order', 'limit']) {
        builder[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return builder }
      }
      builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject)
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

const event = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1', user_id: 'u1', session_id: 's1', risk_type: 'suicidal_ideation', severity: 'critical', created_at: '2026-11-23T10:00:00.000Z', ...overrides,
})

describe('getOpenSessionRiskSignals', () => {
  it('returns high and critical open events whose session is still open', async () => {
    const { client, calls } = fakeSupabase({
      risk_events: { data: [event(), event({ id: 'e2', user_id: 'u2', session_id: 's2', severity: 'high', risk_type: 'self_harm' })], error: null },
      clinical_sessions: { data: [{ id: 's1', user_id: 'u1', last_activity_at: '2026-11-23T10:05:00.000Z' }, { id: 's2', user_id: 'u2', last_activity_at: '2026-11-23T09:00:00.000Z' }], error: null },
      user_profiles: { data: [{ user_id: 'u1', display_name: 'Synthetic One', informal_name: null }], error: null },
    })

    expect(await getOpenSessionRiskSignals(client)).toEqual([
      { eventId: 'e1', userId: 'u1', sessionId: 's1', displayName: 'Synthetic One', riskType: 'suicidal_ideation', severity: 'critical', createdAt: '2026-11-23T10:00:00.000Z', lastActivityAt: '2026-11-23T10:05:00.000Z' },
      { eventId: 'e2', userId: 'u2', sessionId: 's2', displayName: null, riskType: 'self_harm', severity: 'high', createdAt: '2026-11-23T10:00:00.000Z', lastActivityAt: '2026-11-23T09:00:00.000Z' },
    ])
    expect(calls).toContainEqual({ table: 'risk_events', method: 'eq', args: ['status', 'open'] })
    expect(calls).toContainEqual({ table: 'risk_events', method: 'in', args: ['severity', ['high', 'critical']] })
    expect(calls).toContainEqual({ table: 'risk_events', method: 'limit', args: [OPEN_RISK_SIGNAL_LIMIT] })
    expect(calls).toContainEqual({ table: 'clinical_sessions', method: 'eq', args: ['status', 'open'] })
    expect(calls).toContainEqual({ table: 'clinical_sessions', method: 'in', args: ['id', ['s1', 's2']] })
  })

  it('drops events whose session already closed, since the inbox covers those', async () => {
    const { client } = fakeSupabase({
      risk_events: { data: [event(), event({ id: 'e2', session_id: 's-closed' })], error: null },
      clinical_sessions: { data: [{ id: 's1', user_id: 'u1', last_activity_at: '2026-11-23T10:05:00.000Z' }], error: null },
    })
    expect((await getOpenSessionRiskSignals(client)).map(signal => signal.eventId)).toEqual(['e1'])
  })

  it('drops an event whose session belongs to another patient', async () => {
    const { client } = fakeSupabase({
      risk_events: { data: [event()], error: null },
      clinical_sessions: { data: [{ id: 's1', user_id: 'someone-else', last_activity_at: '2026-11-23T10:05:00.000Z' }], error: null },
    })
    expect(await getOpenSessionRiskSignals(client)).toEqual([])
  })

  it('skips the follow-up reads when there are no events', async () => {
    const { client, calls } = fakeSupabase({ risk_events: { data: [], error: null } })
    expect(await getOpenSessionRiskSignals(client)).toEqual([])
    expect(calls.every(call => call.table === 'risk_events')).toBe(true)
  })

  it.each(['risk_events', 'clinical_sessions', 'user_profiles'])('throws when the %s read fails so the page can say so', async failing => {
    const results: Record<string, Result> = {
      risk_events: { data: [event()], error: null },
      clinical_sessions: { data: [{ id: 's1', user_id: 'u1', last_activity_at: '2026-11-23T10:05:00.000Z' }], error: null },
      user_profiles: { data: [], error: null },
    }
    results[failing] = { data: null, error: new Error('synthetic failure') }
    await expect(getOpenSessionRiskSignals(fakeSupabase(results).client)).rejects.toThrow('synthetic failure')
  })
})
