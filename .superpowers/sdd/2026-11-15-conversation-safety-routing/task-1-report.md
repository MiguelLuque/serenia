# Task 1 report — signal dispositions and answer candidates

## Implemented

- Added `classifyCrisisSignal` and exported disposition/risk types in `lib/shared/chat/crisis-detector.ts`; retained `detectCrisis` lexical matching and its return shape.
- Added `classifySafetyClarificationReply`, which preserves `skip` separately from `unclear` and only accepts unambiguous standalone yes/no replies.
- Added unit coverage for contextual Spanish/media/education/quoted/third-party/denial/historical mentions, direct current suicide and self-harm statements, mixed clauses, ambiguous statements, and clarification response categories.
- The routing helper is explicitly documented as conversation routing, not clinical severity inference or diagnosis.

## Verification

- RED: the new focused tests failed before helper implementation (missing exports).
- `rtk npx vitest run tests/chat/crisis-detector.test.ts`: passed, 35 tests.
- `rtk npm test`: 99 test files passed and 1 failed; 1,299 tests passed and 4 failed. All four failures were in `tests/tooling/dependency-integration.test.ts`, where child Node processes were denied listening on `127.0.0.1` (`listen EPERM: operation not permitted`).
- `rtk git diff --check`: passed.

## Independent review follow-up

- Review identified clause-wide context masking, topic precedence errors, missed current cutting, overconfident explicit routing for conflicted ideation, and a negative clarification phrasing gap.
- Added regression coverage first; RED: 8 requested cases failed before the fix.
- Reworked routing to classify cue-bearing clauses independently, prioritize an explicit personal current clause, prefer self-harm when that is the explicit clause, and leave uncertain/contradictory language ambiguous. Added current cutting and historical injury handling without inferring intentionality from `me hice daño hoy`.
- Clarification now recognizes `No, no estoy pensando en eso` as negative while compound or contradictory replies remain unclear.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 44 tests.
- Full suite: `rtk npm test` had 99 files pass and 1 fail; 1,308 tests passed and 4 failed. All four remain `tests/tooling/dependency-integration.test.ts` child-process localhost bind failures (`listen EPERM: operation not permitted 127.0.0.1`).
- Routing remains heuristic conversation triage, non-diagnostic, and not a validated screener.

## Task 1 follow-up: ordinary grooming and type narrowing

- Added failing cases for hair/nail grooming, mixed-context risk type, `No quiero vivir`, and unequivocal denials.
- RED: 6 assertions failed before the changes. Added grooming exclusions for ordinary `cortarme`/`me corto` language; current self-harm cases (`me corto ahora`, `me estoy cortando`) remain covered and pass.
- Ambiguous classification now preserves the risk type of the ambiguous clause, so an earlier contextual clause cannot overwrite it. `No quiero vivir` is ambiguous; direct denials such as `No quiero suicidarme` stay contextual.
- Added explicit `ClauseClassification`/`CrisisDisposition` typing to remove the prior TypeScript inference error.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 51 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,315 tests passed and 4 failed in `tests/tooling/dependency-integration.test.ts`. Each failure is a child Node server bind error, `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: grooming scope and negation

- Added RED tests for progressive hair/nail grooming, negation scope, clear future denials, and shared `quiero` scope across coordinated clauses; 7 assertions failed before the fix.
- `Me estoy cortando el pelo/uñas` now remains `none`. `No quiero dejar de pensar en suicidarme` and `No quiero dejar de autolesionarme` remain ambiguous. `No voy a suicidarme` and `No voy a autolesionarme` are contextual denials. Coordinated `Quiero cortarme el pelo y quitarme la vida` retains the explicit suicidal-ideation clause.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 58 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,322 tests passed and 4 failed. All four failures remain child-process bind denials in `tests/tooling/dependency-integration.test.ts`: `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: clause boundaries and explicit-current threshold

- Added the re-review cases first; RED: 7 test cases failed before the fix.
- Clause boundaries now retain whether a clause follows a clear `y` coordination or punctuation/other connector. Positive `quiero` carries only over `y`, and never from a negated clause. Semicolon clauses do not inherit intent.
- `No quiero dejar de...` and `No voy a dejar de...` remain ambiguous. Clear `No voy a suicidarme/autolesionarme` remains contextual. Broad wishes to disappear or end everything no longer cross the `explicit_current` threshold on their own.
- Accepted direct personal statements remain explicit; coordinated positive intent with `quitarme la vida` or `matarme` remains explicit.
- Focused suite: 70 tests passed. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,334 passed and 4 failed. All four are in `tests/tooling/dependency-integration.test.ts` due child Node servers receiving `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: explicit intent and behavior boundary

- Added RED coverage for temporal broad expressions and explicit plan, intent, and behavior phrases. Seven cases failed before the update.
- Temporal words no longer elevate broad/figurative `desaparecer` or `acabar con todo` language. Added direct patterns for stated plan, imminent intent, current cutting, current intentional harm, and current self-injury while preserving `me hice daño hoy` as ambiguous.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 77 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,341 passed and 4 failed in `tests/tooling/dependency-integration.test.ts`. All failures report `listen EPERM: operation not permitted 127.0.0.1` for child Node servers.

## Scope and limitations

The classifier uses deterministic lexical/context patterns. It does not infer clinical severity and is not a validated screener. The broad linguistic limits of those heuristics remain for later review; this task intentionally does not modify persistence, route behavior, migrations, or protocol documentation.
