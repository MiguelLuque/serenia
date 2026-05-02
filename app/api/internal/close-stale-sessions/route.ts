import { createServiceRoleClient } from '@/lib/server/supabase/server'
import { enqueueAssessmentGeneration } from '@/lib/server/workflows'
import { SESSION_INACTIVITY_MS } from '@/lib/server/sessions/service'

// Plan 7 T6 — Replacement for the `close_stale_sessions` Postgres function +
// Supabase pg_cron scheduling. The SQL function (left in place as dead code
// until a follow-up cleans it up) used to do a bulk UPDATE without any
// follow-up assessment generation, so abandoned sessions were lost from the
// clinician inbox. This Vercel cron route closes the same set of sessions and
// enqueues `generateAssessmentWorkflow` for each one, bringing the lazy-close
// path in line with the user-driven `closeSession` path.
//
// Why a Vercel Cron + API route (and not pg_cron + a webhook):
//   - Keeps everything in one runtime: the same Vercel WDK invocation that
//     `closeSession` and `getOrResolveActiveSession` already use.
//   - Avoids a Postgres trigger → outbound HTTP shape (extra extension, retry
//     story to design, escape hatches needed when WDK is down).
//   - The 15-minute cadence is plenty: the user-facing `getOrResolveActiveSession`
//     already lazy-closes whenever the same user logs back in.
//
// Auth: Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}` automatically
// on production crons when CRON_SECRET is configured. We accept that, plus
// allow callers to pass it via header on demand for ops/manual runs.

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  return handle(request)
}

// Vercel Cron uses GET by default; keep both for flexibility.
export async function GET(request: Request) {
  return handle(request)
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const cutoff = new Date(Date.now() - SESSION_INACTIVITY_MS).toISOString()

  // Fetch — and only fetch — the ids we need to close. Doing the SELECT
  // separately from the UPDATE keeps the workflow enqueue list bounded even
  // if a future schema lets us close hundreds of sessions in one tick.
  const { data: stale, error: selectError } = await supabase
    .from('clinical_sessions')
    .select('id')
    .eq('status', 'open')
    .lt('last_activity_at', cutoff)
    .limit(200)

  if (selectError) {
    console.error('[close-stale-sessions] select failed', {
      error: selectError.message,
    })
    return Response.json({ ok: false, error: selectError.message }, { status: 500 })
  }

  const ids = (stale ?? []).map((row) => row.id)
  if (ids.length === 0) {
    return Response.json({ ok: true, closed: 0, enqueued: 0 })
  }

  // Bulk-close. The eq('status','open') filter prevents racing with a
  // user-driven close that fired between the SELECT and the UPDATE.
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('clinical_sessions')
    .update({
      status: 'closed',
      closed_at: now,
      closure_reason: 'inactivity',
    })
    .in('id', ids)
    .eq('status', 'open')

  if (updateError) {
    console.error('[close-stale-sessions] update failed', {
      error: updateError.message,
    })
    return Response.json({ ok: false, error: updateError.message }, { status: 500 })
  }

  // Enqueue assessment generation per session. The workflow is idempotent,
  // so even if a user-driven close already kicked the workflow off the
  // duplicate run will short-circuit on the existence check.
  //
  // Plan 8 Bloque 2 Fix 2: paralelizamos con Promise.allSettled. El loop
  // secuencial podía exceder maxDuration=60s con hasta 200 sesiones y
  // dejar sesiones cerradas-sin-assessment permanentemente (el cron sólo
  // recoge `status='open'`, así que el siguiente tick NO las recupera).
  // allSettled garantiza que el work parcial se publica aunque algún
  // enqueue falle — fulfilled cuenta como `enqueued`, rejected como
  // `failed` con detalle en logs.
  const results = await Promise.allSettled(
    ids.map((sessionId) => enqueueAssessmentGeneration({ sessionId })),
  )

  let enqueued = 0
  let failed = 0
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      enqueued += 1
    } else {
      failed += 1
      console.error('[close-stale-sessions] enqueue failed', {
        sessionId: ids[idx],
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      })
    }
  })

  console.info('[close-stale-sessions] tick complete', {
    closed: ids.length,
    enqueued,
    failed,
  })
  return Response.json({ ok: true, closed: ids.length, enqueued, failed })
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    // Without CRON_SECRET configured we refuse to run — better than silently
    // exposing the endpoint to anyone on the internet.
    console.error('[close-stale-sessions] CRON_SECRET not configured')
    return false
  }
  const header = request.headers.get('authorization') ?? ''
  return header === `Bearer ${expected}`
}
