import { describe, it, expect, vi } from 'vitest'
import {
  textContainsSafetyCheck,
  hasPriorSafetyCheck,
} from '@/lib/chat/safety-check-history'
import {
  textContainsFarewell,
  detectFarewellWithoutCloseTool,
} from '@/lib/chat/farewell-detector'

// =============================================================================
// Plan 7 T3 — Tests heurísticos auxiliares.
//
// Este archivo cubre:
//   3a — `textContainsSafetyCheck` regex unitario.
//   3a — `hasPriorSafetyCheck` (heurística sobre messages.parts) — @deprecated
//        pero conservada porque `safety-state.ts` reusa `textContainsSafetyCheck`
//        en su fallback heurístico textual.
//   3c — `detectFarewellWithoutCloseTool` heurística + warn en onFinish.
//   3b/3c/3e — el prompt de session-therapist contiene las nuevas secciones
//              vinculantes y se carga sin errores.
//
// Las variantes integradas del crisisNotice (T3a v2) viven en
// `tests/chat/safety-flow.test.ts` (POST /api/chat con `getSessionSafetyState`
// y `buildCrisisNotice` integrados).
// =============================================================================

// ── Helpers compartidos ─────────────────────────────────────────────────────

function makeBuilder(resolvedData: unknown) {
  const builder: Record<string, unknown> = {}
  const passthrough = () => builder
  builder.select = passthrough
  builder.eq = passthrough
  builder.gt = passthrough
  builder.gte = passthrough
  builder.in = passthrough
  builder.order = passthrough
  builder.limit = passthrough
  builder.single = vi.fn().mockResolvedValue({ data: resolvedData, error: null })
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: resolvedData, error: null })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(builder as any).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: resolvedData, error: null, count: 0 }).then(onFulfilled)
  return builder
}

// =============================================================================
// 3a — textContainsSafetyCheck (regex unitario)
// =============================================================================

describe('textContainsSafetyCheck', () => {
  it('matchea "Línea 024" (con y sin tilde)', () => {
    expect(textContainsSafetyCheck('llama a la Línea 024 si lo necesitas')).toBe(true)
    expect(textContainsSafetyCheck('linea 024')).toBe(true)
  })

  it('matchea "estás a salvo" (variante con/sin tilde)', () => {
    expect(textContainsSafetyCheck('quiero asegurarme de que estás a salvo')).toBe(true)
    expect(textContainsSafetyCheck('estas a salvo ahora mismo?')).toBe(true)
  })

  it('matchea "hacerte daño" (con y sin tilde)', () => {
    expect(textContainsSafetyCheck('¿estás pensando en hacerte daño?')).toBe(true)
    expect(textContainsSafetyCheck('pensando en hacerte dano')).toBe(true)
  })

  it('matchea "pensando en suicidarte"', () => {
    expect(textContainsSafetyCheck('estás pensando en suicidarte ahora?')).toBe(true)
  })

  it('NO matchea conversación neutra', () => {
    expect(textContainsSafetyCheck('cuéntame más sobre tu trabajo')).toBe(false)
    expect(textContainsSafetyCheck('me da pena oír eso')).toBe(false)
    expect(textContainsSafetyCheck('')).toBe(false)
  })
})

// =============================================================================
// 3a — hasPriorSafetyCheck (consulta a messages)
// =============================================================================

describe('hasPriorSafetyCheck', () => {
  it('devuelve true cuando un mensaje assistant previo contiene "Línea 024"', async () => {
    const supabase = {
      from: vi.fn(() =>
        makeBuilder([
          {
            parts: [
              { type: 'text', text: 'Si lo necesitas, llama a la Línea 024.' },
            ],
          },
        ]),
      ),
    } as unknown as Parameters<typeof hasPriorSafetyCheck>[0]

    const result = await hasPriorSafetyCheck(supabase, 'session-1')
    expect(result).toBe(true)
  })

  it('devuelve true cuando un mensaje assistant previo pregunta "estás a salvo"', async () => {
    const supabase = {
      from: vi.fn(() =>
        makeBuilder([
          {
            parts: [
              {
                type: 'text',
                text: 'Quiero asegurarme de que estás a salvo. ¿Estás pensando en hacerte daño?',
              },
            ],
          },
        ]),
      ),
    } as unknown as Parameters<typeof hasPriorSafetyCheck>[0]

    const result = await hasPriorSafetyCheck(supabase, 'session-1')
    expect(result).toBe(true)
  })

  it('devuelve false cuando ningún mensaje assistant previo contiene safety language', async () => {
    const supabase = {
      from: vi.fn(() =>
        makeBuilder([
          { parts: [{ type: 'text', text: 'cuéntame más sobre eso' }] },
          { parts: [{ type: 'text', text: 'gracias por compartirlo' }] },
        ]),
      ),
    } as unknown as Parameters<typeof hasPriorSafetyCheck>[0]

    const result = await hasPriorSafetyCheck(supabase, 'session-1')
    expect(result).toBe(false)
  })

  it('devuelve false sin assistant messages previos', async () => {
    const supabase = {
      from: vi.fn(() => makeBuilder([])),
    } as unknown as Parameters<typeof hasPriorSafetyCheck>[0]

    const result = await hasPriorSafetyCheck(supabase, 'session-1')
    expect(result).toBe(false)
  })

  it('traga errores de BD y devuelve false (failsafe)', async () => {
    const errorBuilder = makeBuilder(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(errorBuilder as any).then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: new Error('DB hiccup') }).then(onFulfilled)
    const supabase = {
      from: vi.fn(() => errorBuilder),
    } as unknown as Parameters<typeof hasPriorSafetyCheck>[0]

    const result = await hasPriorSafetyCheck(supabase, 'session-1')
    expect(result).toBe(false)
  })
})

