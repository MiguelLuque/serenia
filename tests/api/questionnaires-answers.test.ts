import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// =============================================================================
// Plan 8 Bloque 2 Fix 4 — POST /api/questionnaires/[instanceId]/answers
//
// Bug: el handler sólo chequeaba Array.isArray(body.answers); además el catch
// devolvía err.message crudo al cliente filtrando detalle técnico (p.ej.
// "ASQ item 5 value must be 0 or 1"). Ahora usa SubmitAnswersSchema
// (lib/questionnaires/schema.ts) y el catch responde con mensaje genérico.
//
// Estrategia: mock del supabase client + submitAnswers. Construimos
// requests con bodies cuidadosamente malformados y verificamos status code,
// mensaje y ausencia de side-effects.
// =============================================================================

const VALID_INSTANCE_ID = 'aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const submitAnswersMock = vi.fn(async () => ({
  totalScore: 5,
  severityBand: 'mild',
}))

let supabaseStub: {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
}

function makeBuilder(resolvedData: unknown) {
  const builder: Record<string, unknown> = {}
  const passthrough = () => builder
  builder.select = passthrough
  builder.eq = passthrough
  builder.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: resolvedData, error: null })
  return builder
}

beforeEach(() => {
  vi.resetModules()
  submitAnswersMock.mockClear()

  supabaseStub = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn(() =>
      makeBuilder({
        id: VALID_INSTANCE_ID,
        user_id: 'user-1',
        status: 'in_progress',
      }),
    ),
  }

  vi.doMock('@/lib/server/supabase/server', () => ({
    createAuthenticatedClient: async () => supabaseStub,
  }))

  vi.doMock('@/lib/server/questionnaires/service', () => ({
    submitAnswers: submitAnswersMock,
  }))
})

afterEach(() => {
  vi.doUnmock('@/lib/server/supabase/server')
  vi.doUnmock('@/lib/server/questionnaires/service')
})

async function postAnswers(body: unknown): Promise<Response> {
  const { POST } = await import(
    '@/app/api/questionnaires/[instanceId]/answers/route'
  )
  const req = new Request(
    `http://localhost/api/questionnaires/${VALID_INSTANCE_ID}/answers`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  )
  return POST(req, {
    params: Promise.resolve({ instanceId: VALID_INSTANCE_ID }),
  })
}

describe('POST /api/questionnaires/[instanceId]/answers — happy path', () => {
  it('returns 200 with a valid body', async () => {
    const res = await postAnswers({
      answers: [
        { itemOrder: 1, valueNumeric: 2, valueRaw: 'Más de la mitad de los días' },
        { itemOrder: 2, valueNumeric: 1, valueRaw: 'Algunos días' },
      ],
    })
    expect(res.status).toBe(200)
    expect(submitAnswersMock).toHaveBeenCalledTimes(1)
    expect(submitAnswersMock).toHaveBeenCalledWith(supabaseStub, {
      instanceId: VALID_INSTANCE_ID,
      answers: [
        { itemOrder: 1, valueNumeric: 2, valueRaw: 'Más de la mitad de los días' },
        { itemOrder: 2, valueNumeric: 1, valueRaw: 'Algunos días' },
      ],
    })
  })
})

describe('POST /api/questionnaires/[instanceId]/answers — schema validation', () => {
  it('returns 400 when answers is empty', async () => {
    const res = await postAnswers({ answers: [] })
    expect(res.status).toBe(400)
    expect(submitAnswersMock).not.toHaveBeenCalled()
  })

  it('returns 400 when itemOrder is not a number', async () => {
    const res = await postAnswers({
      answers: [{ itemOrder: 'abc', valueNumeric: 1, valueRaw: 'x' }],
    })
    expect(res.status).toBe(400)
    expect(submitAnswersMock).not.toHaveBeenCalled()
  })

  it('returns 400 when valueNumeric is negative', async () => {
    const res = await postAnswers({
      answers: [{ itemOrder: 1, valueNumeric: -1, valueRaw: 'x' }],
    })
    expect(res.status).toBe(400)
    expect(submitAnswersMock).not.toHaveBeenCalled()
  })

  it('returns 400 when valueNumeric is null', async () => {
    const res = await postAnswers({
      answers: [{ itemOrder: 1, valueNumeric: null, valueRaw: 'x' }],
    })
    expect(res.status).toBe(400)
    expect(submitAnswersMock).not.toHaveBeenCalled()
  })

  it('returns 400 when valueRaw is missing', async () => {
    const res = await postAnswers({
      answers: [{ itemOrder: 1, valueNumeric: 1 }],
    })
    expect(res.status).toBe(400)
    expect(submitAnswersMock).not.toHaveBeenCalled()
  })

  it('returns 400 when answers contains 100 items (over the cap)', async () => {
    const tooMany = Array.from({ length: 100 }, (_, i) => ({
      itemOrder: i + 1,
      valueNumeric: 1,
      valueRaw: 'x',
    }))
    const res = await postAnswers({ answers: tooMany })
    expect(res.status).toBe(400)
    expect(submitAnswersMock).not.toHaveBeenCalled()
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await postAnswers('not-json{')
    expect(res.status).toBe(400)
    expect(submitAnswersMock).not.toHaveBeenCalled()
  })

  it('returns generic error message — does NOT leak validation detail', async () => {
    const res = await postAnswers({ answers: [{ itemOrder: 'abc' }] })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Solicitud inválida' })
  })
})

describe('POST /api/questionnaires/[instanceId]/answers — error message no-leak', () => {
  it('does NOT leak the technical message from submitAnswers when it throws', async () => {
    // submitAnswers throws an internal-detail error. The pre-fix handler
    // returned err.message verbatim; the post-fix handler returns a
    // generic message.
    submitAnswersMock.mockRejectedValueOnce(
      new Error('ASQ item 5 value must be 0 or 1'),
    )

    const res = await postAnswers({
      answers: [{ itemOrder: 5, valueNumeric: 0, valueRaw: 'No' }],
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    // Generic — internal detail does NOT bleed through.
    expect(body).toEqual({ error: 'No se pudo procesar el cuestionario' })
    expect(JSON.stringify(body)).not.toContain('ASQ')
    expect(JSON.stringify(body)).not.toContain('item 5')
  })
})
