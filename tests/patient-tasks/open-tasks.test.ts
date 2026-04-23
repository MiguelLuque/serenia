import { describe, it, expect, vi } from 'vitest'
import { getPatientOpenTasks } from '@/lib/patient-tasks/open-tasks'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type TaskRow = {
  id: string
  descripcion: string
  created_at: string
  acordada_en_session_id: string
  estado: 'pendiente' | 'parcial' | 'cumplida' | 'no_realizada' | 'no_abordada'
  user_id: string
}

/**
 * Chain-builder Supabase mock mirroring the style in
 * tests/clinician/inbox.test.ts. Only implements the call shapes
 * getPatientOpenTasks exercises.
 */
function makeSupabase(rows: TaskRow[]) {
  // Spies exposed at the top level so tests can assert call arguments.
  const spies = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  }

  function makeChain(tableName: string) {
    const state: {
      filters: Array<{ op: string; col: string; val: unknown }>
      order: { col: string; asc: boolean } | null
      limitVal: number | null
    } = { filters: [], order: null, limitVal: null }

    const resolver = () => {
      let data: TaskRow[] = []
      if (tableName === 'patient_tasks') {
        data = rows.filter((r) => {
          return state.filters.every((f) => {
            if (f.op === 'eq' && f.col === 'user_id') return r.user_id === f.val
            if (f.op === 'in' && f.col === 'estado') {
              return (f.val as string[]).includes(r.estado)
            }
            return true
          })
        })
      }

      if (state.order) {
        const { col, asc } = state.order
        data = [...data].sort((a, b) => {
          const av = (a as unknown as Record<string, string>)[col] ?? ''
          const bv = (b as unknown as Record<string, string>)[col] ?? ''
          return asc ? av.localeCompare(bv) : bv.localeCompare(av)
        })
      }

      if (state.limitVal !== null) {
        data = data.slice(0, state.limitVal)
      }

      return Promise.resolve({ data, error: null })
    }

    const chain: Record<string, unknown> = {}
    chain.select = vi.fn((arg?: string) => {
      spies.select(arg)
      return chain
    })
    chain.eq = vi.fn((col: string, val: unknown) => {
      spies.eq(col, val)
      state.filters.push({ op: 'eq', col, val })
      return chain
    })
    chain.in = vi.fn((col: string, val: unknown) => {
      spies.in(col, val)
      state.filters.push({ op: 'in', col, val })
      return chain
    })
    chain.order = vi.fn((col: string, opts?: { ascending?: boolean }) => {
      spies.order(col, opts)
      state.order = { col, asc: opts?.ascending ?? true }
      return chain
    })
    chain.limit = vi.fn((n: number) => {
      spies.limit(n)
      state.limitVal = n
      return chain
    })
    chain.then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => resolver().then(onFulfilled, onRejected)
    return chain
  }

  const client = {
    from: vi.fn((table: string) => {
      spies.from(table)
      return makeChain(table)
    }),
  } as unknown as SupabaseClient<Database>

  return { client, spies }
}

describe('getPatientOpenTasks', () => {
  const USER_ID = 'user-a'

  it('returns empty array when no rows match', async () => {
    const { client } = makeSupabase([])
    const result = await getPatientOpenTasks(client, USER_ID)
    expect(result).toEqual([])
  })

  it("filters out estados 'cumplida', 'no_realizada' and 'no_abordada' via .in()", async () => {
    const rows: TaskRow[] = [
      {
        id: 't1',
        descripcion: 'Escribir un diario',
        created_at: '2026-04-18T10:00:00.000Z',
        acordada_en_session_id: 's1',
        estado: 'pendiente',
        user_id: USER_ID,
      },
      {
        id: 't2',
        descripcion: 'Ya cumplida',
        created_at: '2026-04-15T10:00:00.000Z',
        acordada_en_session_id: 's1',
        estado: 'cumplida',
        user_id: USER_ID,
      },
      {
        id: 't3',
        descripcion: 'No realizada',
        created_at: '2026-04-14T10:00:00.000Z',
        acordada_en_session_id: 's1',
        estado: 'no_realizada',
        user_id: USER_ID,
      },
      {
        id: 't4',
        descripcion: 'No abordada',
        created_at: '2026-04-13T10:00:00.000Z',
        acordada_en_session_id: 's1',
        estado: 'no_abordada',
        user_id: USER_ID,
      },
    ]
    const { client, spies } = makeSupabase(rows)

    const result = await getPatientOpenTasks(client, USER_ID)

    // Only the pendiente task survives.
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')

    // And the .in() filter was called with exactly the open-estado set.
    expect(spies.in).toHaveBeenCalledWith('estado', ['pendiente', 'parcial'])
  })

  it('maps row shape to PatientOpenTask', async () => {
    const rows: TaskRow[] = [
      {
        id: 't1',
        descripcion: 'Salir a caminar 20 minutos',
        created_at: '2026-04-18T10:00:00.000Z',
        acordada_en_session_id: 'sess-42',
        estado: 'parcial',
        user_id: USER_ID,
      },
    ]
    const { client } = makeSupabase(rows)

    const [task] = await getPatientOpenTasks(client, USER_ID)

    expect(task).toEqual({
      id: 't1',
      descripcion: 'Salir a caminar 20 minutos',
      createdAt: '2026-04-18T10:00:00.000Z',
      acordadaEnSessionId: 'sess-42',
      estado: 'parcial',
    })
  })

  it('orders by created_at descending (newest first)', async () => {
    const rows: TaskRow[] = [
      {
        id: 'old',
        descripcion: 'Antiguo',
        created_at: '2026-04-10T10:00:00.000Z',
        acordada_en_session_id: 's1',
        estado: 'pendiente',
        user_id: USER_ID,
      },
      {
        id: 'new',
        descripcion: 'Nuevo',
        created_at: '2026-04-20T10:00:00.000Z',
        acordada_en_session_id: 's2',
        estado: 'pendiente',
        user_id: USER_ID,
      },
      {
        id: 'mid',
        descripcion: 'Medio',
        created_at: '2026-04-15T10:00:00.000Z',
        acordada_en_session_id: 's3',
        estado: 'parcial',
        user_id: USER_ID,
      },
    ]
    const { client, spies } = makeSupabase(rows)

    const result = await getPatientOpenTasks(client, USER_ID)

    expect(result.map((t) => t.id)).toEqual(['new', 'mid', 'old'])
    expect(spies.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('limits results to 20', async () => {
    const { client, spies } = makeSupabase([])
    await getPatientOpenTasks(client, USER_ID)
    expect(spies.limit).toHaveBeenCalledWith(20)
  })

  it('scopes the query by user_id', async () => {
    const rows: TaskRow[] = [
      {
        id: 't1',
        descripcion: 'Mía',
        created_at: '2026-04-18T10:00:00.000Z',
        acordada_en_session_id: 's1',
        estado: 'pendiente',
        user_id: USER_ID,
      },
      {
        id: 't2',
        descripcion: 'De otro',
        created_at: '2026-04-19T10:00:00.000Z',
        acordada_en_session_id: 's9',
        estado: 'pendiente',
        user_id: 'otro-user',
      },
    ]
    const { client, spies } = makeSupabase(rows)

    const result = await getPatientOpenTasks(client, USER_ID)

    expect(spies.eq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(result.map((t) => t.id)).toEqual(['t1'])
  })
})
