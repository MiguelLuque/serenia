# Task 3 report — route dispositions through chat

**Status:** implemented locally; no hosted or clinical gate was run.

## Implementation

- The route now calls `classifyCrisisSignal` for each new request. Only `explicit_current` sets `p_crisis`, the typed `p_direct_risk_type`, and urgency. Direct and ambiguous turns return deterministic assistant messages without model or profile extraction. Direct classification never closes the session; a reached hard deadline uses `time_limit` and includes both the time explanation and resources.
- Contextual messages continue through normal generation with their full text. Their lexical match no longer selects a crisis notice, event, urgency, closure, or inactivity bypass. `close_session_crisis` is no longer registered as a generative tool.
- Ambiguous signals produce one static domain-specific question with a persisted `data-safety-prompt` part/chunk containing version `1`, risk type, and the accepted turn request ID. The client sends only that request ID as an optional reference.
- Before admission, the server reads the most recent completed `chat_turns.response_parts` for the owned session/user, validates a single supported marker, and derives type/version from stored data. Read errors fail closed. Missing, stale, or forged references receive a 422 before admission; the client retains the text, refreshes its conversation state, and does not auto-bind that submission to a different marker. The SQL RPC remains responsible for validation under the session lock.
- Answer categories are derived only when a valid marker exists. Affirmative routes to the typed provisional response; negative acknowledges without repeating; unclear states that current danger cannot be determined and offers resources without repeating; skip consumes the marker and resumes generation for the changed topic. A direct signal takes precedence.
- Admitted retries reuse stored `safety_answer`, `safety_answer_risk_type`, and `previous_request_id` without recalculating the candidate against another prompt. Completed turns replay saved chunks. The client keeps the exact submitted marker ID in its in-memory local submission for retries.
- Updated the crisis protocol and stale prompt/comment language to remove diagnostic, same-day-review, and model-driven crisis-close promises. Updated route fixtures and the harness to model stored response parts and candidate replay.

## TDD and verification

- RED: initial new route/boundary tests reported **8 failed, 7 passed**. Failures covered contextual interruption, missing direct type, ambiguous prompt/marker, missing marker reference handling, marker read failure, and wrong hard-limit close reason.
- RED: the compound topic-change candidate was initially `unclear`; a focused test showed it did not classify as `skip`. The helper now recognizes an explicit topic-change lead followed by a new topic.
- Final focused command: `rtk npx vitest run tests/chat/request-boundary.test.ts tests/chat/crisis-detector.test.ts tests/api/chat-safety-routing.test.ts tests/api/chat-route.test.ts tests/chat/safety-flow.test.ts tests/chat/clinical-pilot.test.ts tests/chat/close-session-tools.test.ts` — **7 files, 242 tests passed**.
- `rtk npm run typecheck` — passed.
- `rtk git diff --check` — passed.

## Gates not run

- Full `rtk npm test` and repository `rtk npm run verify` were not run; Task 4 owns full verification and the parent requested the focused suite first.
- No database replay/type generation or local Supabase stack command was run. SQL/migrations were not modified; RPC lock behavior remains subject to Task 4's local database verification.
- No hosted Supabase, Vercel, provider/model call, deployment, clinical review, or pilot validation was performed.

## Review follow-up — 2026-11-15

Applied four independent review findings with regression-first TDD:

1. A valid marker-bound answer now counts as a safety turn in the inactivity guard, so it reaches admission before ordinary inactivity closure. Contextual ordinary turns still follow the prior inactivity path.
2. If a valid affirmative, negative, or unclear answer reaches the hard time limit, the static response keeps the category acknowledgment; affirmative and unclear also retain resources. Closure remains `time_limit`.
3. Natural new-topic requests such as `Quiero hablar del trabajo` classify as `skip`. The helper avoids returning skip for a direct current safety statement.
4. A completed same-request replay bypasses current-marker validation and goes through the idempotent RPC replay; a new request ID still requires the current server marker and cannot use a stale reference.

- RED: `rtk npx vitest run tests/chat/crisis-detector.test.ts tests/api/chat-safety-routing.test.ts` — **5 failed, 185 passed**, matching all four findings (affirmative and unclear are separate cases).
- GREEN focused run: `rtk npx vitest run tests/chat/request-boundary.test.ts tests/chat/crisis-detector.test.ts tests/api/chat-safety-routing.test.ts tests/api/chat-route.test.ts tests/chat/safety-flow.test.ts tests/chat/clinical-pilot.test.ts tests/chat/close-session-tools.test.ts` — **7 files, 247 tests passed**.
- `rtk npm run typecheck` and `rtk git diff --check` — passed.
- Full suite/repository verification remain unrun per Task 3 follow-up scope; no hosted/database/provider/runtime/clinical gates were run.

## Files

