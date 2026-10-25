# Decisiones del controlador —cierre25octubre2026

Copia cronológica íntegra de cada Ruling del ledger a este checkpoint, con costes cuando se registraron. Las disposiciones posteriores pueden sustituir las anteriores; no se reinterpreta una decisión histórica como autorización actual. Aceptación técnica y cierre actuales: [25octubre](2026-10-25-mvp-acceptance.md). La rama y la evidencia se conservan para revisión, sin fusión/publicación/borrado.

Ledger línea 7

Ruling: use the dedicated branch in the original authorized checkout after the managed checkout was not writable; main remains preserved. Cost: changes visible in the original directory.

Ledger línea 8

Ruling: explicit user delegation authorizes plan and local implementation without another design approval. No deployment or remote data mutation.

Ledger línea 14

Ruling: apply the patient-facing report restriction at the database read boundary in Task3, with a scoped reviewed-summary projection and verified server private context. UI filtering alone does not prevent direct Data API reads of clinical_notes. Cost: read call sites/types must adapt.

Ledger línea 25

Ruling: use the documented AI SDK global provider hook from a standalone Node preload for final synthetic acceptance. Authorization remains the production path; provider quality remains unmeasured. Cost: launcher/worker behavior must be proven or acceptance stays pending.

Ledger línea 29

Ruling: build final synthetic acceptance from a tracked-source snapshot of the final commit without any .env files except the template, copying pinned installed dependencies rather than symlinking outside Turbopack root. Next reads .env.local before its internal processed-env flag, so that flag is insufficient isolation. Cost: build artifact lives in a private temporary directory and its source/dependency identity must be recorded.

Ledger línea 36

Ruling: split original Task4 into dependency/Supabase integration (Task4), AI evaluation (Task5), and actual local acceptance/consolidation (Task6). Requirements are retained; smaller fresh contexts prevent a large mixed task from hiding missing gates. Cost: three focused reviews instead of one large review; the final whole-branch review remains mandatory.

Ledger línea 47

Ruling: the original Workflow SDK rejects DataView across four serialization boundaries, so there is no historical DataView payload to replay. Preserve those failures as an explicit unsupported-type limit and verify supported payloads through actual SDK serialization; do not invent a successful fixture or introduce an unused data type feature. Cost: generalized DataView support remains absent; Serenia assessment paths use JSON, and the real durable workflow acceptance remains required.

Ledger línea 50

Ruling: Task3 inbox reads must remain bounded per request; scanning all pages merely to sort recreates unbounded work. Preserve older actionable items through filtering/pagination and move global priority to a scoped DB projection if needed, matching current rules. Cost: query/projection complexity rather than uncontrolled latency as backlog grows.

Ledger línea 70

Ruling: fix the prompt loader's broad Turbopack tracing warning in Task5, which owns prompt configuration/provenance. Preserve clinical prompt contents and validate narrowed final build traces. Cost: one explicit loader regression/build check; warning suppression is not acceptance. Task6 real stack/runtime/browser gates remain required.

Ledger línea 86

Ruling: classify the observed Darwin-injected __CF_USER_TEXT_ENCODING key separately as platform metadata, only when present on darwin, without inheriting or reading/printing its value. All unknown effective keys still fail closed and credentials/NODE_OPTIONS remain excluded. Cost: provenance must distinguish launcher-specified keys from OS-added keys; this is not a promise to retroactively isolate initial shell/npm.

Ledger línea 90

Ruling: Task6 may add supported app startup instrumentation if real same-run recovery fails, because durable restart is already mandatory in the spec. No test lifecycle monkeypatch or manual requeue substitutes for proof. Cost: one focused RED/restart/build/review path; publicly exposed Local World is explicitly outside production acceptance.

Ledger línea 118

