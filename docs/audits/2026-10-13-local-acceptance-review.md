# Spec compliance — Approved

Task-scoped independent review of `84fdf48eb3ea380f48f7f8b749c1e34fbebc07bc..a69651bf9d3877f367aa03355ce294b6b99eaf7e`. This is not the separate whole-branch review or production approval.

Implementation and final local acceptance evidence are consistent with the Task6 brief. The updated `browser-acceptance.md:11-22` records B01–B12, preserving c345 provenance for original cases and a696 for affected B02/B04/B09/B12. Their newly supplied persistence JSONs and the tracked audit closure were read before this verdict. Documentation-only follow-ups 8872de0/26da7f0 archive the final evidence without relabeling the a696 runtime. The separate whole-branch review and external clinical/legal/model/production gates remain controller-owned; this approval does not close them.

## Strengths

- `instrumentation.ts:3` uses the real Node startup lifecycle and public Workflow World start method. `scripts/acceptance-provider.mjs:1,77` configures the global ProviderV3 without lifecycle overrides, handler registration or manual requeue. Actual c345 persisted event history contains one original run, a durable retry and completion after PID4800→5051; the three steps already complete before interruption each have one start event.
- `scripts/acceptance-local.mjs:5,21,36` enforces exact loopback origins, positive-list child environment and private canonical state; `scripts/acceptance-start.mjs:23,30` checks live-port availability before replacing runtime identity and launches the snapshot's actual Next CLI with its provider preload. No app bypass endpoint is added.
- `app/api/chat/route.ts:49,99` guarantees existing static resources for newly admitted high-signal turns before model/context work. `tests/chat/safety-flow.test.ts:14,38` exercises normal admission and failed persistence/retry/replay. Approved labels, resources, cuts, minimum18 and time windows are not edited by this diff.
- `supabase/migrations/20261012084307_acceptance_strict_rls_advisors.sql:1,13,25,37` preserves the mixed PUBLIC/authenticated policy applicability rather than widening the owner arm. `scripts/test-database.py:57` checks grants/non-SELECT contracts; `supabase/tests/read-policy-equivalence.sql:1,193` compares actual old/new readable rowsets for five actors across nine tables. This evidence remains distinct from real local Auth/JWT/PostgREST tests.
- `components/onboarding/profile-form.tsx:18` preserves the editable rejected draft without changing the server action/redirect. `components/clinician/assessment-view.tsx:315,635` scopes draft review/reject controls while retaining editing. New tests cover rejected form resubmission and refreshed reviewed versions.
- `README.md:5,25,69` provides installation, isolated build/stack/runtime commands and external gates. `docs/operations/dependency-gates.md:21` retains the exact temporary dev advisory exception and does not represent the full audit as clean.

## Issues

### Critical: 0

### Important: 0

### Minor: 2

1. `scripts/acceptance-scenarios.mjs:107-113`: the checkpoint observer accepts any newly finalized `step_retrying` event, then records it beside the newly created actor and kills the runtime PID. README requires all other jobs to finish first, and the actual submitted evidence is correctly correlated, so this does not invalidate that proof. Bind the observer to the actor's recorded assessment job/run ID, and break immediately after the selected checkpoint, to avoid misattribution if another run retries or multiple files match in one scan.
2. `tests/chat/safety-flow.test.ts:38-47`: the new two-case persistence-failure regression emits expected application errors on stderr. The existing final suite passes, but its log is not pristine; asserting and restoring a scoped console.error spy would retain the failure-path contract without hiding future unexpected warnings. Broader pre-existing failure-test noise is outside this task's diff.

## Evidence inspected; no suite reruns

