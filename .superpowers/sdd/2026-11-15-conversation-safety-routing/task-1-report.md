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

## Task 1 follow-up: direct denials and additional explicit statements

- Added RED tests for six direct negations, six additional personal intent/plan statements, and a denial followed by a positive clause. Eleven assertions failed before implementation.
- Explicit routing now requires an affirmative, direct intent/plan/behavior pattern; direct negation cannot satisfy it. Positive clauses after a separate denial remain eligible and retain priority. Added Spanish patterns for first-person suicide intent, planned self-harm, and stated current behavior.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 90 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,354 passed and 4 failed in dependency integration. Child processes fail binding localhost with exact error `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: scoped negation and self-harm direct signals

- Added RED cases for `no dejo de`, `no me atrevo`, `no solo quiero`, direct self-harm ideation/plan, and mixed explicit suicidal/self-harm clauses; 7 cases failed before the change.
- Replaced broad negation suppression with specific clear-denial patterns. Other negative constructions remain ambiguous; `no solo quiero` is read as direct affirmative desire. Added direct self-harm ideation, intent and plan phrases. Explicit suicidal ideation takes precedence over self-harm when both clauses are explicit, independent of order.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 98 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,362 passed and 4 failed in dependency integration. Child Node listeners are blocked with `listen EPERM: operation not permitted 127.0.0.1`.

## Scope and limitations

The classifier uses deterministic lexical/context patterns. It does not infer clinical severity and is not a validated screener. The broad linguistic limits of those heuristics remain for later review; this task intentionally does not modify persistence, route behavior, migrations, or protocol documentation.

## Task 1 follow-up: categorical negation and combined topics

- Added RED tests for `nunca/jamás` denials, uncertain `no creo que quiera`, both orders of combined suicidal-ideation/self-harm cues in one clause, and retained `no solo quiero` affirmation.
- Clear denial now requires a narrowly matched negative predicate; uncertainty remains ambiguous. When both cue families occur in one clause, suicidal ideation wins consistently.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 103 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,367 passed and 4 failed in dependency integration. Child listeners return `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: restrict `no solo quiero` intent

- Added regression coverage preserving `No solo quiero suicidarme` as explicit while routing `No solo quiero hablar de suicidio` as contextual conversation content. RED reproduced the second case as incorrectly explicit.
- Narrowed the `no solo quiero` direct-intent alternative to recognized self-directed acts and marked ordinary discussion about suicide as contextual.
- Focused suite: 104 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. The full suite was not rerun for this regex-only follow-up.

## Task 1 follow-up: conversation topic vs personal intent

- Added RED coverage for direct suicidal ideation embedded in a conversational-topic phrase, ordinary talk about suicide, and an attributed third-party quote. The two personal-intent cases failed before the fix.
- Split broad conversational context from third-party attribution. Topic mentions no longer suppress a separate direct personal intent in the same clause; explicit attribution to another person still routes contextually.
- Focused suite: 107 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. The full suite was not rerun for this narrow classifier follow-up.