Task6 newSafetyRED rootdiagnosis: ordinarypendingquiz+explicitsuicid plan reachesgenericprovider/resourcesabsent. Rootsource inspection shows existinghighSignal matches; SQLp_urgenttrue doesnotmake returnedturn.urgent true for normaladmission (onlyinterruption/cap), route static condition onlyexpired||turn.urgent. Ruling: fix trustedserver highsignal resources for normaladmission usingexistingcriteria/copy, preservecloseReason semantics/nonexpiredneednotforceclose. Do NOTresolve bymaking syntheticprovider obedient; zeroLLM/persistedresource regressionrequired. No newclinicalcutoffs/labels/windows. Sameowner notified; finalbuild/restart/browser/review remainpending.

Ledger línea 128

Ruling: Global no-remote guard remains binding forTasks1–6; user explicitly extended scope with Task7target Serenia. Plan now states exact exception and firstmetadata/preflightgate complete with liveACTIVE_HEALTHY/Free/counts/history evidence; no remote data/schema mutation yet. RootUI B10public-onlysummary persists afterreload/history; B09editPASS but still-visibleconfirmonreviewed returned guardedEnglisherror, sameownerboundedUIstatusfix. B11olderJan1criticalfirst actualglobalinboxPASS.

Ledger línea 133

Ruling: two nonblocking harness-only minors parked explicitly: legacycheckpointobserver depends on documented idlelocalnamespace and actual proofhardcorrelated intendedrun; Task7mustbind its own recordedrun/actor and mustnotreuseunscopedobserver. Expectednegative-teststderr retained as failure evidence, not a cleanstderrclaim; capturing/asserting it is a developer quality followup, no runtime effect. No app/security/clinical regression left open by Task6 reviewer. Wholebranchreview remainsmandatory at finalEntregaafternewTask7; splitting the combinedTask6 checkbox relocates that gate, never closesit. GoalACTIVE,Task7+finalreview stillrequired.

Ledger línea 138

Ruling: later fixture preservation uses transaction-only exact full-row Auth/profile/catalog proof plus postcleanup original counts and semantic catalog checks, with all fixture actions filtered to manifest IDs. No client nonce or real Auth row hash export extension. Cost if wrong: postfixture counts/catalog alone cannot prove original account fields are identical; report this limit rather than claiming such proof. No destructive original-row action is in the test scope.

Ledger línea 142

Ruling: begin the single final whole-branch review's read-only source pass in parallel with Task7 execution, but withhold its completion verdict until actual Task7 acceptance, independent task review and final exact HEAD/additional-range evidence are supplied. Cost if wrong: a supplementary diff/evidence pass may be needed if the hosted owner changes source; no old-head verdict can satisfy finalEntrega. This preserves the final gate after Task7 while avoiding an idle reviewer during slow remote operations.

Ledger línea 152

Ruling: once the current official Task7 migration call is terminal/ambiguity resolved, the SAME sole hosted owner takes the one consolidated final source fix wave before building/accepting hosted runtime. This avoids a second implementation block or accepting a known-incomplete UI, while retaining Task7's exact724e packet and native708 previous-source evidence. Cost if wrong: final native/build and hosted proofs must use the corrected commit; any already-applied packet needs a separate reviewed forward migration, never silent historical rewrite. Final Task7 independent task review and final same-reviewer scoped assessment remain mandatory.

Ledger línea 162

Ruling: park newly observed M4 waiting/typing status sentence at zero as a nonblocking copy follow-up after the one final fix wave — same reviewer confirms Minor, while actual draft/urgent submission/persistence/server-authoritative closure all work — cost if wrong: confusing status copy remains during this synthetic-only MVP phase; no second broad fix loop or clinical-rule change is justified by this observation.

Ledger línea 166

Ruling: execute one newly actionable security-maintenance block Task8 after primary GitHub release/advisories establish Next16.4.1 on14Oct — this is the planned upstream patch gate becoming available, not another fix round for accepted I1/I2/M1–M3 — cost if wrong: dependency/build/runtime smoke and scoped review need new source identities, while historical acceptance remains explicitly dated. Three primary advisories GHSA-673q-mjm6-r5xr/GHSA-2464-fhr4-w9xw/GHSA-p3m5-59mp-jv5r state fixed16.4.1; cachedblogalone was insufficient. Planb67368e; SAMEsoleowner follows task-8-brief.md, immutableSQL724e/d9604, no hosted/clinical changes. Task8scopedindependentreview mandatory; no broadreview/suite repeat until actualdependencydelta.