Route: `app/api/chat/route.ts`; request boundary and client reference: `lib/server/chat/request-boundary.ts`, `lib/shared/chat/safety-prompt.ts`, `components/chat/chat-view.tsx`; classifier skip refinement: `lib/shared/chat/crisis-detector.ts`; tests/harness: `tests/api/chat-safety-routing.test.ts`, `tests/api/chat-route.test.ts`, `tests/chat/clinical-pilot.test.ts`, `tests/chat/close-session-tools.test.ts`, `tests/chat/crisis-detector.test.ts`, `tests/chat/request-boundary.test.ts`, `tests/chat/safety-flow.test.ts`, `tests/helpers/chat-harness.ts`; protocol: `docs/agents/protocols/crisis.md`.

## Lint follow-up — 2026-11-15

- Removed the unused local `denial` assignment from `lib/shared/chat/crisis-detector.ts`; no classifier behavior changed.
- `rtk npm run lint` — passed with zero warnings.
- `rtk npm run typecheck` — passed.
- Full suite was not run.

## Full-verify behavioral follow-up — 2026-11-15

Addressed the four findings from full verify using regression-first TDD:

- Added `matarme` to the direct `voy a` suicidal-intent matcher, with direct positive and clear-negation cases plus an attributed-quote control.
- Restored optional private-context behavior: `buildPatientContext` failure logs and degrades to base chat. Session safety-state read failures remain fail-closed.
- Corrected the ordinary completed replay test: replay does not enqueue profile extraction a second time.
- Reworked deadline tests to use an ordinary contextual mention for generation crossing/failure; the after-inactivity direct case asserts deterministic resources, typed urgent admission, and no model call. The route catch rechecks the hard deadline even for context failures before generation begins, then closes with `time_limit`.

RED: `rtk npx vitest run tests/chat/crisis-detector.test.ts tests/chat/cross-session-context.test.ts tests/chat/session-time.test.ts tests/profile/integration.test.ts tests/api/chat-safety-routing.test.ts` — **5 files failed, 2 passed; 6 failed tests / 226 passed**.

GREEN: `rtk npx vitest run tests/chat/cross-session-context.test.ts tests/chat/session-time.test.ts tests/profile/integration.test.ts tests/chat/crisis-detector.test.ts tests/api/chat-safety-routing.test.ts` — **5 files passed, 232 tests passed**.

- `rtk npm run typecheck` — passed.
- `rtk npm run lint` — passed (zero warnings).
- `rtk git diff --check` — passed.
- Full suite / `rtk npm run verify` were not rerun in this follow-up; parent requested focused GREEN before rerunning repository gates. No hosted DB, Vercel, model/provider, push, merge, or deploy operations were performed.


## Full-verify behavioral follow-up — 2026-11-15

Addressed the four review findings from the full verify using regression-first TDD:

- Added  to the direct  suicidal-intent matcher, with a direct positive and clear-negation case plus an attributed-quote control.
- Restored the optional private-context contract:  failure logs and degrades to base chat. Session safety-state read failures remain fail-closed.
- Corrected the ordinary completed replay test: replay does not enqueue profile extraction a second time.
- Reworked the stale deadline tests to use an ordinary contextual media/article mention for generation crossing/failure; the after-inactivity direct case now asserts deterministic direct resources, typed urgent admission, and no model call. The route catch rechecks the hard deadline even for context failures before model generation begins, then closes with .

RED:  RUN  v4.1.12 /Users/miguelluque/.codex/worktrees/serenia-pablo-safety-integration/serenia
 Test Files  5 passed (5)
      Tests  232 passed (232)
   Start at  18:27:48
   Duration  582ms (transform 498ms, setup 0ms, import 422ms, tests 1.28s, environment 1ms) — 5 files failed, 2 passed; 6 failed tests / 226 passed.

GREEN:  RUN  v4.1.12 /Users/miguelluque/.codex/worktrees/serenia-pablo-safety-integration/serenia
 Test Files  5 passed (5)
      Tests  232 passed (232)
   Start at  18:27:49
   Duration  538ms (transform 474ms, setup 0ms, import 354ms, tests 1.25s, environment 0ms) — 5 files passed, 232 tests passed.

- > tsc --noEmit — passed.
- > eslint --max-warnings=0 — passed (zero warnings).
-  — passed.
- Full suite / > node scripts/verify.mjs
FAIL test; full log: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R/test.log
PASS lint; full log: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R/lint.log
PASS typecheck; full log: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R/typecheck.log
PASS workflow:wire; full log: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R/workflow-wire.log
FAIL db:test; full log: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R/db-test.log
FAIL chronology:test; full log: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R/chronology-test.log
FAIL audit:dependencies; full log: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R/audit-dependencies.log
FAIL build:isolated; full log: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R/build-isolated.log
Verification evidence: /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HPwq1R. Supabase runtime acceptance additionally requires npm run db:verify with a healthy local stack. were not rerun in this follow-up; parent requested focused GREEN before rerunning repository gates. No hosted DB, Vercel, model/provider, push, merge, or deploy operations were performed.
