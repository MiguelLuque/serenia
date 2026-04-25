import { start } from 'workflow/api'
import {
  generateAssessmentWorkflow,
  type GenerateAssessmentInput,
  type RejectionContext,
} from '@/lib/workflows/generate-assessment'

export type { RejectionContext } from '@/lib/workflows/generate-assessment'

/**
 * Enqueue the background workflow that generates a clinical assessment for a
 * closed session. Returns immediately (does not wait for the LLM) — callers
 * should NOT await assessment availability before responding to the user.
 *
 * Idempotency: if an assessment already exists, the workflow short-circuits.
 * If the workflow is enqueued twice for the same sessionId (retry, double
 * fire from cron + user action), the second run becomes a no-op.
 *
 * Used by:
 *  - `closeSession` (lib/sessions/service.ts) after marking the session closed.
 *  - `getOrResolveActiveSession` when it lazily closes an inactive session.
 *  - The Vercel cron at `/api/internal/close-stale-sessions` for sessions
 *    abandoned without any user-driven trigger.
 *  - T-B's "regenerate after rejection" flow (passes `rejectionContext`).
 */
export async function enqueueAssessmentGeneration(
  input: GenerateAssessmentInput,
): Promise<{ runId: string }> {
  const run = await start(generateAssessmentWorkflow, [input])
  return { runId: run.runId }
}

export type { GenerateAssessmentInput }
