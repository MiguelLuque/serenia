/**
 * Recursos de seguridad para España. Centralizados aquí para que cualquier
 * cambio (número, nombre del servicio, descripción) se haga en un solo sitio
 * y propague a banner, home, página de sesiones, copy de la IA, etc.
 *
 * Si Serenia abre fuera de España (ver Plan 7 — decisión humana #12), esto
 * pasa a ser un selector por jurisdicción.
 */
export const SAFETY_RESOURCES = {
  suicide: {
    phone: '024',
    name: 'Línea 024',
    description: 'Línea de Atención a la Conducta Suicida — gratuita, 24h',
    href: 'tel:024',
  },
  emergency: {
    phone: '112',
    name: '112',
    description: 'Emergencias generales',
    href: 'tel:112',
  },
} as const

export type SafetyResource = (typeof SAFETY_RESOURCES)[keyof typeof SAFETY_RESOURCES]
