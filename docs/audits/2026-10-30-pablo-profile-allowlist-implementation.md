# Task1 — Application/provider profile allowlist

Base: `6d86ef0`, branch `codex/pablo-profile-release`, checkout `/Users/miguelluque/git/serenia`. Scope is application/provider processing; no SQL, migration, model, dependency, environment secrets, account changes or hosted mutation.

## Final contract

- `progressiveProfileAvailable(env = process.env): boolean` requires `FEATURE_PROGRESSIVE_PROFILE=on`; on `VERCEL=1` also requires a valid list.
- `progressiveProfileEnabled(env = process.env, userId?: string): boolean` additionally requires the verified Auth/loaded-job owner to belong to the hosted list. Absent owner fails closed on Vercel. Outside `VERCEL=1`, the previous local opt-in behavior remains unchanged.
- `progressiveProfileReviewUserIds(env = process.env): readonly string[] | null` returns normalized trimmed/lowercase, validated unique UUIDs (1–10) for Vercel. Empty/missing/malformed/email/wildcard/duplicate/over-limit list or disabled flag returns `[]`; outside Vercel returns `null` to preserve the original local sweep.
- UI navigation, page, server actions, chat admission dispatch and context use `auth.getUser()` identity. `loadProfileContext(client, currentText, userId?)` receives that verified identity and denies before memory RPCs. Body identity is rejected by the existing strict chat/review schema; editable metadata is ignored.
- `ClaimedProfileJob` now includes the service-claimed `user_id`. Dispatch gates before creating the service client/starting Workflow. Workflow wire input remains `{ jobId, token }`; workflow and step symbols/IDs are unchanged. The worker loads the current job matching ID/token and checks its stored owner before `start_profile_job`, source queries, extraction/model calls or next-job dispatch.
- Cron uses coarse availability; enqueue performs individual owner-scoped hosted claims only, with a shared remaining budget of ten jobs and dispatch batches of at most two. Local cron preserves the previous global claim. A job returned with an unauthorized owner is still denied by dispatch, and the worker independently revalidates its current DB owner.
- SQL authorization remains owner/consent based. This rollout list limits the application/provider processing, and does not claim to restrict direct owner-authorized RPC access.

## Verification evidence

Commands were launched through `rtk` from the authorized checkout. Native package entrypoints were discovered with `rtk proxy python3 /Users/miguelluque/git/ai-workbench/project_checks.py inspect /Users/miguelluque/git/serenia`. The runner's `run` mode could not write its fixed log path outside the sandbox (`/Users/miguelluque/git/ai-workbench/logs`), so the same native commands used full redirected logs in `/private/tmp`; no acceptance gate was removed.

| Command | Result | Full local log |
| --- | --- | --- |
| `npm test -- tests/profile/config.test.ts tests/profile/context.test.ts tests/profile/dispatch.test.ts tests/profile/actions.test.ts tests/profile/page.test.tsx tests/profile/workflow.test.ts tests/profile/integration.test.ts` (RED) | 15 expected boundary failures plus one chat harness ownership setup failure before implementation; harness corrected separately | `/private/tmp/pablo-task1-red.log` |
| `npm test -- tests/profile/integration.test.ts` (corrected RED) | 1 expected failure: nonallowed chat still read `get_profile_memory`; chat response itself was 200 | `/private/tmp/pablo-task1-chat-red.log` |
| `npm test -- tests/profile tests/app/close-stale-sessions.test.ts tests/app/layout-display-name.test.tsx` (GREEN) | 166 passed, 11 files | `/private/tmp/pablo-task1-green-final.log` |
| `npm run lint` | PASS, zero warnings | `/private/tmp/pablo-task1-lint-final.log` |
| `npm run typecheck` | PASS | `/private/tmp/pablo-task1-typecheck-final.log` |
| `npm test` (one full suite before commit) | 1080 passed, 4 infrastructure failures, 86 files | `/private/tmp/pablo-task1-suite-final.log` |
| `npm test -- tests/tooling/dependency-integration.test.ts` (authorized loopback retry) | 6 passed, 1 file | `/private/tmp/pablo-task1-loopback-retry.log` |

Final config-only validation (after strengthening the mixed-case duplicate fixture): `npm test -- tests/profile/config.test.ts` passed 11 tests; full log `/private/tmp/pablo-task1-config-final.log`.

The four full-suite failures were all `listen EPERM: operation not permitted 127.0.0.1`, in `tests/tooling/dependency-integration.test.ts`: compressed-body trailing bytes, provider-utils content encodings, workflow/world-local content encodings, and mixed-case SRI. Focused rerun with approved ephemeral loopback access passed all six tests. This does not relabel the restricted full suite as globally passing. Root owns the final seven-gate verify, isolated build and independent review; these were not duplicated here.

Focused cases cover invalid/missing lists, bounds and normalization, caller absence/membership, retained local behavior, spoofed editable metadata/body, denied actions/page/context/navigation, allowed authenticated caller integration, unchanged ordinary chat with invalid config, worker stored owner before source/model, cron individual claims and global ten-job/two-dispatch limits.

## Self-review

Reviewed all production diffs and searched all application/profile RPC/context/dispatch references. All new profile reads/writes have coarse plus verified-owner gates where appropriate; no client-supplied identity is used. Worker unauthorized skips do not set `job`, so `finally` cannot dispatch the unauthorized owner's next job. Claim results are capped to the remaining budget, and failures preserve existing fenced lease/backoff behavior. Consent, onboarding, prompts/models, workflow wire arguments and SQL owner-only authorization remain unchanged. No unresolved implementation finding was identified; independent review remains root's gate.
