import { describe, it, expect, vi } from 'vitest'
import { getPatientDetail } from '@/lib/clinician/patient'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Fixture = {
  profile: { user_id: string; display_name: string | null; birth_date: string | null } | null
  questionnaireInstances: unknown[]
  riskEvents: unknown[]
  sessions: unknown[]
  assessments: unknown[]
  patientTasks: Array<{
    id: string
    user_id: string
    descripcion: string
    nota: string | null
    estado: string
    acordada_en_session_id: string
    updated_at: string
  }>
}

function makeSupabase(fixture: Fixture) {
  function makeChain(table: string) {
    const state: {
      filters: Array<{ op: string; col: string; val: unknown }>
      order: { col: string; asc: boolean } | null
    } = { filters: [], order: null }

    const resolver = () => {
      let data: unknown = []
      if (table === 'user_profiles') {
        data = fixture.profile
      } else if (table === 'questionnaire_instances') {
        data = fixture.questionnaireInstances
      } else if (table === 'risk_events') {
        data = fixture.riskEvents
      } else if (table === 'clinical_sessions') {
        data = fixture.sessions
      } else if (table === 'assessments') {
        data = fixture.assessments
      } else if (table === 'patient_tasks') {
        data = fixture.patientTasks.filter((t) =>
          state.filters.every((f) => {
            if (f.op === 'eq' && f.col === 'user_id') return t.user_id === f.val
            if (f.op === 'in' && f.col === 'estado')
              return (f.val as string[]).includes(t.estado)
            return true
          }),
        )
        if (state.order) {
          const { col, asc } = state.order
          data = [...(data as Array<Record<string, unknown>>)].sort((a, b) => {
            const av = (a[col] ?? '') as string
            const bv = (b[col] ?? '') as string
            return asc ? av.localeCompare(bv) : bv.localeCompare(av)
          })
        }
      }
      return Promise.resolve({ data, error: null })
    }

    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'eq', col, val })
      return chain
    })
    chain.neq = vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'neq', col, val })
      return chain
    })
    chain.in = vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'in', col, val })
      return chain
    })
    chain.order = vi.fn((col: string, opts?: { ascending?: boolean }) => {
      state.order = { col, asc: opts?.ascending ?? true }
      return chain
    })
    chain.limit = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(() =>
      resolver().then((r) => ({
        data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data,
        error: null,
      })),
    )
    chain.then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => resolver().then(onFulfilled, onRejected)
    return chain
  }

  return {
    from: vi.fn((table: string) => makeChain(table)),
  } as unknown as SupabaseClient<Database>
}

describe('getPatientDetail — openTasks (T11)', () => {
  it('returns only pendiente/parcial tasks, sorted newest first by updated_at', async () => {
    const fixture: Fixture = {
      profile: { user_id: 'user-1', display_name: 'Ada', birth_date: null },
      questionnaireInstances: [],
      riskEvents: [],
      sessions: [],
      assessments: [],
      patientTasks: [
        {
          id: 't1',
          user_id: 'user-1',
          descripcion: 'Respiración diafragmática',
          nota: '5 min diarios',
          estado: 'pendiente',
          acordada_en_session_id: 'sess-1',
          updated_at: '2026-04-10T09:00:00.000Z',
        },
        {
          id: 't2',
          user_id: 'user-1',
          descripcion: 'Registro de pensamientos',
          nota: null,
          estado: 'parcial',
          acordada_en_session_id: 'sess-2',
          updated_at: '2026-04-20T09:00:00.000Z',
        },
        {
          id: 't3',
          user_id: 'user-1',
          descripcion: 'Higiene del sueño',
          nota: null,
          estado: 'cumplida',
          acordada_en_session_id: 'sess-1',
          updated_at: '2026-04-22T09:00:00.000Z',
        },
      ],
    }
    const supabase = makeSupabase(fixture)
    const detail = await getPatientDetail(supabase, 'user-1')

    expect(detail.openTasks).toHaveLength(2)
    // Newest first by updated_at
    expect(detail.openTasks[0]!.id).toBe('t2')
    expect(detail.openTasks[1]!.id).toBe('t1')
    // Carries session link for the UI
    expect(detail.openTasks[0]!.acordadaEnSessionId).toBe('sess-2')
    expect(detail.openTasks[0]!.estado).toBe('parcial')
  })

  it('returns an empty openTasks array when the patient has no open tasks', async () => {
    const fixture: Fixture = {
      profile: { user_id: 'user-1', display_name: 'Ada', birth_date: null },
      questionnaireInstances: [],
      riskEvents: [],
      sessions: [],
      assessments: [],
      patientTasks: [],
    }
    const supabase = makeSupabase(fixture)
    const detail = await getPatientDetail(supabase, 'user-1')
    expect(detail.openTasks).toEqual([])
  })
})
