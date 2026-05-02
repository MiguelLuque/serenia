import { describe, it, expect } from 'vitest'
import { textContainsSafetyCheck } from '@/lib/shared/chat/safety-check-history'
import {
  textContainsFarewell,
  detectFarewellWithoutCloseTool,
} from '@/lib/shared/chat/farewell-detector'

// =============================================================================
// Plan 7 T3 — Tests heurísticos auxiliares.
//
// Este archivo cubre:
//   3a — `textContainsSafetyCheck` regex unitario (consumido por safety-state.ts
//        como fallback heurístico textual cuando no hay datos clínicos en BD).
//   3c — `detectFarewellWithoutCloseTool` heurística + warn en onFinish.
//   3b/3c/3e — el prompt de session-therapist contiene las nuevas secciones
//              vinculantes y se carga sin errores.
//
// Las variantes integradas del crisisNotice (T3a v2) viven en
// `tests/chat/safety-flow.test.ts` (POST /api/chat con `getSessionSafetyState`
// y `buildCrisisNotice` integrados).
// =============================================================================

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
    const { getSessionTherapistPrompt } = await import('@/lib/server/llm/prompts/index')
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