- Full 4,610-line diff read in bounded passes. Two output-truncated spans were recovered from the diff only; no changed source file was reread separately. No git commands, app/SQL changes, remote operations or child agents were used. Only this requested review artifact is written.
- `.cache/acceptance/verify-reviewed-final.log:5-11` and the corresponding private BrYljo logs confirm all seven native gates, 703 tests/62 files, zero lint warnings, typecheck, wire20 previous payloads/24 current roundtrips, SQL migration/authorization/concurrency/rowset checks and default isolated build. Default build source is fc85c64, not a69651b.
- A focused identity check of 285 app/lib/components/scripts/tests/Supabase/config/lock source files found no fc85c64→a69651b snapshot differences. The final separate local-acceptance build metadata/result identify source a69651b, Node24.14.1, lock86749cc76613926df395608ea88f243ad40a3e1e26e0ea86c1ff8df0f7c476a4, BUILD_ID OOrpDCjjdtiUNgpwuIRTB and exit0. Both build logs have no warning/error/deprecation lines.
- `.cache/acceptance/db-verify-browser-fixes.log:6-20` confirms strict local function lint, zero advisor findings and CLI public-type comparison. Native SQL shim is not treated as Auth/JWT proof.
- Private BrYljo `audit-dependencies.log:5-6`: production advisories0; full5 high entries through the exact GHSA-vfj7-8cjw-p6xm development exception until2026-10-18T00:00:00Z. Full npm audit exit1 is retained and is not relabeled clean.
- `.cache/acceptance/c345887-same-run-green.json` was cross-checked against all23 persisted events for wrun_01M4QQ3KQ4975P5PRBHDHYR9MD and the actual post-restart PID5051 provider/HTTP ledger. Original generation step survives retry; one post-restart structured call; one original job/run, attempts1 and one draft before review. Source bytes for instrumentation, workflow generator/dispatch, model selection, launcher/environment and lock are unchanged c345→a696. This is carry-forward evidence, not a newly executed a696 restart.
- `/private/tmp/serenia-acceptance-c345887/final-generated-smoke.json` independently identifies the a696 runtime PID15377, actual HTTP flow/step callbacks, six completed steps, one structured call, one draft and zero denied network/model attempts. This is a fresh generated-runtime smoke, not a checkpoint restart.
- `.cache/acceptance/final-reviewed-prompt-trace.json` identifies a696,28 NFT files, exactly the two active prompt assets plus package.json, zero environment and outside assets.
- Installed Workflow preparation and repository Supabase/dependency operating guides were read to assess the startup, RLS and artifact evidence. No medical/model quality, legal, hosted integration, queue ingress or production gate is upgraded by this review. Task7 documents in the range are separately authorized preparation only.

- Final browser evidence: `browser-acceptance.md:12,14,19,22,36-40` plus tracked `docs/audits/2026-10-12-local-acceptance.md:95-135`. B02 has visible server minor rejection preserving all fields/acknowledgement, DOB-only correction and correct home/sidebar; private `final-browser-profile.json` confirms actual authenticated user, one complete patient profile and one current server-recorded consent. B04 private `final-browser-questionnaires-0602ae7d-cc99-4e39-a45e-e91caba51c3d.json` has nine unique PHQ answers/one result, generic completion and ordinary replies; CSSRS has seven normalized answers/one result. B12 private `final-browser-questionnaires-2ec5bd66-f886-4fbd-a109-b96af6153295.json` has first scored CSSRS and a distinct second proposed instance with zero answers/results, corroborating controller-native branches and fresh unselected radios after reload. B09 controller-native final reviewed view has Edit1/Confirm0/Reject0 and preserved full fields; earlier real-JWT version/task/private-projection proof remains separate. This reviewer inspected these records; UI interaction itself was performed by the controller.
- Final tracked audit `docs/audits/2026-10-12-local-acceptance.md:5-25,112-135` now identifies the actual runtime, 703 tests, the two replay/smoke artifacts and all browser outcomes. Earlier outdated final-artifact wording was corrected as history; no remaining consolidation gap blocks Task6.

## Assessment

**Task quality: Approved with two minor observations. Spec compliance: Approved for Task6 local scope.** Zero critical, zero important, two minor findings. The controller-approved distinction between actual c345 same-run restart and fresh a696 generated smoke remains explicit; no final-artifact restart or production readiness is invented.
