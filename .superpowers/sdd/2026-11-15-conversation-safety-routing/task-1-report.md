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

## Scope and limitations

The classifier uses deterministic lexical/context patterns. It does not infer clinical severity and is not a validated screener. The broad linguistic limits of those heuristics remain for later review; this task intentionally does not modify persistence, route behavior, migrations, or protocol documentation.
