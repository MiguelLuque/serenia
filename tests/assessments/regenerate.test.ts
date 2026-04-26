import { describe, it, expect, vi } from 'vitest'
import {
  prepareRegeneration,
  rollbackRegeneration,
} from '@/lib/assessments/regenerate'

// ── Supabase mock helpers ──────────────────────────────────────────────────
//
// The chain shapes we have to support:
//
//   prepareRegeneration:
//     supabase.from('assessments').select(...).eq('id', id).maybeSingle()
//     supabase.from('assessments').update({ status:'superseded' })
//       .eq('id', id).in('status', [...]).select('id')   // awaitable → { data, error }
//
//   rollbackRegeneration:
//     supabase.from('assessments').update({ status: original })
//       .eq('id', id).eq('status', 'superseded')          // awaitable → { data, error }

type FetchSpec = { data: unknown; error: unknown }
type UpdateSpec = { data?: unknown; error: unknown }

type UpdateEntry = {
  payload: unknown
  eqArgs: unknown[][]
  inArgs: unknown[][]
  selectArgs: unknown[][]
}

type Calls = {
  selects: { eqArgs: unknown[][] }[]
  updates: UpdateEntry[]
}

function makeSupabase({
  fetch: fetchSpec = { data: null, error: null } as FetchSpec,
  update: updateSpec = { data: [{ id: 'a-1' }], error: null } as UpdateSpec,
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
      const entry: UpdateEntry = {
        payload: undefined,
        eqArgs: [],
        inArgs: [],
        selectArgs: [],
      }
      const result = () =>
        Promise.resolve({
          data: updateSpec.data ?? null,
          error: updateSpec.error,
        })

      // The chain must be both chainable (supports .eq().in().select()) AND
      // awaitable at any node, because rollbackRegeneration ends on `.eq(…)`
      // (no `.select`) while prepareRegeneration ends on `.select('id')`.
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn((...args: unknown[]) => {
        entry.eqArgs.push(args)
        return chain
      })
      chain.in = vi.fn((...args: unknown[]) => {
        entry.inArgs.push(args)
        return chain
      })
      chain.select = vi.fn((...args: unknown[]) => {
        entry.selectArgs.push(args)
        return chain
      })
      ;(chain as { then: unknown }).then = (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => result().then(resolve, reject)

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
  it('captures rejectionContext + originalStatus and marks the rejected row as superseded conditionally', async () => {
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
      update: { data: [{ id: 'a-1' }], error: null },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prepareRegeneration(supabase as any, 'a-1')

    expect(result).toEqual({
      sessionId: 'session-1',
      originalStatus: 'rejected',
      rejectionContext: {
        rejectionReason: 'No refleja la transcripción.',
        clinicalNotes: 'Paciente describió duelo reciente.',
      },
    })

    // UPDATE was issued, marking superseded with the conditional clause
    expect(calls.updates).toHaveLength(1)
    const [updateEntry] = calls.updates
    expect(updateEntry.payload).toEqual({ status: 'superseded' })
    expect(updateEntry.eqArgs[0]).toEqual(['id', 'a-1'])
    // Salvedad #1: the conditional `.in('status', [...])` guard MUST be present
    expect(updateEntry.inArgs).toHaveLength(1)
    const [statusCol, statusArr] = updateEntry.inArgs[0]
    expect(statusCol).toBe('status')
    expect(statusArr).toEqual(
      expect.arrayContaining(['rejected', 'requires_manual_review']),
    )
    // …and the call must round-trip the rows so we can detect race-losers
    expect(updateEntry.selectArgs).toHaveLength(1)
  })

  it('accepts requires_manual_review as a regenerable status and returns originalStatus', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: {
        data: {
          id: 'a-mr-1',
          session_id: 'session-mr-1',
          status: 'requires_manual_review',
          // Workflow placeholder rows have no rejection_reason / clinical_notes
          rejection_reason: null,
          clinical_notes: null,
        },
        error: null,
      },
      update: { data: [{ id: 'a-mr-1' }], error: null },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prepareRegeneration(supabase as any, 'a-mr-1')

    expect(result.sessionId).toBe('session-mr-1')
    expect(result.originalStatus).toBe('requires_manual_review')
    // No rejection text — passes through cleanly
    expect(result.rejectionContext).toEqual({
      rejectionReason: '',
      clinicalNotes: null,
    })
    // Still marks the row superseded so assessmentExistsStep proceeds
    expect(calls.updates).toHaveLength(1)
    expect(calls.updates[0].payload).toEqual({ status: 'superseded' })
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
      update: { data: [{ id: 'a-2' }], error: null },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prepareRegeneration(supabase as any, 'a-2')

    expect(result.rejectionContext).toEqual({
      rejectionReason: 'Resumen demasiado breve',
      clinicalNotes: null,
    })
    expect(result.originalStatus).toBe('rejected')
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

  it('throws when status is not regenerable and does not UPDATE', async () => {
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
    ).rejects.toThrow(/rejected.*requires_manual_review/)

    expect(calls.updates).toHaveLength(0)
  })

  it("throws when the row is regenerable but session_id is null", async () => {
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
      update: { data: null, error: { message: 'constraint_fail' } },
    })

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prepareRegeneration(supabase as any, 'a-6'),
    ).rejects.toThrow(/constraint_fail/)

    expect(calls.updates).toHaveLength(1)
  })

  // Salvedad #1 — race between two clinicians clicking Regenerar concurrently.
  // The conditional UPDATE returns zero rows when the row is no longer
  // regenerable; we must throw a user-actionable error and NOT enqueue a
  // second workflow.
  it('throws "ya fue actualizado" when the conditional UPDATE matches zero rows (race-loser)', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      fetch: {
        data: {
          id: 'a-race',
          session_id: 'session-race',
          status: 'rejected',
          rejection_reason: 'motivo',
          clinical_notes: null,
        },
        error: null,
      },
      // Empty array = no rows matched the .in('status', […]) guard because a
      // concurrent caller already flipped the row to 'superseded'.
      update: { data: [], error: null },
    })

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prepareRegeneration(supabase as any, 'a-race'),
    ).rejects.toThrow(/Recarga la página/i)

    // The UPDATE was attempted, just matched nothing
    expect(calls.updates).toHaveLength(1)
  })
})

describe('rollbackRegeneration', () => {
  it('restores the original status conditional on currently being superseded', async () => {
    const calls = makeCalls()
    const supabase = makeSupabase({
      calls,
      update: { data: null, error: null },
    })

    await rollbackRegeneration(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      'a-1',
      'rejected',
    )

    expect(calls.updates).toHaveLength(1)
    const [entry] = calls.updates
    expect(entry.payload).toEqual({ status: 'rejected' })
    // First eq pins by id, second eq guards against double-rollback
    expect(entry.eqArgs).toEqual([
      ['id', 'a-1'],
      ['status', 'superseded'],
    ])
  })

  it('does not throw when the rollback UPDATE itself fails (best-effort)', async () => {
    const calls = makeCalls()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase({
      calls,
      update: { data: null, error: { message: 'rollback_failed' } },
    })

    await expect(
      rollbackRegeneration(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        'a-1',
        'requires_manual_review',
      ),
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
