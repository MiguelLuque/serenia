# Task7 scoped cleanup correction — 25 October 2026

Status: source checkpoint ready for independent SPEC/QUALITY and operational-order review. Corrected hosted cleanup has **not** been executed by the implementer. ROOT retains exclusive runtime/fixture/remote-write ownership.

BASE: `e6f6c790576b3ad410fe24e789931f1adc176126`. Deliverable is only `scripts/hosted-scenarios.mjs`, `tests/tooling/hosted-cleanup.test.ts`, and this report. ROOT's README, operations, plan, audit and application-record changes are excluded.

## Confirmed failure and retained evidence

ROOT's actual first cleanup returned exit **1** after deleting patient/foreign/browser and recording their three `cleanedAt` values. Deleting the fixture clinician then returned Auth HTTP500. The bounded official log/catalog diagnosis identifies SQLSTATE `23514`, `reviewed_assessment_has_reviewer`: `assessments.reviewed_by` references Auth with `ON DELETE SET NULL`, while the remaining restart patient's reviewed report still references the clinician. The constraint correctly rejects losing the reviewer.

Original private evidence is preserved unchanged:

- `.cache/hosted-task11-root/cleanup-original-20261025.log`: 570 bytes, SHA256 `b3c0846d99e7b48c43df196e122ab559a3de703e169c1cea258d27deab794903`.
- `.cache/hosted-task11-root/cleanup-original-20261025-exit.json`: SHA256 `e0a7e395a946bf321ab1a1dfc144048273460c40be2392bd020adbb13551fe7f`.
- Diagnosis: `.cache/hosted-task11-root/cleanup-diagnosis-20261025.json`.
- ROOT's positive stopped-runtime evidence: `.cache/hosted-task11-root/patched-runtime-stop-20261025.json`. This source task did not probe, start, stop or signal either real runtime.

## Narrow correction

The existing cleanup branch now validates all recorded fixture identities, verifies every previously cleaned actor's **exact recorded Auth ID** absent with `getUserById` (`data.user === null`, HTTP404 and `user_not_found`), and only then starts further deletion. A still-present user, ambiguous null response, unexpected Auth error or thrown error fails closed. No broad Auth listing or identity inference is introduced; the three original durable timestamps are retained.

All remaining patient fixture names retain their manifest order; the exact `clinician` fixture key is placed last. Thus the original partial manifest cleans restart/cron before clinician. The separate patched restart-only manifest remains supported. Newly deleted actors still pass the existing recorded-identity login/getUser checks, global signout, successful admin deletion and then durable `cleanedAt` save. Failure before deletion success cannot create a false deletion marker.

Only `ESRCH` is accepted as evidence that the recorded runtime PID is absent. A live PID still blocks cleanup; `EPERM`, `EACCES` and other probe errors propagate before Auth access. Exact-target, selected-environment, private-directory/file and fixture guards remain in use.

## RED/GREEN and checks

Tests execute the real cleanup CLI branch with private temporary manifests/disk writes. Only external Auth SDK calls and the PID probe are replaced; no hosted credentials, real fixture manifests, database calls or real signals are used. The fake Auth boundary models the observed clinician-reference dependency and explicitly errors on a login to a deleted actor.

| Command | Actual exit | Result / complete private evidence |
| --- | ---: | --- |
| `rtk proxy npm test -- tests/tooling/hosted-cleanup.test.ts` before implementation | 1 | 8 failed / 5 passed; `.cache/cleanup-fix/red.log`, `red.exit.json` |
| `rtk proxy npm test -- tests/tooling/hosted-cleanup.test.ts tests/tooling/hosted-acceptance.test.ts` after implementation | 0 | 19 passed / 2 files; `.cache/cleanup-fix/green.log`, `green.exit.json` |
| `rtk proxy npm run lint` | 0 | No warnings; `.cache/cleanup-fix/lint.log`, `lint.exit.json` |
| `rtk proxy npm run typecheck` | 0 | `.cache/cleanup-fix/types.log`, `types.exit.json` |
| `rtk proxy node --check scripts/hosted-scenarios.mjs` | 0 | `.cache/cleanup-fix/syntax.log`, `syntax.exit.json` |

The RED reproduces `23514` at clinician deletion and the deleted-user login failure on partial resume. Other failing cases prove the absent-ID preflight and fail-closed PID error paths were missing. Five existing-safe behaviors already passed: live-runtime refusal, signout/delete failures without false markers, fixture validation and restart-only cleanup. These five are regression coverage, not newly reproduced defects.

RED log SHA256: `74adcde4020bc812e30f9930551906707b288d8d932b9be4030f4f7d3fa05aca` (6318 bytes). GREEN log SHA256: `62eb413c0635c50e0d6e818aa62a1594a513d971d4dcab9bc53f16c1fd38d60b` (328 bytes). Numeric subprocess exits are saved independently of the log-capture wrapper exit.

## Boundaries and next checkpoint

No actual cleanup, login, fixture/manifest write, runtime change, SQL, history/catalog change, constraint relaxation, clinical-state rewrite or provider operation occurred during this task. Full suite/build/restart were deliberately not repeated under the bounded source-only brief. The previously accepted server remains identified as executable source `f2d69ea088403a3f3e641d20112318b54a344577`, BUILD_ID `7-SFAHJkzrF9ef47Bhjl7`; this external cleanup script change does not relabel that binary.

Canonical applied packet `6f0037fc74e115455e379795cdcb1c5318e4a9f65660d048f8ca5d7af30069b0`, inbox forward `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`, and review-facts forward `86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504` are unchanged. The old40 history and 5 definitions / 65 items were not touched or reverified by this source-only task.

After independent review, ROOT owns the corrected execution once per preserved state, preserving the first failure and verifying final counts. Remote completion remains pending that execution; local GREEN is not a cleanup-success claim.
