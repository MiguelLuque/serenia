import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { buildPatientContext } from '@/lib/server/patient-context/builder'

const NOW = new Date('2026-11-01T12:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString()
const summary = (suicidality = 'none') => ({
  chief_complaint: 'Synthetic', presenting_issues: [], mood_affect: '', cognitive_patterns: [],
  risk_assessment: { suicidality, self_harm: 'none', notes: '' }, questionnaires: [],
  areas_for_exploration: [], preliminary_impression: '', recommended_actions_for_clinician: [],
  patient_facing_summary: '', proposed_tasks: [],
})
type Session = { id: string; user_id: string; status: string; closed_at: string | null }
type Report = Omit<ReturnType<typeof report>, 'observed_session' | 'clinical_sessions' | 'reviewed_at'> & { observed_session: Session; clinical_sessions: Session; reviewed_at: string | null }
function report(id: string, observedDays: number, reviewedDays: number, suicidality = 'none', status = 'reviewed_confirmed') {
  const session = { id: `s-${id}`, user_id: 'u', status: 'closed', closed_at: ago(observedDays) }
  return { id, user_id: 'u', session_id: session.id, assessment_type: 'closure', status,
    reviewed_at: ago(reviewedDays), summary_json: summary(suicidality), observed_session: session,
    clinical_sessions: session }
}
type Event = { user_id: string; status: string; severity: string; risk_type: string; created_at: string }
const event = (severity: string, days: number): Event => ({ user_id: 'u', status: 'open', severity, risk_type: 'suicidal_ideation', created_at: ago(days) })

/** Real SDK; only the external HTTP transport is replaced. Fixtures apply
 * request filters/order/limit so an embedded-only order cannot select B. */
function fixture(options: { reports?: Report[]; events?: Event[]; failSeverity?: string; previous?: { closed_at: string; closure_reason: string } } = {}) {
  const requests: URL[] = []
  const client = createClient<Database>('http://synthetic.invalid', 'synthetic-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input)); requests.push(url)
      const q = url.searchParams
      const table = url.pathname.split('/').at(-1)
      let data: unknown[] = []
      if (table === 'assessments') {
        let rows = (options.reports ?? []).filter(r => `eq.${r.user_id}` === q.get('user_id'))
        const state = q.get('status') ?? ''
        rows = rows.filter(r => state.startsWith('in.') ? state.includes(r.status) : state === `eq.${r.status}`)
        if (q.has('assessment_type')) rows = rows.filter(r => `eq.${r.assessment_type}` === q.get('assessment_type'))
        if (q.has('observed_session.status')) rows = rows.filter(r => `eq.${r.observed_session.status}` === q.get('observed_session.status'))
        if (q.has('observed_session.user_id')) rows = rows.filter(r => `eq.${r.observed_session.user_id}` === q.get('observed_session.user_id'))
        if (q.get('observed_session.closed_at') === 'not.is.null') rows = rows.filter(r => r.observed_session.closed_at !== null)
        if (q.get('reviewed_at') === 'not.is.null') rows = rows.filter(r => r.reviewed_at !== null)
        const order = q.get('order') ?? ''
        rows.sort((a, b) => order.startsWith('observed_session(closed_at)')
          ? (b.observed_session.closed_at ?? '').localeCompare(a.observed_session.closed_at ?? '') || b.session_id.localeCompare(a.session_id) || (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? '')
          : order.startsWith('reviewed_at') ? (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? '') : 0)
        data = rows.slice(0, Number(q.get('limit') ?? 1000))
      } else if (table === 'risk_events') {
        const severity = q.get('severity')?.replace('eq.', '')
        if (severity && options.failSeverity === severity) return new Response(JSON.stringify({ message: 'probe unavailable' }), { status: 400 })
        data = (options.events ?? []).filter(e => `eq.${e.user_id}` === q.get('user_id') && `eq.${e.status}` === q.get('status') && (!severity || severity === e.severity))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, Number(q.get('limit') ?? 1000))
      } else if (table === 'clinical_sessions') data = options.previous ? [options.previous] : []
      else if (table === 'user_profiles') data = [{ display_name: 'Synthetic', birth_date: null, informal_name: '', pronouns: null, reason_for_consulting: null }]
      return new Response(init?.method === 'HEAD' ? null : JSON.stringify(data), {
        status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/2' },
      })
    } },
  })
  return { requests, build: () => buildPatientContext({ supabase: client, userId: 'u', sessionId: 'current', protocolPhase: 2, now: NOW }) }
}

