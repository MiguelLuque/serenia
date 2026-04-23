import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Regression guard: la copy mostrada en el dashboard del paciente cuando la
 * última sesión se cerró por `crisis_detected` es **copy clínicamente crítica
 * de crisis** — contiene la ruta de seguridad a la Línea 024 y es lo primero
 * que ve un paciente que vuelve tras un cierre por crisis. Un cambio
 * accidental rompería la señal de seguridad, por eso se fija como literal.
 *
 * Nota de alcance: esta copy vive en `app/app/page.tsx` y **no** está
 * formalmente cubierta por el sign-off clínico de Plan 6 — el signoff lo
 * aclara explícitamente en el Perfil 4 ("La copy de crisis del dashboard...
 * vive en `app/app/page.tsx` fuera del bloque de continuidad"). Su cambio
 * no invalida firmas; aun así, la ruta de seguridad a Línea 024 es
 * suficientemente crítica como para protegerla contra regresiones con un
 * test dedicado.
 *
 * Implementación: sin @testing-library/react render (evita montar el server
 * component async de `app/app/page.tsx` que requiere auth + Supabase). Basta
 * con verificar que los literales exactos aparecen en el source del
 * componente — es lo que termina renderizando.
 */

const REPO_ROOT = resolve(__dirname, '../..')

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8')
}

describe('home crisis notice — copy clínicamente crítica de crisis', () => {
  const pageSrc = read('app/app/page.tsx')

  // Literales clínicamente críticos de la rama de crisis del dashboard. Si
  // alguno de estos cambia, el test falla para forzar una revisión consciente
  // de la ruta de seguridad a Línea 024.
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
    // La Línea 024 debe aparecer en el source. Se exige el string literal
    // exacto: "Línea 024" con acento en la í — es la ruta de seguridad.
    expect(pageSrc).toContain(SIGNED_LINE_024_MENTION)
  })

  it('renders the crisis branch only when closureReason === "crisis_detected"', () => {
    // Regression: la rama de crisis depende de `lastClosed?.closureReason === 'crisis_detected'`.
    // Si alguien cambiase el literal del closure reason, el aviso dejaría de dispararse.
    expect(pageSrc).toContain("lastClosed?.closureReason === 'crisis_detected'")
  })
})
