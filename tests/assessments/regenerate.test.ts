import { describe, it, expect, vi } from 'vitest'
import { prepareRegeneration } from '@/lib/assessments/regenerate'

// ── Supabase mock helpers ──────────────────────────────────────────────────

type FetchSpec = { data: unknown; error: unknown }
type UpdateSpec = { error: unknown }

type Calls = {
  selects: { eqArgs: unknown[][] }[]
  updates: { payload: unknown; eqArgs: unknown[][] }[]
}

function makeSupabase({
  fetch: fetchSpec = { data: null, error: null } as FetchSpec,
  update: updateSpec = { error: null } as UpdateSpec,
  calls,
}: {
  fetch?: FetchSpec
  update?: UpdateSpec
  calls: Calls
}) {
  function makeAssessmentsTable() {
    const selectChain = {
      _eqArgs: [] as unknown[][],
      eq: function (...args: unknown[]) {
        this._eqArgs.push(args)
        return this
      },
      maybeSingle: function () {
        calls.selects.push({ eqArgs: [...this._eqArgs] })
        return Promise.resolve(fetchSpec)
      },
    }

    function makeUpdateChain() {
      const eqArgs: unknown[][] = []
      const entry = { payload: undefined as unknown, eqArgs }
      const chain = {
        eq: vi.fn((...args: unknown[]) => {
          eqArgs.push(args)
          return Promise.resolve({ data: null, error: updateSpec.error })
        }),
      }
      return { chain, entry }
    }

    return {
      select: vi.fn(() => selectChain),
      update: vi.fn((payload: unknown) => {
        const { chain, entry } = makeUpdateChain()
        entry.payload = payload
        calls.updates.push(entry)
        return chain
      }),
    }
  }

  return {
    from: vi.fn((table: string) => {
      if (table === 'assessments') return makeAssessmentsTable()
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

function makeCalls(): Calls {
  return { selects: [], updates: [] }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('prepareRegeneration', () => {
  it('captures rejectionContext and marks the rejected row as superseded', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: {
        data: {
          id: 'a-1',
          session_id: 'session-1',
          status: 'rejected',
          rejection_reason: 'No refleja la transcripción.',
          clinical_notes: 'Paciente describió duelo reciente.',
        },
        error: null,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prepareRegeneration(supabase as any, 'a-1')

    expect(result).toEqual({
      sessionId: 'session-1',
      rejectionContext: {
        rejectionReason: 'No refleja la transcripción.',
        clinicalNotes: 'Paciente describió duelo reciente.',
      },
    })

    // UPDATE was issued, marking superseded
    expect(calls.updates).toHaveLength(1)
    const [updateEntry] = calls.updates
    expect(updateEntry.payload).toEqual({ status: 'superseded' })
    expect(updateEntry.eqArgs[0]).toEqual(['id', 'a-1'])
  })

  it('passes through null clinical_notes when the row has none', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: {
        data: {
          id: 'a-2',
          session_id: 'session-2',
          status: 'rejected',
          rejection_reason: 'Resumen demasiado breve',
          clinical_notes: null,
        },
        error: null,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prepareRegeneration(supabase as any, 'a-2')

    expect(result.rejectionContext).toEqual({
      rejectionReason: 'Resumen demasiado breve',
      clinicalNotes: null,
    })
  })

  it('throws when assessment is not found and does not UPDATE', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: { data: null, error: null },
    })

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prepareRegeneration(supabase as any, 'missing-id'),
    ).rejects.toThrow(/no existe/i)

    expect(calls.updates).toHaveLength(0)
  })

  it("throws when status is not 'rejected' and does not UPDATE", async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: {
        data: {
          id: 'a-3',
          session_id: 'session-3',
          status: 'draft_ai',
          rejection_reason: null,
          clinical_notes: null,
        },
        error: null,
      },
    })

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prepareRegeneration(supabase as any, 'a-3'),
    ).rejects.toThrow(/rejected/)

    expect(calls.updates).toHaveLength(0)
  })

  it('throws when the row is rejected but session_id is null', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: {
        data: {
          id: 'a-4',
          session_id: null,
          status: 'rejected',
          rejection_reason: 'motivo',
          clinical_notes: null,
        },
        error: null,
      },
    })

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prepareRegeneration(supabase as any, 'a-4'),
    ).rejects.toThrow(/sesión/i)

    expect(calls.updates).toHaveLength(0)
  })

  it('surfaces the supabase error message when fetch fails', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: { data: null, error: { message: 'rls_denied' } },
    })

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prepareRegeneration(supabase as any, 'a-5'),
    ).rejects.toThrow(/rls_denied/)

    expect(calls.updates).toHaveLength(0)
  })

  it('surfaces the supabase error message when the UPDATE fails', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: {
        data: {
          id: 'a-6',
          session_id: 'session-6',
          status: 'rejected',
          rejection_reason: 'motivo',
          clinical_notes: null,
        },
        error: null,
      },
      update: { error: { message: 'constraint_fail' } },
    })

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prepareRegeneration(supabase as any, 'a-6'),
    ).rejects.toThrow(/constraint_fail/)

    expect(calls.updates).toHaveLength(1)
  })
})
