import { describe, it, expect } from 'vitest'
import {
  renderProtocolPhaseBlock,
  renderProtocolMaintenanceBlock,
  type ProtocolPhase,
} from '@/lib/protocol/render-phase'

// ---------------------------------------------------------------------------
// renderProtocolPhaseBlock — contenido por fase
// ---------------------------------------------------------------------------

describe('renderProtocolPhaseBlock', () => {
  it('Sesión 1 contiene marcadores clínicos clave', () => {
    const block = renderProtocolPhaseBlock(1)
    expect(block).toContain('Sesión 1')
    expect(block).toContain('Evaluación')
    // El spec del plan menciona "autoregistro 3 columnas"; en el bloque
    // aparece como "Autoregistro de 3 columnas" — chequeamos ambos tokens
    // para robustez.
    expect(block).toMatch(/[Aa]utoregistro.*3 columnas/)
    expect(block).toContain('alianza')
  })

  it('Sesión 2 contiene activación conductual + jardín/olas', () => {
    const block = renderProtocolPhaseBlock(2)
    expect(block).toContain('Sesión 2')
    expect(block).toContain('Activación conductual')
    expect(block).toContain('jardín')
    expect(block).toContain('olas')
  })

  it('Sesión 3 contiene pensamientos automáticos + defusión', () => {
    const block = renderProtocolPhaseBlock(3)
    expect(block).toContain('Sesión 3')
    expect(block).toContain('Pensamientos automáticos')
    expect(block).toContain('defusión')
    expect(block).toContain('registros cognitivos')
  })

  it('Sesión 4 contiene aceptación + metáfora del autobús', () => {
    const block = renderProtocolPhaseBlock(4)
    expect(block).toContain('Sesión 4')
    expect(block).toContain('aceptación')
    expect(block).toContain('autobús')
    expect(block).toContain('mindfulness')
  })

  it('Sesión 5 contiene exposición + valores (rejilla/máscaras)', () => {
    const block = renderProtocolPhaseBlock(5)
    expect(block).toContain('Sesión 5')
    expect(block).toContain('Exposición')
    expect(block).toContain('conducta opuesta')
    expect(block).toMatch(/rejilla|máscaras|yo real/i)
  })

  it('Sesión 6 contiene rumiación + ventana + ACT', () => {
    const block = renderProtocolPhaseBlock(6)
    expect(block).toContain('Sesión 6')
    expect(block).toContain('umiación') // "Rumiación" / "rumiación"
    expect(block).toContain('preocupación')
    expect(block).toContain('ventana')
    expect(block).toContain('ACT')
  })

  it('Sesión 7 contiene valores + SMART + plan de vida', () => {
    const block = renderProtocolPhaseBlock(7)
    expect(block).toContain('Sesión 7')
    expect(block).toContain('Valores')
    expect(block).toContain('SMART')
    expect(block).toContain('acciones valiosas')
  })

  it('Sesión 8 contiene prevención de recaídas + plan si-entonces', () => {
    const block = renderProtocolPhaseBlock(8)
    expect(block).toContain('Sesión 8')
    expect(block).toContain('recaídas')
    expect(block).toContain('si vuelve X haré Y')
    expect(block).toContain('caja de herramientas')
  })

  it('cada fase 1-8 abre con el header [PROTOCOLO Y FASE ACTUAL]', () => {
    for (const phase of [1, 2, 3, 4, 5, 6, 7, 8] as const satisfies readonly ProtocolPhase[]) {
      const block = renderProtocolPhaseBlock(phase)
      expect(block.startsWith('[PROTOCOLO Y FASE ACTUAL —')).toBe(true)
      expect(block).toContain('Foco:')
      expect(block).toContain('Objetivos:')
      expect(block).toContain('Técnicas previstas:')
      expect(block).toContain('Tarea esperada para casa:')
      expect(block).toContain('Racional clínico:')
    }
  })

  it('cada fase tiene tamaño razonable (600-1500 chars)', () => {
    for (const phase of [1, 2, 3, 4, 5, 6, 7, 8] as const satisfies readonly ProtocolPhase[]) {
      const len = renderProtocolPhaseBlock(phase).length
      expect(len).toBeGreaterThanOrEqual(600)
      expect(len).toBeLessThanOrEqual(1500)
    }
  })

  it('lanza Error si se fuerza una fase fuera de rango (cast inválido)', () => {
    // Bypass type system on purpose: el switch debería ser exhaustivo,
    // pero si alguien fuerza con `as ProtocolPhase` un valor inválido,
    // queremos que falle ruidosamente en runtime.
    expect(() =>
      renderProtocolPhaseBlock(9 as unknown as ProtocolPhase),
    ).toThrowError(/Unknown protocol phase/)
  })
})

// ---------------------------------------------------------------------------
// renderProtocolMaintenanceBlock — placeholder T5.4
// ---------------------------------------------------------------------------

describe('renderProtocolMaintenanceBlock', () => {
  it('contiene el marker MANTENIMIENTO', () => {
    const block = renderProtocolMaintenanceBlock()
    expect(block).toContain('[PROTOCOLO COMPLETADO — MANTENIMIENTO]')
  })

  it('marca explícitamente que la copy está pendiente de firma clínica', () => {
    const block = renderProtocolMaintenanceBlock()
    expect(block).toContain('pendiente de firma clínica')
    expect(block).toContain('T5.4')
  })

  it('da las reglas mínimas para no reiniciar protocolo y derivar recaída', () => {
    const block = renderProtocolMaintenanceBlock()
    expect(block).toContain('NO reinicies el protocolo')
    expect(block).toMatch(/recaída/i)
    expect(block).toMatch(/supervisor/i)
  })
})
