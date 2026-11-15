# Task 3 independent review — `d4b39e8..b317342`

Scope: read-only review of the supplied diff, Task 3 brief/report, design spec, and model research note. No source tree, index, branch, runtime, tests, database, provider, network, credentials, or environment files were accessed for this review.

## Verdict

**Spec: substantially met, with one input-validation defect. Quality: good for an offline planning artifact; fix the defect before accepting the cost library as fail-closed.** Findings: **C 0 / I 1 / M 0**.

### I1 — Invalid usage can yield a numeric estimate or be classified only as missing

`checkedUsage` in `lib/shared/llm/model-costs.ts` rejects cache tokens exceeding total input only when **both** cache counters are known (diff lines 63–69). For example, `priceAttempt('openai/gpt-6-luna', { inputTokens: 10, outputTokens: 0, cacheReadTokens: 11, cacheWriteTokens: null })` returns `unknown/usage_missing`, although the known read counter already makes the usage impossible. The brief explicitly requires rejecting cache counts greater than input. Validate each known cache counter against known input, then the sum when both are known.

`estimateProjection` skips `priceAttempt` for every zero-call group (diff lines 102–117). Thus a group with `calls: 0`, known model ID, and `inputTokens: -1` returns `{ status: 'estimated', usd: 0, calls: 0 }` instead of rejecting the invalid counter. Explicit zero calls may have unknown usage, as the existing test demonstrates, but known invalid integers should still be rejected. Validate known counters for every group before skipping price calculation. Add focused tests for both examples.

## Checks from the supplied artifacts

- **Cost math:** per-call tier lookup uses each call's input total; 272,001 OpenAI and 100,001 Haiku enter the long tier. Ordinary input, cache read, and cache write are disjoint. Output is a single billed counter that includes reasoning, so it is not charged twice. Positive use of a missing rate and unsupported processing modes return `unknown`; an unknown nonzero group makes the projection unknown while preserving the complete call total. Retry/continuation groups add calls rather than replace earlier attempts. The short-context synthetic totals are arithmetically correct: 41 current calls `$0.37725`/`$0.10100`; 25 hypothetical calls `$0.23325`/`$0.08340`.
- **Snapshot and CLI:** the diff contains six exact requested model IDs, a dated Standard snapshot, source URL, full-catalog hash, and the relevant price/tier arrays. The CLI imports the pure module, prints JSON, and contains no provider, fetch, dotenv, credential, or online transport path in the reviewed code. `onlineCalls: 0` and `measured: false` are program output and labels, not independent measurement. Public catalog metadata does not establish team access, transport compatibility, or production billing. Reported source/catalog hash and runtime results were not independently rerun under this review's scope.
- **Evaluation plan:** the manifest keeps all 26 seed IDs and adds P01–P17, with P01–P15 proposed for provider review and P16/P17 state only. The cap is 18 conversation + 30 profile + 26 report = 74 planned provider calls. `(18×2050 + 30×1350 + 26×92000)/1,000,000 = $2.4694` at the stated short-context Standard prices. The ceiling is conditional on one capped attempt per case/candidate and the listed exclusions; it is not a bill or spend approval. Urgent R01/R02/R08 remain deterministic, high-signal R03–R06 are not rerouted for chat benchmarking, and clinical labels/transport remain `ONLINE_NOT_RUN` and pending human review.
- **Verification evidence:** the Task 3 report cites focused RED/GREEN, lint, typecheck, full 1,146-test suite, and CLI logs. These are reported local results only; this review did not rerun them. Build, dependency audit gate, hosted/database operations, online generation, and clinical acceptance are outside Task 3 and remain unverified here.

## Declined scope

No runtime or source-tree inspection, rerun, provider call, credential check, environment inspection, dependency gate, branch/index operation, or production change. No assertion that candidates have clinical quality or that the public tariff will match a later route or bill.
