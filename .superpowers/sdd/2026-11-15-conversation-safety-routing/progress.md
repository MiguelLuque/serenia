# SDD ledger — plan: docs/superpowers/plans/2026-11-15-conversation-safety-routing.md

BASE: 0813dadf2cfdc081c2fc236af1ac8c5433ed0414 (`codex/serenia-pablo-release-integration`), after aborting the implementation merge. The source branch and primary checkout remain unchanged.

Spec: `docs/superpowers/specs/2026-11-15-conversation-safety-routing.md` is binding. The plan is local to this worktree; hosted migration, provider spend, deployment and clinical sign-off are out of scope for implementation tasks.

## Preflight scan

| Scope | Shared output / risk checked | Result and ruling |
| --- | --- | --- |
| Task 1 ↔ Task 2 | `riskType` values from classifier into RPC/event parameters | Spec fixes the only values to `suicidal_ideation`, `self_harm`, `crisis_other`; Task 1 emits an operational topic only, Task 2 validates it against both allowed values and the server marker. Ruling: use no classifier severity. |
| Task 1 ↔ Task 3 | classifier dispositions and safety-answer categories | Task 1 owns pure types/functions; Task 3 consumes them. `contextual` cannot suppress a separate direct current clause; `skip` and `unclear` are distinct. Ruling: keep all routing branches explicit and test them at both unit and route level. |
| Task 2 ↔ Task 3 | defaulted RPC arguments and admission response | Task 2 replaces old six-argument functions with a trailing-default signature; Task 3 sends named new args and handles `stale_candidate`, `session_closed`, replay and validated `safetyAnswer`. Ruling: SQL transaction is the authority; route candidates alone never authorize. |
| Task 1 | tests vs classifier implementation | Matrix includes contextual, ambiguous, direct current, mixed clauses and answer categories; no assertions about diagnosis or clinical severity. Ruling: unit tests assert routing labels only. |
| Task 2 | tests vs migration implementation | Required cases include marker binding, forged/stale/out-of-order answers, retry idempotency, event type/severity, hard limit and ACL. Ruling: use transaction/session lock and server response-parts marker; never infer marker from the client body. |
| Task 3 | tests/docs vs route implementation | Required cases cover ordinary chat for contextual text, one prompt for ambiguity, direct-current resources, no false crisis closure, and unchanged time/ownership/replay. Ruling: direct current gets deterministic response, no model call and no automatic closure; hard time limit still closes by time. |
| Task 4 | verification vs scope | `npm run verify` and local DB gates are allowed; hosted writes, paid calls, push and deploy are not. Ruling: if local Supabase identity/history is mismatched, stop `db:verify` and use isolated `db:test`; report hosted and clinical gates separately. |

No internal contradiction found. Existing branch was clean at base before adding this plan/spec; no merge/cherry-pick/rebase is active. `npm ci` installed exact lockfile dependencies and completed successfully.

## Tasks

- [x] Task 1: signal dispositions and pure answer candidates. Commit: f384238.
- [x] Task 2: prompt-bound database transaction and SQL regression cases. Commit: 0f9b741.
- [ ] Task 3: integrate dispositions in chat route, tests and crisis protocol.
- [ ] Task 4: run local/repository gates, review full diff, document remaining hosted/runtime/clinical gates.

### Task 1 independent review follow-up

- Review of Task 1 found overbroad context/negation handling across clauses, missed colloquial current cutting, and incorrect explicit routing for uncertain suicidal thoughts.
- Regression tests were added first; 8 cases failed before the implementation update. The fix classifies cue-bearing clauses independently, chooses the explicit clause's topic, retains ambiguous conflicted thoughts, and handles negated clarification replies.
- Focused tests pass: 44/44. Full `rtk npm test`: 99 files passed, 1 failed; 1,308 passed, 4 failed in `tests/tooling/dependency-integration.test.ts` because child Node servers cannot bind `127.0.0.1` (`listen EPERM`). Details: `task-1-report.md`.

## Task 2 verification

- RED: rtk npm run db:test -- --baseline-chat exited 1 at the new SQL assertion with Extended begin_chat_turn signature missing, as expected without the Task 2 migration. The baseline harness previously skipped the required chat table migration; removed that skip so this mode now represents the real pre-Task-2 schema.
- GREEN: final rtk npm run db:test exited 0 after all migration replay, seed, SQL, lock-concurrency and profile assertions, including PASS prompt-bound safety answer validation, replay, typed provisional events and RPC grants.
- rtk npm run typecheck exited 0 (tsc --noEmit).
- rtk git diff --check exited 0.
- The first sandboxed Docker attempt exited 1 because access to the local Docker socket was denied. The documented ephemeral PostgreSQL harness then ran with the narrow approved elevation; it uses --network none and synthetic fixtures. One initial fixture run exposed the one-open-session-per-user constraint and was corrected by using a distinct synthetic owner per session.
- The harness validates SQL behavior against PostgreSQL 17.6 with an auth.uid() shim; it does not validate JWT, GoTrue, PostgREST, hosted migration history, or clinical acceptance.