// =============================================================================
// 3c — farewell detector
// =============================================================================

describe('textContainsFarewell', () => {
  it('matchea "lo dejamos aquí"', () => {
    expect(textContainsFarewell('Entonces lo dejamos aquí por hoy')).toBe(true)
  })

  it('matchea "cuídate" como palabra completa (no dentro de "cuidatela")', () => {
    expect(textContainsFarewell('cuídate mucho')).toBe(true)
    expect(textContainsFarewell('Gracias. Cuídate.')).toBe(true)
  })

  it('matchea "hasta la próxima"', () => {
    expect(textContainsFarewell('Hasta la próxima sesión')).toBe(true)
  })

  it('matchea "nos vemos"', () => {
    expect(textContainsFarewell('Nos vemos pronto')).toBe(true)
  })

  it('NO matchea texto sin frases de despedida', () => {
    expect(textContainsFarewell('cuéntame más sobre cómo te sientes')).toBe(false)
    expect(textContainsFarewell('')).toBe(false)
  })
})

describe('detectFarewellWithoutCloseTool', () => {
  it('devuelve true: hay despedida pero NO tool de cierre', () => {
    const parts = [
      { type: 'text', text: 'Entonces lo dejamos aquí por hoy. Cuídate.' },
    ] as Parameters<typeof detectFarewellWithoutCloseTool>[0]
    expect(detectFarewellWithoutCloseTool(parts)).toBe(true)
  })

  it('devuelve false: hay despedida Y `confirm_close_session` invocado', () => {
    const parts = [
      { type: 'text', text: 'Gracias por la sesión de hoy. Cuídate.' },
      {
        type: 'tool-confirm_close_session',
        toolCallId: 'tc-1',
        state: 'output-available',
        input: { reason: 'user_request' },
        output: { closed: true, reason: 'user_request' },
      },
    ] as unknown as Parameters<typeof detectFarewellWithoutCloseTool>[0]
    expect(detectFarewellWithoutCloseTool(parts)).toBe(false)
  })

  it('devuelve false: hay despedida Y `close_session_crisis` invocado', () => {
    const parts = [
      { type: 'text', text: 'Cuídate. Llama a la Línea 024.' },
      {
        type: 'tool-close_session_crisis',
        toolCallId: 'tc-2',
        state: 'output-available',
        input: {},
        output: { closed: true, reason: 'crisis_detected' },
      },
    ] as unknown as Parameters<typeof detectFarewellWithoutCloseTool>[0]
    expect(detectFarewellWithoutCloseTool(parts)).toBe(false)
  })

  it('devuelve false sin despedida en absoluto', () => {
    const parts = [
      { type: 'text', text: 'cuéntame más sobre tu trabajo' },
    ] as Parameters<typeof detectFarewellWithoutCloseTool>[0]
    expect(detectFarewellWithoutCloseTool(parts)).toBe(false)
  })

  it('devuelve false con array vacío', () => {
    expect(detectFarewellWithoutCloseTool([])).toBe(false)
  })
})

// =============================================================================
// 3b/3c/3e — el prompt de session-therapist contiene las nuevas secciones
// =============================================================================

describe('session-therapist prompt — T3 secciones vinculantes', () => {
  it('carga sin errores y contiene las secciones nuevas', async () => {
    const { getSessionTherapistPrompt } = await import('@/lib/llm/prompts/index')
    const prompt = getSessionTherapistPrompt()

    // 3b — Memoria intra-sesión
    expect(prompt).toContain('Memoria intra-sesión (vinculante)')
    expect(prompt).toContain('Prohibido pedir datos demográficos o temporales que el paciente ya dio')
    expect(prompt).toContain('Validación emocional siempre antes de cualquier pregunta de seguridad')

    // 3e — Anti-persistencia tras rechazo
    expect(prompt).toContain('Cuando el paciente rechaza una sugerencia (vinculante)')
    expect(prompt).toContain('encadenar 2 o más sugerencias alternativas seguidas')

    // 3c — Cierre obligatorio vía tool
    expect(prompt).toContain('Prohibido despedirse sin tool de cierre')
    expect(prompt).toContain('lo dejamos aquí')
  })
})
