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

### Task 2 independent review follow-up

- Added defaulted `p_safety_answer_prompt_request_id` to both begin-turn RPCs. Under the session lock, the database now compares it with the request id of the immediately preceding completed turn that contains the server-stored prompt marker. The caller still cannot submit marker content. Non-direct answers require a complete matching candidate; direct signals remain admissible and only store a simultaneous answer when its type and predecessor id match.
- Added same-topic consecutive-prompt coverage: an answer classified against prompt A is rejected for prompt B, while B's own predecessor id is accepted. Added explicit persisted category/topic and completed replay assertions, no duplicate affirmative event, prompt-id payload assertion, forged/unprompted candidate rejection, and exact SQLSTATE checks.
- Added `--safety-red`, which replays all migrations except the Task 2 migration and runs the focused SQL assertions. Historical `--baseline-chat`, `--baseline-flows` and `--baseline-security` now omit both this migration and its schema-dependent assertions.
- RED: `rtk npm run db:test -- --safety-red` exited 1 at `Prompt-bound begin_chat_turn signature missing`, the intended pre-migration failure.
- GREEN: final `rtk npm run db:test` exited 0, including `PASS prompt-bound safety answer validation, replay, typed provisional events and RPC grants` and the existing concurrency/profile gates. `rtk npm run db:test -- --baseline-chat` exited 0.
- `rtk git diff --check` exited 0. Current `rtk npm run typecheck` exits 1 only in unchanged Task 1 file `lib/shared/chat/crisis-detector.ts:100-102` (`string` not assignable to `CrisisDisposition`/`CrisisRiskType`); no Task 2 type error was reported, and the classifier is outside this follow-up scope.
- These DB runs used the repository's ephemeral PostgreSQL 17.6 harness (`--network none`, synthetic fixtures, auth.uid shim). No hosted schema, Vercel configuration, paid model, push, merge or deploy was touched.
- Review-fix commit: `fd65c57` (`fix: bind safety answers to prompt requests`).

### Task 2 safety-RED mode compatibility follow-up

- The focused `--safety-red` mode now rejects `--profile-history` as well as historical baseline flags during argument parsing, before Docker setup. These modes otherwise exit before reaching the intended RED assertion.
- Before the change, `rtk npm run db:test -- --safety-red --profile-history` reached Docker startup (then the sandbox denied the socket). After the change it exits 2 with the parser error `--safety-red cannot be combined with a historical baseline or --profile-history`, before any Docker call.
- `rtk npm run db:test -- --safety-red` still exits 1 at `Prompt-bound begin_chat_turn signature missing`, the expected focused RED. `rtk git diff --check` passes. This follow-up changes only harness argument validation; typecheck was not rerun.
- The parser guard and this ledger entry are committed locally.

### Task 1 follow-up: grooming, risk type and TypeScript

- Added RED coverage for ordinary hair/nail grooming mentions, contextual-plus-ambiguous topic precedence, `No quiero vivir`, and unequivocal denials. Six new assertions failed before the fix.
- Grooming phrases now remain `none`; explicit current cutting remains `self_harm`. An ambiguous clause retains its own `riskType`; `No quiero vivir` is ambiguous rather than a clear denial.
- Added explicit clause-result types to fix the Task 1 TypeScript inference error.
- Focused suite passes 51/51; `rtk npm run typecheck` passes. Full suite: 99 files pass, 1 fails; 1,315 pass and 4 fail because `tests/tooling/dependency-integration.test.ts` child processes receive `listen EPERM: operation not permitted 127.0.0.1`. Details: `task-1-report.md`.

### Task 1 follow-up: negation scope and grooming clauses

- Added RED cases for progressive hair/nail grooming, `no quiero dejar de` risk phrasing, clear `no voy a` denial, and coordinated shared `quiero`; 7 assertions failed before the fix.
- Progressive grooming stays `none`; conflicted negation stays ambiguous; direct future denials are contextual; shared `quiero` preserves the explicit suicide clause. Focused tests pass 58/58 and typecheck passes.
- `rtk npm test`: 99 files passed, 1 failed; 1,322 passed, 4 failed in dependency integration due `listen EPERM: operation not permitted 127.0.0.1`. Details: `task-1-report.md`.

### Task 1 follow-up: clause boundaries and explicit-current threshold

- Added the re-review cases first; 7 regression cases failed before the fix.
- Clause parsing now retains connector type. Positive `quiero` inherits only across `y`, not across punctuation or a negated clause. Negation over “dejar de” remains ambiguous; clear “no voy a” denial stays contextual.
- Broad “quiero desaparecer/acabar con todo” expressions are ambiguous alone. Direct personal statements already accepted remain explicit, including coordinated positive `quiero` + `quitarme la vida`/`matarme`.
- Focused tests pass 70/70; typecheck passes. Full suite: 99 files pass, 1 fails; 1,334 pass and 4 fail due dependency integration child server `listen EPERM` on 127.0.0.1. See `task-1-report.md`.

### Task 1 follow-up: explicit plan, intent and behavior

- Added RED cases for temporal broad expressions and explicit plan/intent/behavior; 7 cases failed before the change.
- Temporal markers alone no longer elevate broad figurative expressions. Explicit current plan, intent, cutting, harm and self-injury phrases route to their topic; `me hice daño hoy` remains ambiguous.
- Focused tests pass 77/77 and typecheck passes. Full suite: 99 files pass, 1 fails; 1,341 pass and 4 fail due dependency integration child Node binds denied with `listen EPERM: operation not permitted 127.0.0.1`. Details in Task 1 report.