Ledger línea 178

Ruling: correct the now-documented Decisions cache tariff in one bounded research-calculator Task10 — current official23Octguide bills cache while preset11Octvalued it at zero, so leaving it would understate the user's cost comparison — cost if wrong: a dated preset/test/documentary correction can be reverted; no patient model, clinical rule or auxiliary activation changes. Task9native7remainexactsource04052b4; Task10targetedcostregressions/offline/lint/types verify its unconnected research-only delta. Rootresearch/plancommite3c4450, SAMEdependency_expiryimplementerexecutes task-10-brief.md afterTask9accepted; scopedindependentreview follows. Jev1.14previewseen/notpromoted, defaultpatientmodelsunchanged. No onlinebenchmark/paidcalls.

Ledger línea 186

Ruling: resume the unfinished Task7 integration with its sole existing owner and correct the exact event-trigger precondition plus realistic fixture — current catalog and the original hosted-before-metadata.json both have ensure_rls tags CREATE TABLE/CREATE TABLE AS/SELECT INTO, while our migration and fixture incorrectly assumed unrestricted tags. Official current Supabase RLS guide agrees with the scoped platform binding; this is a source/test bug, not established platform drift or permission failure. Cost if wrong: a strict revision rejects again; retain fail-closed signature/owner/body/search_path/enabled/binding/ACL checks, preserve rejected724e artifact identity, require realistic PG17 RED/GREEN/negative drift tests and independent scoped review of a new packet hash before root alone applies. Do not reopen completed Tasks1–6/8–10 or broad final review.

Ledger línea 192

Ruling: allow only unavoidable synthetic-clinician login landing and incidental Next sidebar prefetch during the bounded Task7 UI run, after root enforces the same reviewer's explicit prerequisites — new known fixture clinician, unique existing fixture session IDs and their actual fixture ownership, fresh error-checked service aggregate of ALL clinical_sessions equals exact fixture-ID subset count, handoff to a single task-owned writer, recheck after fixture changes/interruption, explicit navigation/actions only on recorded synthetic session paths. Cost if wrong: abort UI on any missing/null/count/ownership/external-writer evidence and retain NOT_RUN; never inspect/redact existing profile rows after a failed gate. User stated no other use, app remains loopback/no public deployment; owner must cease scenario writes during root UI. Source routes were independently reviewed to join profiles only through closed session fixture IDs; this is a narrowly recorded test-scope interpretation, not global list exploration or permission expansion.

Ledger línea 194

Ruling: fix the newly observed Task7 standalone artifact guard false positive for Next16 response cache via task-7-runtime-cache-brief.md before final acceptance; first GET/login created only8 new .next/server/route-cache files while all original artifact bytes remained equal. Exact cache boundary only, strict code/symlink/target/credentials checks retained, realistic RED/GREEN and scoped independent review before normal restart. Cost if wrong: fail closed on genuine code drift rather than silently allow it; existing binary27 stays accurately labeled, standalone launcher revision is separately identified. Same owner may fix source while ROOT exclusively owns fixture/CUA writes; no runtime mutation until handoff.

Ledger línea 197

Ruling: Task11 required P1 factual-integrity repair before completion. Native synthetic scoredPHQ9 plus accepted model questionnaires[] demonstrates source authority gap, not real-model-quality claim. Read-only specialist confirmed ACTIVE workflow only prompts canonical scores then persists model array, tests currently allow contradiction, current spec reserves scores to code and prior Plan5 noneditable scoring facts. Same sole source owner must reconcile questionnaire facts from authorized persisted scoring, fail to manual review on failed/missing facts, retain legitimate empty sets, all clinical rules/prompts/SQL/provider defaults unchanged. Cost if wrong: do not invent clinical interpretation or rewrite historical reports; narrow tested authoritative data mapping and independent review, separately identified new build/actual hosted proof; completed27 evidence stays dated. See task-11-brief.md and updated original plan. Root retains all fixture/runtime write coordination until checkpoint.

