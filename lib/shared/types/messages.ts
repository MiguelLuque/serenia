import type { UIMessage } from 'ai'

/**
 * The shape of a single entry in `messages.parts` (JSONB column).
 *
 * We persist the full AI SDK v6 `UIMessage['parts']` payload so tool-call
 * activity (`propose_close_session`, `propose_questionnaire`,
 * `confirm_close_session`, `close_session_crisis`, …) survives across
 * page reloads and is available for rehydration of `initialMessages`.
 *
 * Validation is performed at the hydration boundary via `safeValidateUIMessages`
 * from the AI SDK — see `app/app/sesion/[id]/page.tsx`.
 */
export type MessagePart = UIMessage['parts'][number]
