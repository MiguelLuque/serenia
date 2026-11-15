# Task 1: assessment dispatch ACK robustness

Status: implemented, verified locally and committed; ready for root review.

Workspace: `/Users/miguelluque/git/serenia` (all operations used this checkout).
Base: `915c8e2`.
Commit: `2b149e4cd9d34289788290c016a467ce95e2827e`.
Committed paths only:

- `lib/server/workflows/index.ts`
- `tests/workflows/outbox.test.ts`

## Root cause and correction

The assessment dispatcher caught start and ACK failures in the same handler. An ACK error or thrown/lost response after successful start therefore invoked the tokenized `failed` action, which could reset an already running/completed worker. The ACK's boolean data was ignored, so false or absent acknowledgements could report success. Start errors were exposed unchanged, failed-release exceptions replaced the primary error, and raw release codes could be logged.

The start phase now has its own recovery handler: it attempts the existing tokenized failed/backoff RPC, tolerates unsuccessful release, and throws only `Error('assessment_dispatch_failed')`. The separate ACK phase requires `data === true` with no RPC error and otherwise throws only `Error('assessment_dispatch_ack_failed')`; it has no failed/release path. Successful ACK returns the run ID. Missing-token validation still precedes client creation/start. Error objects do not carry original causes or rejection context, and the dispatcher emits no raw error logs.

## TDD and verification evidence

All commands used the existing runner from this workspace:
`rtk proxy python3 .cache/pablo-pilot/project_checks.py run /Users/miguelluque/git/serenia -- <command>`.

| Command / phase | Exit | Observed result | Full private log under `/Users/miguelluque/git/serenia/.cache/pablo-pilot/logs/` |
| --- | --- | --- | --- |
| `npm test -- tests/workflows/outbox.test.ts` RED, before production change | 1 | 14 expected failures, 4 passes | `20261101-183242-_dmjfi1o.log` |
| `npm test -- tests/workflows/outbox.test.ts` GREEN | 0 | 18/18 pass | `20261101-183259-1_2yh9nr.log` |
| `npm run lint` | 0 | Full ESLint, zero warnings permitted | `20261101-183306-ymv6oodb.log` |
| `npm run typecheck` | 0 | `tsc --noEmit` | `20261101-183306-p1l5qvkl.log` |
| `npm test`, sandboxed | 1 | 1123 pass, 4 local transport tests fail due to `listen EPERM 127.0.0.1` | `20261101-183306-nvc4so3a.log` |
| `npm test`, approved local-loopback rerun | 0 | 1127/1127 pass, 89/89 files | `20261101-183332-iuvk7uky.log` |

The complete RED and full-suite failure logs were read. All four sandbox failures were in `tests/tooling/dependency-integration.test.ts`: trailing compressed-body bytes, excessive content encodings in each of the AI SDK and Workflow transports, and mixed-case SRI enforcement. Their child HTTP servers bind ephemeral loopback ports; the permission rerun passed without test changes. A `TimeoutNaNWarning` remains visible in both full-suite logs and was not suppressed.

Regressions exercise RPC error, thrown/lost response and false ACK for both simulated running and completed worker interleavings, verifying the claim remains unchanged and only the enqueued RPC is issued. They also cover non-boolean ACK responses, safe start error/backoff behavior, release RPC error/throw/false, unchanged missing-token behavior, persisted context/token use and successful run-ID return.

`git diff --check` passed before commit. Git writes initially hit the sandbox's `.git/index.lock` restriction; approved escalations staged and committed only the two assigned paths. The final commit stat confirms those two paths. Root-owned audit/research/spec/plan changes remain untouched and uncommitted.

## Limits and remaining gates

These are deterministic dispatch boundary tests with mocked external Workflow/RPC boundaries and simulated worker progress. They do not establish real SQL execution/fences, durable replay, hosted/runtime or clinical acceptance. No SQL, schema, claims/leases, model policy, SDK retries, dependencies, configuration, credentials, environment files, providers or remote services were changed or called. No subagents were used.

Root retains independent review, global verification/build/dependency/database gates, PR update and deployment decisions. No claim of global release readiness is made here.