Ledger línea 199

Ruling: include clinical review immutability in Task11 after same independent reviewer's Important adjudication — Plan5 makes questionnaires noneditable, but saveAssessmentAction/direct authenticated review RPC forward arbitrary schema-valid scored facts, undoing generated authority. Reject changed/missing facts against the locked original at SQL trust boundary while retaining clinical narrative edits/idempotence/legacy identical fields; UI-only or action-only guard insufficient. Cost if wrong: separate guarded reviewed forward/native+realJWT proofs, no applied6f/d9604 edits or historical rewrite; preserve rollback/ACL/state/task semantics. Root official metadata24Oct14:50:23 confirms prosrc119e629fd31c44c55476ca45d1d88282/ownerpostgres/SECDEF/searchpathpublicpgtemp/exactpostgres+authenticatedACL before source authoring; no DDL sent. Source owner43focusedGREEN/typecheck0 development checkpoint retained, no seven-gate/build replay started before this final narrow expansion. See Task11 brief appendix and review-boundary-adjudication.

Ledger línea 202

Ruling: one bounded Task12 production dependency correction after current strictaudit established five primary advisories in Zod/body-parser/Undici, rechecked officialpages24Oct20:18 — maintain zero-advisoryfull+prod gate, no Workflow2downgrade/waiver or blindall-dependency update. Prefer supported patchparents, justify narrowly pinned override only if necessary and prove schema/AI/Workflow/transports/oldwire compatibility; same sourceowner and same scopedreviewer. Cost if wrong: new locks/native7/build/runtimeidentities and integration revalidation; oldsuccessful23Oct audits/27binary remain dated, no vulnerable build promoted. Task11source review can proceed independently while Task12fixesdependencies; no newSQLapplication/runtime switch before both cleared. See Task12brief; post-MVPproductphase remains deferred by user.

Ledger línea 209

Ruling: use one fresh patched-runtime state and one additional generatedrestartactor while retaining originalsixactors/state/proofs — actual same-original-run recovery must exercise patched transports/schemas, and existing empty-state restartmode supports this without newharnessmodes or fixture replay. Cost if wrong: final UI access must freshly prove ALLsessions equal exactcombinedtwo-manifestfixture subset/actualownership and newknownclinician before unavoidablelanding/prefetch, then two scopedcleanups after verifiedruntime stop; never infer projectempty or relabel oldrun/providerprefix. Root takes writercontrol only after ownerterminalhandoff. Nativebrowser will create a new session under originalbrowserfixture, neutralmessage+exactPHQrequest+completion(min3userturns), answersfirst6=2,last3=0(score12/moderate/noQ9flag), then currentreport/negativeRPCprobes/nativeedit/privateprojection. Newsource/source25proofs separately identified.

Ledger línea 213

Ruling: repair the existing acceptance cleanup order/resume before declaring Task7complete — actual25Oct mode deleted3patients then correctly failed23514 when deleting clinician before another patient's reviewed report. Keep the integrity constraint; remove remaining generated patients first and verify already-cleaned Auth IDs absent. Cost if wrong: narrowly reviewed standalone-harness delta and focused tests plus actual scoped cleanup, not a new server build or repeated acceptance; raw failure stays visible. SAME sole implementer sourceonly, rootalone remote writer after independent SPEC/QUALITYapproval. No original account delete, directSQLdelete, state rewrite or history change.

Ledger línea 217

Ruling: recover final review from the persisted reading map with one replacement strongest scoped reviewer because all previous childhandles are unavailable — reuse approved source/Task7prefix1–7/evidence8–15 reports, inspect only cleanupbc3c091 and later actual cleanup/postcheck/documentary closure. Cost if wrong: one bounded context-recovery review without another broad pass or test replay; final verdict must still be explicit and independently supported before completion. No implementation task is restarted.
