# Revisión independiente —continuación25octubre2026

Archivo literal de los informes indicados. Sus límites de aprobación se conservan: los objetos8–15 y la corrección de limpieza están aprobados; el veredicto final sobre ejecución/limpieza/postcheck/documentación aún está pendiente. [Estado técnico](2026-10-25-mvp-acceptance.md). El revisor final original quedó sin un handle disponible durante la interrupción; un reemplazo del mismo nivel continúa el mapa persistido y sólo revisa el delta de cierre. No repite la auditoría de toda la fuente ni los tests aceptados.

## Objetos8–15:pruebas del artefacto corregido

Origen `final-evidence-20261025-review.md`, SHA256 `8e92eb1dd1bc3423d420b4ee52583d0312c38b3ee8b8f95873b36c79e48da189`.

# 25 October final evidence supplement — objects 8–15

## Verdict

**SPEC: APPROVED for evidence objects 8–15 within the controlled synthetic acceptance scope. QUALITY: APPROVED for those objects. Whole-branch/Task7-final approval WITHHELD.** Cleanup is incomplete, its source correction and actual execution/postcheck remain pending, and the final documentary diff has not been supplied. This is the same reviewer and accumulated reading map, not another broad review. No suites, remote queries, runtime actions, helpers or product changes were performed.

The actual application identity is executable `f2d69ea088403a3f3e641d20112318b54a344577`, lock `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`, snapshot `/private/tmp/serenia-hosted-build-w4zDky/project`, BUILD_ID `7-SFAHJkzrF9ef47Bhjl7`, artifact `bc0ef03700d0c28d3de31bb188208916ee110dd08315caab71908c03fee6ca9f`. Earlier objects 1–7 remain accepted only at their original identities in `task-7-evidence-prefix-review.md`; Task11/12 source approvals are reused.

## Findings and strengths

Critical: none newly identified in this evidence supplement. Important: no new application defect identified. **Known incomplete cleanup remains a completion gate**, not a passed acceptance item. Minor: prior deferred M4 waiting-copy observation remains unchanged; this pass does not reopen that source finding.

The strongest evidence is the joined chain from exact SQL identity and real JWT rejection through persisted nonzero questionnaire results, the same generated workflow across an actual process replacement, native clinician review, and a patient-scoped public projection. Private proofs were inspected structurally and compared without printing tokens or clinical bodies. Frozen assertions were recomputed against raw saved data; a PASS label alone was not accepted.

## Reusable reading map and object disposition

### 8 — reviewed immutable-facts forward actually applied: APPROVED

Read `.cache/hosted-task11-root/preapply-20261024.json`, `applied-20261024.json`, `resume-20261025.json`, and `precleanup-20261025.json`. Official apply result is success, followed by actual metadata: history42→43; original40 match; prior canonical/inbox packet hashes unchanged; catalog matches, definitions5/items65. New version `20261024203657`, 8191-byte SQL SHA `86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504`. Routine body changes from `119e629fd31c44c55476ca45d1d88282` to `7f83d3074a279a2740d1bf82a2977ebd`, definition `58534a33fb4c7e30d8af320076b1009e`; postgres owner, SECURITY DEFINER, pinned search_path, authenticated-only execute ACL preserved. Fresh resume07:03 and precleanup07:24 retain those facts. Last observation is precleanup, not final baseline restoration. Counts do not establish full identity equality of original account rows.

### 9 — actual f2 restart of the same generated run: APPROVED

Private state directory `/private/tmp/serenia-hosted-acceptance-patched-20261024-8a6dkdog`:
- `restart-proof.json`, SHA `39d7d8444a01cd9e39aac80f7d1ea70dcaa4388c20bac3c4d2fa4d69081beed8`.
- `patched-runtime-scoped-proof.json`, SHA `e7880d7505d5cb0151024720f61e085e1cfc6ade0b4b9c966efe4b0bdacedd11`.

