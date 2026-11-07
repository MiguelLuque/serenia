# Task 3 — offline cost projection and evaluation plan

Status: **IMPLEMENTED AND LOCALLY VERIFIED**. Commit `b317342` (`feat(llm): add offline model cost projection and evaluation manifest`) on base `d4b39e8`. Only eight assigned files were committed. Root-owned builder/audit/research/spec/plan work was not staged or changed.

## Artifacts and arithmetic

- Pure `lib/shared/llm/model-costs.ts` uses exact Gateway model IDs and the committed filtered `pricing-snapshot-2026-11-01.json`; the latter is byte-identical to `.cache/model-research-20261101/selected-price-snapshot-draft.json`. Its authoritative full-catalog SHA-256 is `a0f22c61b24b6c3d7533ff1cfc581abe9ab30cc470edb79cce018f04660f45a8` (locally rechecked). Standard input/output/cache tier arrays choose the tariff per call, including the 272,001 OpenAI and 100,001 Haiku boundaries. Input cache classes are disjoint; billed output includes reasoning. Missing usage yields `unknown`, unsupported modes and missing positive-use rates yield `unknown`; invalid counts/model IDs throw. Additional attempts remain additional billed call groups. Legacy `CANDIDATE_PRESETS` and the existing offline evaluator were untouched.
- `npm run ai:costs` prints JSON only from the TS entrypoint, with no provider import, fetch, dotenv, credential read, or online call. It reports **41 calls** at current synthetic cadence: all mini `$0.37725`, Luna/Luna/Sol `$0.10100`. The separate hypothetical four-profile cadence has **25 calls**: `$0.23325` and `$0.08340`. No runtime cadence changed.
- `docs/research/2026-11-01-model-evaluation-manifest.md` fixes the existing 26 seed IDs (fixture SHA `eb4f218a28e25d40b990803d14addef7f2a97b9caf3111f4da9226d6fc90d8a4`) and 17 new fictional profile cases (SHA `70f5608956e82fdf1728d63745cdd720170546f29072db3718097b84c97d0332`). P16/P17 are state only. The future candidate matrix caps 18 conversation, 30 profile, 26 report calls, with per-call input/output caps and a `$2.4694` maximum base Standard token estimate. It explicitly marks transport, clinical review, and online generation **ONLINE_NOT_RUN**.

## Verification

| Check | Result | Full log |
| --- | --- | --- |
| RED after stubs, focused cost tests | 5 expected failures | `.cache/pablo-pilot/logs/20261101-221505-lhprpe5_.log` |
| RED for unknown-group call total | Expected 1 versus 3 | `.cache/pablo-pilot/logs/20261101-221811-0o4f6odp.log` |
| Focused GREEN after correction | 2 files, 6 tests | `.cache/pablo-pilot/logs/20261101-221821-gk1r9co5.log` |
| `npm run lint` | Exit 0 | `.cache/pablo-pilot/logs/20261101-221826-cqtgjh4q.log` |
| `npm run typecheck` | Exit 0 | `.cache/pablo-pilot/logs/20261101-221826-_6ykfm5h.log` |
| Full `npm test` (authorized local loopback for existing transport probes) | Exit 0; 92 files, 1,146 tests | `.cache/pablo-pilot/logs/20261101-221836-dlskqzn2.log` |
| `npm run ai:costs` and direct `node --import tsx scripts/model-costs.ts` | Exit 0, expected JSON/arithmetic and `onlineCalls: 0` | `.cache/pablo-pilot/logs/20261101-221722-3893opzf.log` plus direct stdout |
| `git diff --cached --check`, snapshot `cmp`, fixture/catalog SHA-256 | Clean, identical, matching | terminal checks before commit |

The full suite emitted the existing `Timeout duration was set to 1` warning but had no failures. A first typecheck caught a test subprocess environment typing error; it was corrected before the final passing run. No build, audit dependency gate, hosted operation, provider call, or clinical evaluation was run in Task 3. Root owns clean-build completion and the already known audit dependency block (22 production / 37 full); those results were not re-run or interpreted as passing.

## Limits

These costs are synthetic token estimates, not observed usage or a spend authorization. Positive cache writes require the listed base retention tariff to match the actual route; longer retention, region, batch/fast/flex, tools, storage, tax, retries, and tokenization changes are outside the base scenarios. The public catalog does not prove team access or Gateway transport compatibility. Human clinical review and actual usage/cost remain pending.

## Review fix, round 1

Independent review I1 was reproduced and fixed in scoped commit `f68f195` on `b317342`. `checkedUsage` now rejects either known cache counter above known total input even when the sibling counter is `null`, and still checks their sum when both are known. `estimateProjection` validates known counters for **every** group before skipping zero-call pricing. Explicit `calls: 0` with all usage unknown remains estimated at `$0` because no call occurred. No price table, CLI scenario, evaluator contract, or other artifact changed.

| Check | Result | Full log |
| --- | --- | --- |
| Focused RED, both review reproductions | 2 expected failures in the cache-sibling and zero-call tests | `.cache/pablo-pilot/logs/20261101-222254-lyde60li.log` |
| Focused GREEN, `npm test -- tests/llm/model-costs.test.ts tests/llm/model-costs-cli.test.ts` | Exit 0, 2 files / 8 tests | `.cache/pablo-pilot/logs/20261101-222304-7v8n09ar.log` |
| `npm run lint` | Exit 0 | `.cache/pablo-pilot/logs/20261101-222308-t2e652zb.log` |
| `npm run typecheck` | Exit 0 | `.cache/pablo-pilot/logs/20261101-222308-2wnnhywt.log` |
| `git diff --cached --check` | Clean | terminal check before `f68f195` |

Per root's scoped-review instruction, the full suite, dependency audit, and build were not repeated for this small fix. Root will run global checks later. No online/provider call was made.
