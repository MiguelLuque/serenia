/**
 * Plan 7 T3a v2 — modelo tipado del estado del cribado de seguridad
 * en la sesión actual.
 *
 * El TIPO discriminado vive aquí (lib/shared/chat) porque crisis-notice
 * y otros consumidores cliente-portables lo necesitan. La FUNCIÓN que
 * deriva el estado a partir de BD vive en lib/server/chat/safety-state.ts
 * — esa parte requiere Supabase y no es portable.
 *
 * Plan 8 Fase 2 reemplazará las variantes `asq_*` por `cssrs_*` con
 * granularidad ampliada (cssrs_low_risk, cssrs_moderate_risk).
 */

export type SafetyState =
  | { kind: 'never_assessed' }
  | { kind: 'asq_proposed_pending'; proposedAt: string }
  | { kind: 'asq_negative'; scoredAt: string; coversAcuteIdeation: boolean }
  | { kind: 'asq_positive_non_acute'; scoredAt: string; flags: unknown[] }
  | { kind: 'asq_acute_risk'; scoredAt: string; flags: unknown[] }
  | {
      kind: 'textual_check_completed'
      lastAssistantCheckAt: string
      lastPatientResponseAt: string | null
    }