Recomputed run/input/job-token equality across checkpoint and final, without exposing the token. Run `wrun_01M5RY1CHPA2DXK3F7PKPSV4GY` remains the same, PID31819→31879, job attempt1 and completed; 23 final events, one run_created/run_started/run_completed. Each of three pre-restart completed correlations has exactly one step_started in final events. Structured attempt1 at07:05:14 on31819 precedes attempt2 at07:06:22 on31879 with the same marker. Provider recovery adds zero conversational and one structured call. Checkpoint/verify/capture mode numeric exits0 are present in `.cache/task12/runtime/`.

The planned killed checkpoint launcher exit1/SIGKILL is retained, not converted to a passing terminal exit. This proves generated durable recovery with the controlled synthetic provider, not live model quality.

### 10 — bounded clinical landing/prefetch fixture gate: APPROVED

Read both `patched-clinical-ui-gate-1792912211271.json` and `patched-clinical-ui-gate-1792912442388.json`, plus root observer `.cache/hosted-task11-root/patched-clinical-ui-gate.mjs`. Actual totals are7/7 at07:10:11 and8/8 at07:14:02 after the added UI session. Observer checks errors, safe counts, nontruncation, unique IDs, ownership from two different manifests, recorded sessions, exact combined subset cardinality, generated clinician identity/creation/role, runtime identity and live PID. Reads unrelated sessions only as aggregate head-count; no original profile values. This is the previously bounded interpretation under exclusive fixture-writer control, not authorization for unrestricted clinical navigation.

### 11 — nonzero questionnaire facts and real JWT negative writes: APPROVED

`task11-review-facts-negative-proof.json`, SHA `9a875d40b0618b727746adf6260d07866c538fd055b52cccfa0fc90a80cabfc0`; read observer `review-facts-negative-probe.mjs`. Seven actual modify attempts (omitted/empty/null/changed score/code/band/flags) each return23514 with null result. Before and after assessments/tasks/job are deeply equal. Observer additionally checks equality after each attempt and authenticates known clinician with signIn/getUser before RPC; temporary auth session is signed out locally. Observed07:15:14 precedes clinical positive review07:15:55.

For native session `5e1226f9-4be7-4cdf-930f-ea35fa9b2fa4`, independently sorted persisted answers by item.order_index: `[2,2,2,2,2,2,0,0,0]`, total12, PHQ9/moderate/flags[]. Both saved report arrays equal the complete persisted canonical facts. Three completed turns/six messages, user_request closure, one completed job attempt1, bound generated run `wrun_01M5RYEHYQA4M38F789V30BJ0S`; job token/session match bound input. No rerun or new clinical judgement inferred.

### 12 — native review persistence and patient JWT projection: APPROVED

`ui-5e1226f9-4be7-4cdf-930f-ea35fa9b2fa4-POSTREVIEW-FINAL-2026-10-25T07-25-35-131Z.json`, SHA `b912b8b889f000e7999998973628bfd53bbfcaee09224a622e5911ed58494817`, plus validation and strict-frozen-validation records. Original `39c93728-e033-43ab-b6d8-f12550923d89` is superseded by exactly one reviewed_modified `8ef7bc0f-8c9a-43e2-a8fc-51f9ac725794`. Exactly one task is linked to that successor. Patient task projection is the intended field subset; all returned fields match the persisted task, not literal full-row equality.

Recomputed patient login/getUser identity matches scoped actor, public summary exactly equals reviewed patient_facing_summary, raw assessment query is successful HTTP200 with empty data, and synthetic private markers are absent from patient projection and full AX capture. Local temporary auth signout has no error. Scope is technical authorization/projection, not clinical appropriateness of the synthetic summary.

