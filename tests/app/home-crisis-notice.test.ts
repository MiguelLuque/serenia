import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Regression guard: the copy shown on the patient dashboard when the last
 * session was closed by `crisis_detected` is clinically validated and firmada
 * en el sign-off (docs/superpowers/specs/2026-04-23-plan-6-cross-session-continuity-signoff.md).
 *
 * Un cambio accidental de esta copy debe hacer fallar este test: si el copy
 * cambia, hay que re-firmar el sign-off y actualizar tanto el signoff.md como
 * `app/app/page.tsx` a la vez (y refrescar este test).
 *
 * Implementación: sin @testing-library/react render (evita montar el server
 * component async de `app/app/page.tsx` que requiere auth + Supabase). Basta
 * con verificar que los literales exactos del signoff aparecen en el source
 * del componente — es lo que termina renderizando.
 */

const REPO_ROOT = resolve(__dirname, '../..')

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8')
}

describe('home crisis notice — copy firmada en el sign-off', () => {
  const pageSrc = read('app/app/page.tsx')

  // Literales firmados por el revisor clínico. Si alguno de estos cambia,
  // el sign-off queda invalidado y se deben re-solicitar firmas.
  const SIGNED_TITLE = 'Tu última sesión se cerró por seguridad.'
  const SIGNED_DESCRIPTION_FRAGMENT_1 = 'Tu psicólogo la está revisando hoy.'
  const SIGNED_DESCRIPTION_FRAGMENT_2 = 'Si necesitas ayuda ahora,'
  const SIGNED_LINE_024_MENTION = 'Línea 024'

  it('includes the signed title exactly', () => {
    expect(pageSrc).toContain(SIGNED_TITLE)
  })

  it('includes the signed description fragments exactly', () => {
    expect(pageSrc).toContain(SIGNED_DESCRIPTION_FRAGMENT_1)
    expect(pageSrc).toContain(SIGNED_DESCRIPTION_FRAGMENT_2)
  })

  it('directs the patient to Línea 024 (exact string) in the crisis branch', () => {
    // La Línea 024 debe aparecer en el source. Se exige el string literal tal
    // cual lo firmó el revisor: "Línea 024" con acento en la í.
    expect(pageSrc).toContain(SIGNED_LINE_024_MENTION)
  })

  it('renders the crisis branch only when closureReason === "crisis_detected"', () => {
    // Regression: la rama de crisis depende de `lastClosed?.closureReason === 'crisis_detected'`.
    // Si alguien cambiase el literal del closure reason, el aviso dejaría de dispararse.
    expect(pageSrc).toContain("lastClosed?.closureReason === 'crisis_detected'")
  })
})