describe('assessment continuity through the installed PostgREST client', () => {
  it('retains an open critical hidden by ten newer noncritical details', async () => {
    const f = fixture({ events: [event('critical', 2), ...Array.from({ length: 10 }, (_, i) => event('high', i / 20))] })
    const ctx = await f.build()
    expect(ctx.riskState).toBe('acute')
    expect(ctx.openRiskEvents).toHaveLength(10)
    const reads = f.requests.filter(u => u.pathname.endsWith('/risk_events'))
    expect(reads.map(u => [u.searchParams.get('severity'), u.searchParams.get('limit')])).toEqual([[null, '10'], ['eq.critical', '1'], ['eq.high', '1']])
    expect(reads.every(u => u.searchParams.get('user_id') === 'eq.u' && u.searchParams.get('status') === 'eq.open')).toBe(true)
  })
  it('retains the global latest high hidden by ten newer moderate details', async () => {
    const f = fixture({ events: [event('high', 2), ...Array.from({ length: 10 }, (_, i) => event('moderate', i / 20))] })
    expect((await f.build()).riskState).toBe('watch')
  })
  it.each(['critical', 'high'])('fails closed when the global %s probe fails', async severity => {
    await expect(fixture({ failSeverity: severity }).build()).rejects.toMatchObject({ message: 'probe unavailable' })
  })
  it('keeps global latestOpen semantics and excludes foreign/closed events', async () => {
    const f = fixture({ reports: [report('a', 5, 0)], previous: { closed_at: ago(6), closure_reason: 'crisis_detected' },
      events: [event('moderate', 2), { ...event('critical', 1), user_id: 'foreign' }, { ...event('critical', 1), status: 'resolved' }] })
    expect((await f.build()).riskState).toBe('watch')
  })
  it('a late confirmation of A does not displace the later observed active session B', async () => {
    const f = fixture({ reports: [report('a', 120, 0), report('b', 2, 1, 'active')] })
    const ctx = await f.build()
    expect(ctx.validated).toMatchObject({ id: 'b', observedAt: ago(2), reviewedAt: ago(1), ageInDays: 2 })
    expect(ctx.riskState).toBe('active')
    const request = f.requests.find(u => u.pathname.endsWith('/assessments') && u.searchParams.get('status')?.startsWith('in.'))!
    expect(request.searchParams.get('order')).toBe('observed_session(closed_at).desc.nullslast,session_id.desc,reviewed_at.desc,id.desc')
    expect(request.searchParams.has('observed_session.order')).toBe(false)
    expect(request.searchParams.get('assessment_type')).toBe('eq.closure')
    expect(request.searchParams.get('observed_session.status')).toBe('eq.closed')
    expect(request.searchParams.get('observed_session.user_id')).toBe('eq.u')
  })
  it('excludes reviewed rows without closed owned closure observations', async () => {
    const rows: Report[] = [report('valid', 2, 1, 'active'), ...['open', 'nonclosure', 'foreign-session', 'foreign-report', 'missing-date', 'missing-review'].map(id => report(id, 0, 0))]
    rows[1].observed_session.status = 'open'
    rows[2].assessment_type = 'intake'
    rows[3].observed_session.user_id = 'foreign'
    rows[4].user_id = 'foreign'
    rows[5].observed_session.closed_at = null
    rows[6].reviewed_at = null
    const ctx = await fixture({ reports: rows }).build()
    expect(ctx.validated?.id).toBe('valid')
    expect(ctx.riskState).toBe('active')
  })
  it('a late review preserves historic age and cannot clear a later high event', async () => {
    const f = fixture({ reports: [report('a', 120, 0)], events: [event('high', 2)] })
    const ctx = await f.build()
    expect(ctx.tier).toBe('historic')
    expect(ctx.validated).toMatchObject({ observedAt: ago(120), reviewedAt: ago(0), ageInDays: 120 })
    expect(ctx.riskState).toBe('watch')
  })
  it('a recent-session none reviewed today cannot clear a high after its observation', async () => {
    const ctx = await fixture({ reports: [report('a', 10, 0)], events: [event('high', 2)] }).build()
    expect(ctx.riskState).toBe('watch')
  })
  it('orders draft parents by observation too, excluding nonclosure and open-session drafts', async () => {
    const open = report('open', 0, 0, 'none', 'draft_ai'); open.observed_session.status = 'open'
    const nonclosure = report('other', 0, 0, 'none', 'draft_ai'); nonclosure.assessment_type = 'intake'
    const f = fixture({ reports: [report('a', 10, 0, 'none', 'draft_ai'), report('b', 2, 1, 'none', 'draft_ai'), open, nonclosure] })
    const ctx = await f.build()
    expect(ctx.tierBDraft?.closedAt).toBe(ago(2))
  })
})