Provider.jsonl is actually41 lines. Rehashed prefixes15=`a94e63ea45418c439e53fe68d5931b4a88918d197ae6bf39d2662ca19c3d7a72`,24=`85588c36446abd36e04e2b5e4cb4ddb2b16faa9f29a2c4f9a61c344e88cb169f`,41=`54377d492ac5bd302c42a8726621f2f9793da3347b4632b5d26e2b04823d4e4d`. Actual final model rows8conversational/3structured; UI delta24→41 adds3/1, zero fast/denials. This preserves and extends the restart prefix.

### 13 — native visual outcome and honest timing failure: APPROVED

Viewed actual screenshots, not merely filenames:
- `.cache/acceptance/hosted-score12-reviewed-facts.png`: PHQ9/12/moderate after clinician review;42852B SHA `1fde4ed3310ea7178fc43e11f41c3e5f056ee0aae387a5ec13f569fcf8669d23`.
- `hosted-patient-reviewed-final.png`: public summary and one agreement;51429B SHA `2945b8bea310f284b5565e9ef93a62b0492844a862fcf2984649e76cdf3a60f7`.
- `hosted-patient-reviewed-ax.txt`:1279B SHA `b5b664389eabea1eed86fc37116062bb4ca8752f7117b32bb43000fd072a9c31`.

The07:16:21 capture labelled before-clinical actually follows07:15:55 review. Its stored validator fails `2 !== 1`, command exit1; this is preserved as a mistimed evidence assertion, not a failed generation or a pre-review screenshot. Negative proof supplies the earlier exact draft state. Earlier AX-diff/full-state capture correction is not treated as functional evidence of a bug.

### 14 — artifact remains exact and fresh audits clean: APPROVED

Read final artifact/audit records and independently hashed all876 paths in original `/private/tmp/serenia-hosted-build-w4zDky/artifact.json` against the still-present snapshot: every original file and BUILD_ID matches. Approved cache exclusion semantics are reused from their source review, not broadened. Root aggregate remains `bc0ef037…`.

Read both raw npm JSON and numeric exit files in `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-audit-XG209o`: production/full exits0, all severities and total0, raw SHA each `baf87cca589fb484c517ea947ef14149a97a03111356771e7aaf00cd5db92213`. These are dated observations, not a future vulnerability guarantee. No audit rerun.

### 15 — positively identified runtime stopped: APPROVED with terminal-exit limit

Read old-runtime-graceful-stop and `.cache/hosted-task11-root/patched-runtime-stop-20261025.json`. Before shutdown, lsof/ps identify PID31879, loopback3000 and exact w4zDky cwd. SIGTERM accepted07:27:43, subsequent ESRCH/pid absence, old11147 absence, port query exit1/empty. This supports listener/process cessation. Final launcher handle was unavailable; launcherExit is null, so **no actual final launcher exit0 is claimed**. Historical planned SIGKILL/exit1 remains separately documented.

## Pending gates / declined to judge

- Cleanup actual exit1 in `.cache/hosted-task11-root/cleanup-original-20261025-exit.json`; original manifest marks only patient/foreign/browser cleaned at07:28:18–19. Clinician/restart/cron and separate patched restart actor remain unmarked. Do not infer final2Auth/2profiles or clinical0. Root reports clinician23514; this review independently confirms failure and partial manifest state, without promoting the reported error code from a generic cleanup log.
- Await exact cleanup-only source/test supplement for independent SPEC/QUALITY, then root actual cleanup and fresh history/catalog/ACL/clinical/account aggregate postcheck. No constraint or hosted schema relaxation authorized by this review.
- Await final documentary diff/application record/advisor dispositions. Final broad approval remains pending; accepted evidence objects can be reused without repetition.
- Clinical/legal approval, clinical model validation, public deployment/production operational acceptance remain outside this technical synthetic evidence verdict.


## Corrección del harness de limpieza

Origen `task-7-cleanup-fix-review.md`, SHA256 `dc48f909f3310a333f71516d77677735b23bb6de5b3470b8c23b5cf1360cae42`.

# Task 7 cleanup correction — independent scoped review

