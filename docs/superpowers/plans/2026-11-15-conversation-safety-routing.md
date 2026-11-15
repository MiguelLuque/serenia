# Implementation plan: conversation safety routing

**Spec:** [Conversation safety routing](../specs/2026-11-15-conversation-safety-routing.md)

## Global constraints

- The classifier is a routing aid, never a diagnosis or C-SSRS score.
- Keep raw text separate from disposition. Only `explicit_current` may use the existing direct-crisis path; contextual and ambiguous cues must not create its high-severity event or close a session.
- A safety-answer candidate is accepted only against a versioned prompt marker found in the immediately preceding, completed, server-stored assistant response while the session row is locked.
- Preserve request idempotency, turn fencing/replay, session time/inactivity behavior, owner checks, generated database types, least-privilege RPC grants, and all existing conversation paths.
- No hosted Supabase write, variable change, paid provider call, push, merge to shared branch, or deployment in this plan. Local database verification only after confirming the shared local stack identity.
- A clinician review is still required before a patient pilot; passing code checks does not establish clinical validity.

## Task 1 — Signal dispositions and answer candidates

Implement the pure `classifyCrisisSignal` contract in `lib/shared/chat/crisis-detector.ts` while preserving `detectCrisis` as a lexical helper. Add `classifySafetyClarificationReply` as a pure helper. Test Spanish media/education, quoted attribution, third-party, denial, historical, ambiguous, direct current suicide, direct current self-harm, mixed contextual/current clauses, mixed denial/current clauses, affirmative/negative/unclear/skip replies, and unsupported or compound answers. Context must never mask a direct current first-person statement. No clinical severity is inferred here.

## Task 2 — Prompt-bound database transaction

Add a forward-only migration that stores the validated safety answer and its risk type on `chat_turns`, validates the prior server marker under the existing session lock, preserves the first answer on retry, and creates at most one moderate provisional event for an affirmative prompt-linked answer. Extend the existing turn RPC with defaulted trailing parameters for direct signal type and answer candidate/type/requirement so old argument shapes remain compatible after replacing the old function signatures. Direct events use the detected topic type and an explicit provisional/non-diagnostic payload. Reject invalid/mismatched candidate types, never accept a client-supplied marker, preserve stale/closed/hard-time-limit behavior, and retain service-role-only execute grants. Add SQL assertions for every acceptance case, including forged/stale markers, replay, no duplicate events, direct type, and unchanged limits.

## Task 3 — Route dispositions through the actual chat flow

Use the new classifier before admission. Only direct current signals set direct-crisis arguments or bypass ordinary inactivity. Contextual cues go to normal generation with no safety notice. Ambiguous cues produce a deterministic, domain-specific one-time question with a typed server marker and no risk event. Validate/store replies through the new RPC, route affirmative to a provisional typed event and brief resources, acknowledge negative, and let unclear/skip stop repetition. Make all closure decisions depend on direct current signal or the existing time/consent contract, never on a lexical match. Update API/harness tests for context, route, marker trust, retries, and time boundaries; update the crisis protocol documentation to reflect this route and human-review boundary.

## Task 4 — Verify and record gates

Run focused unit/API/SQL tests, then the repository verification entrypoint and database verification only against a confirmed local stack for this checkout. Inspect the complete diff, run a fresh scoped review, and document exact results, failures, and unrun hosted/runtime/clinical gates. Do not claim live OpenAI quality, deployment acceptance, or clinical validation from synthetic/local results.
