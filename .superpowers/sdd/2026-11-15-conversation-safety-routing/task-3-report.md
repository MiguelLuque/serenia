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

## Acceptance boundaries

- The final repository verification is recorded below. It includes isolated PostgreSQL migration replay, not a check against a running local Supabase stack.
- No hosted Supabase write or migration apply, Vercel environment mutation, provider/model call, deployment, clinical review, or pilot validation was performed.

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

## Review follow-up — durable finish error and uncertain intent — 2026-11-15

- Added a harness scenario where `finish_chat_turn` commits the response and then returns an error. RED exposed that an expired session let the catch block attempt a second static finish, returning different chunks than the durable response. The route now permits the time-limit static fallback only before any `finish_chat_turn` attempt; the harness models `fail_chat_turn` as a state-conditional update and preserves a completed durable turn. The regression verifies the original completed chunks replay unchanged.
- Added RED for `No creo que voy a matarme esta noche`; it was `explicit_current`. The uncertainty matcher now treats `no creo que voy a` as uncertain while preserving positive `Voy a matarme`, direct denial `No voy a matarme`, and attributed third-party quotes.
- RED: `rtk npx vitest run tests/chat/crisis-detector.test.ts tests/api/chat-safety-routing.test.ts` — **2 failed, 194 passed**.
- GREEN: same focused command — **2 files passed, 196 tests passed**.
- `rtk npm run typecheck`, `rtk npm run lint`, and `rtk git diff --check` — passed.
- At this point in the sequence, full verify was pending independent review; it passed later as recorded below. No hosted database write, Vercel mutation, provider/model call, or deployment was performed.


## Final repository verification — 2026-11-15

Final code commit: `bbc99d9` (`Preserve committed chat replay on finish errors`). Independent static review found no P1/P2 findings in this commit. One P3 pilot-review edge remains: a natural topic-change request that itself contains an ambiguous self-harm cue can consume the clarification marker; discuss this case with Pablo during supervised review.

- `rtk npm run verify` — **all gates passed**: test, lint, typecheck, workflow wire, isolated `db:test`, chronology, dependency audit, and isolated build.
- Full suite: **101 files, 1,466 tests passed**.
- Dependency audit: production and full reports both showed zero advisories; npm exit codes matched.
- Evidence is in the private temp directory `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-tNAuVz`.
- `db:verify` against a running local Supabase stack was not run because this turn did not confirm that stack's project identity and migration history. The isolated PostgreSQL migration replay in `db:test` passed.
- Vercel metadata access was retried with `decrypt=false`; the connector returned 57 rows but marked its response truncated. No environment values were decrypted and no variable targets were changed.
- No hosted database write, Vercel mutation, provider/model call, deployment, clinical approval, or patient pilot was performed.