Review date: 25 October 2026. Reviewer: `final_closure_review`, replacing the unavailable retained final reviewer. This is the requested bounded continuation, not a new audit of accepted objects 1–15.

## Source and evidence identity

Reviewed package: `review-e6f6c79..bc3c091.diff`, BASE `e6f6c790576b3ad410fe24e789931f1adc176126`, source checkpoint `bc3c0917fe69973ca854a164aace759be0b7bd88` supplied by ROOT. Exact scope: the cleanup branch of `scripts/hosted-scenarios.mjs`, new `tests/tooling/hosted-cleanup.test.ts`, and `task-7-cleanup-fix-report.md`. Requirements: `task-7-cleanup-fix-brief.md`.

Read the saved RED exit and GREEN/lint/typecheck/syntax logs and numeric exits under `.cache/cleanup-fix/`. RED exit 1; GREEN exit 0, 19 tests in 2 files; lint, typecheck and syntax each exit 0. No check was rerun. The original hosted failure and diagnosis are retained evidence referenced by the brief/report, not independently re-fetched by this review.

The accepted application executable remains source `f2d69ea088403a3f3e641d20112318b54a344577`, BUILD_ID `7-SFAHJkzrF9ef47Bhjl7`. The reviewed external cleanup correction does not relabel that server artifact.

## SPEC: PASS

The delta puts the exact clinician fixture last while preserving the relative order of the remaining fixture names. It validates every recorded fixture identity before deletion, verifies every `cleanedAt` actor by its exact recorded Auth ID before any further deletion, and skips it only when the response combines `data.user === null`, HTTP 404 and `user_not_found`. Present users, ambiguous null responses, other errors and thrown errors fail closed. Previously saved timestamps are retained.

New deletions retain the existing identity-checked login, global signout, successful admin deletion, then durable `cleanedAt` order. The PID probe accepts only `ESRCH` as absent; live processes and all other probe errors block cleanup. No product API, SQL, constraint, clinical rule, model, target or environment guard changes appear in the reviewed delta.

## QUALITY: PASS

No blocking finding in the exact delta. The focused tests execute the real cleanup branch with temporary private manifests and mocked external Auth/PID boundaries. They cover reviewer dependency order, partial resume and timestamp preservation, inconsistent markers, unexpected lookup responses, ambiguous absence, PID errors/live PID, signout/delete failures without false markers, fixture identity rejection and the separate restart-only manifest. Saved checks support this bounded harness change; they do not establish hosted cleanup success. Full-suite/build replay is neither claimed nor required by this brief.

## Operational clearance: APPROVED for the bounded ROOT execution

ROOT may execute the reviewed cleanup against the two preserved task-owned states after retaining the stopped-runtime evidence. Clean the patched **restart-only manifest first**, then resume the original six-actor manifest. This keeps patient fixtures across both states ahead of the shared fixture clinician, including any cross-manifest reviewer dependency. The original manifest's three completed actors must pass the new absence preflight; its remaining restart/cron patients precede clinician deletion. Do not bypass an unexpected failure or rewrite a marker to force progress.

This clearance is limited to Serenia `brpozobkoatabctjjadc` and the recorded generated fixture identities. Preserve the original failure, diagnostic evidence, three SQL hashes, original 40 history entries and catalog of 5 definitions / 65 items. No reset, repair, constraint weakening, clinical-state rewrite, real data operation, public deployment or provider spend is authorized by this review. ROOT remains the exclusive remote/runtime/fixture writer.

## Closure remains pending

This is source approval and operational clearance only. Actual cleanup exits, exact fixture absence/postchecks, preserved history/catalog evidence and the final documentation diff remain to be reviewed. No whole-branch technical-MVP completion verdict is issued here. Previously accepted review packets remain authoritative for unchanged objects; the final closure review will inspect only the new cleanup/postcheck/documentation evidence.


El veredicto de cierre se añadirá cuando se revise la ejecución y su postcheck; estos checkpoints no lo anticipan.
