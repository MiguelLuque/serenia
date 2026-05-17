/**
 * Modelo tipado del estado del cribado de seguridad en la sesión actual.
 *
 * Plan 8 Fase 2 (2026-05-17) — sustituye las variantes `asq_*` por `cssrs_*`
 * con la granularidad de 5 bandas firmada por Pablo el 2026-05-03. La banda
 * `cssrs_acute_risk` incorpora el flag `behaviorRecent` (ítem 6b = Sí) que
 * dispara cierre inmediato de sesión + alerta urgente al psicólogo.
 *
 * El TIPO discriminado vive aquí (lib/shared/chat) porque crisis-notice y
 * otros consumidores cliente-portables lo necesitan. La FUNCIÓN que deriva
 * el estado a partir de BD vive en lib/server/chat/safety-state.ts — esa
 * parte requiere Supabase y no es portable.
 *
 * Reglas de transición (en derivación, no en este módulo):
 *   - Banda C-SSRS más severa = la asignada al estado.
 *   - Override behaviorRecent (item 6b = Sí) → siempre acute_risk con
 *     `behaviorRecent: true`, aunque las bandas previas dieran negative.
 */

export type SafetyState =
  | { kind: 'never_assessed' }
  | { kind: 'cssrs_pending'; proposedAt: string }
  | { kind: 'cssrs_negative'; scoredAt: string }
  | { kind: 'cssrs_low_risk'; scoredAt: string }
  | { kind: 'cssrs_moderate_risk'; scoredAt: string }
  | { kind: 'cssrs_high_risk'; scoredAt: string }
  | {
      kind: 'cssrs_acute_risk'
      scoredAt: string
      flags: unknown[]
      /**
       * `true` si el override behaviorRecent (item 6b = Sí, conducta suicida
       * en los últimos 3 meses) está activo. Distingue dos sub-casos clínicos:
       *   - `false`: items 5 o 6 lifetime = Sí (acute estructural).
       *   - `true`: item 6b = Sí (acute reciente) ⇒ cierre INMEDIATO + alerta
       *     URGENTE al psicólogo referente.
       */
      behaviorRecent: boolean
    }
  | {
      kind: 'textual_check_completed'
      lastAssistantCheckAt: string
      lastPatientResponseAt: string | null
    }
