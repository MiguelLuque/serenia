/**
 * Cálculo de edad en años cumplidos a partir de una fecha de nacimiento.
 *
 * Acepta `null` y strings malformadas (devuelve `null` en ambos casos) para
 * que los consumidores no necesiten guardas previas. Se aloja en su propio
 * módulo para que `lib/patient-context/builder.ts` y `lib/patient-context/render.ts`
 * compartan exactamente la misma regla de cumpleaños — una divergencia entre
 * ambos sería difícil de detectar en revisión.
 */
export function computeAge(birthDate: string | null, now: Date): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  let age = now.getFullYear() - birth.getFullYear()
  const hadBirthday =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  if (!hadBirthday) age -= 1
  return age
}
