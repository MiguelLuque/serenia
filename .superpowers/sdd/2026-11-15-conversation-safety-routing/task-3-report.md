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

## Files

Route: `app/api/chat/route.ts`; request boundary and client reference: `lib/server/chat/request-boundary.ts`, `lib/shared/chat/safety-prompt.ts`, `components/chat/chat-view.tsx`; classifier skip refinement: `lib/shared/chat/crisis-detector.ts`; tests/harness: `tests/api/chat-safety-routing.test.ts`, `tests/api/chat-route.test.ts`, `tests/chat/clinical-pilot.test.ts`, `tests/chat/close-session-tools.test.ts`, `tests/chat/crisis-detector.test.ts`, `tests/chat/request-boundary.test.ts`, `tests/chat/safety-flow.test.ts`, `tests/helpers/chat-harness.ts`; protocol: `docs/agents/protocols/crisis.md`.
