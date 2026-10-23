# Registro de decisiones del controlador

Copia cronologica del ledger. Conserva decisiones historicas y sus limites; disposiciones posteriores pueden sustituir decisiones anteriores (M2/M3 y la antigua excepcion ya corregidos). La fase hospedada sigue pendiente. El workspace no se elimina.

Ledger linea 7

Ruling: use the dedicated branch in the original authorized checkout after the managed checkout was not writable; main remains preserved. Cost: changes visible in the original directory.

Ledger linea 8

Ruling: explicit user delegation authorizes plan and local implementation without another design approval. No deployment or remote data mutation.

Ledger linea 14

Ruling: apply the patient-facing report restriction at the database read boundary in Task3, with a scoped reviewed-summary projection and verified server private context. UI filtering alone does not prevent direct Data API reads of clinical_notes. Cost: read call sites/types must adapt.

Ledger linea 25

Ruling: use the documented AI SDK global provider hook from a standalone Node preload for final synthetic acceptance. Authorization remains the production path; provider quality remains unmeasured. Cost: launcher/worker behavior must be proven or acceptance stays pending.

Ledger linea 29

Ruling: build final synthetic acceptance from a tracked-source snapshot of the final commit without any .env files except the template, copying pinned installed dependencies rather than symlinking outside Turbopack root. Next reads .env.local before its internal processed-env flag, so that flag is insufficient isolation. Cost: build artifact lives in a private temporary directory and its source/dependency identity must be recorded.

Ledger linea 36

Ruling: split original Task4 into dependency/Supabase integration (Task4), AI evaluation (Task5), and actual local acceptance/consolidation (Task6). Requirements are retained; smaller fresh contexts prevent a large mixed task from hiding missing gates. Cost: three focused reviews instead of one large review; the final whole-branch review remains mandatory.

Ledger linea 47

Ruling: the original Workflow SDK rejects DataView across four serialization boundaries, so there is no historical DataView payload to replay. Preserve those failures as an explicit unsupported-type limit and verify supported payloads through actual SDK serialization; do not invent a successful fixture or introduce an unused data type feature. Cost: generalized DataView support remains absent; Serenia assessment paths use JSON, and the real durable workflow acceptance remains required.

Ledger linea 50

Ruling: Task3 inbox reads must remain bounded per request; scanning all pages merely to sort recreates unbounded work. Preserve older actionable items through filtering/pagination and move global priority to a scoped DB projection if needed, matching current rules. Cost: query/projection complexity rather than uncontrolled latency as backlog grows.

Ledger linea 70

Ruling: fix the prompt loader's broad Turbopack tracing warning in Task5, which owns prompt configuration/provenance. Preserve clinical prompt contents and validate narrowed final build traces. Cost: one explicit loader regression/build check; warning suppression is not acceptance. Task6 real stack/runtime/browser gates remain required.

Ledger linea 86

Ruling: classify the observed Darwin-injected __CF_USER_TEXT_ENCODING key separately as platform metadata, only when present on darwin, without inheriting or reading/printing its value. All unknown effective keys still fail closed and credentials/NODE_OPTIONS remain excluded. Cost: provenance must distinguish launcher-specified keys from OS-added keys; this is not a promise to retroactively isolate initial shell/npm.

Ledger linea 90

Ruling: Task6 may add supported app startup instrumentation if real same-run recovery fails, because durable restart is already mandatory in the spec. No test lifecycle monkeypatch or manual requeue substitutes for proof. Cost: one focused RED/restart/build/review path; publicly exposed Local World is explicitly outside production acceptance.

Ledger linea 118

Task6 newSafetyRED rootdiagnosis: ordinarypendingquiz+explicitsuicid plan reachesgenericprovider/resourcesabsent. Rootsource inspection shows existinghighSignal matches; SQLp_urgenttrue doesnotmake returnedturn.urgent true for normaladmission (onlyinterruption/cap), route static condition onlyexpired||turn.urgent. Ruling: fix trustedserver highsignal resources for normaladmission usingexistingcriteria/copy, preservecloseReason semantics/nonexpiredneednotforceclose. Do NOTresolve bymaking syntheticprovider obedient; zeroLLM/persistedresource regressionrequired. No newclinicalcutoffs/labels/windows. Sameowner notified; finalbuild/restart/browser/review remainpending.

Ledger linea 128

Ruling: Global no-remote guard remains binding forTasks1–6; user explicitly extended scope with Task7target Serenia. Plan now states exact exception and firstmetadata/preflightgate complete with liveACTIVE_HEALTHY/Free/counts/history evidence; no remote data/schema mutation yet. RootUI B10public-onlysummary persists afterreload/history; B09editPASS but still-visibleconfirmonreviewed returned guardedEnglisherror, sameownerboundedUIstatusfix. B11olderJan1criticalfirst actualglobalinboxPASS.

Ledger linea 133

Ruling: two nonblocking harness-only minors parked explicitly: legacycheckpointobserver depends on documented idlelocalnamespace and actual proofhardcorrelated intendedrun; Task7mustbind its own recordedrun/actor and mustnotreuseunscopedobserver. Expectednegative-teststderr retained as failure evidence, not a cleanstderrclaim; capturing/asserting it is a developer quality followup, no runtime effect. No app/security/clinical regression left open by Task6 reviewer. Wholebranchreview remainsmandatory at finalEntregaafternewTask7; splitting the combinedTask6 checkbox relocates that gate, never closesit. GoalACTIVE,Task7+finalreview stillrequired.

Ledger linea 138

Ruling: later fixture preservation uses transaction-only exact full-row Auth/profile/catalog proof plus postcleanup original counts and semantic catalog checks, with all fixture actions filtered to manifest IDs. No client nonce or real Auth row hash export extension. Cost if wrong: postfixture counts/catalog alone cannot prove original account fields are identical; report this limit rather than claiming such proof. No destructive original-row action is in the test scope.

Ledger linea 142

Ruling: begin the single final whole-branch review's read-only source pass in parallel with Task7 execution, but withhold its completion verdict until actual Task7 acceptance, independent task review and final exact HEAD/additional-range evidence are supplied. Cost if wrong: a supplementary diff/evidence pass may be needed if the hosted owner changes source; no old-head verdict can satisfy finalEntrega. This preserves the final gate after Task7 while avoiding an idle reviewer during slow remote operations.

Ledger linea 152

Ruling: once the current official Task7 migration call is terminal/ambiguity resolved, the SAME sole hosted owner takes the one consolidated final source fix wave before building/accepting hosted runtime. This avoids a second implementation block or accepting a known-incomplete UI, while retaining Task7's exact724e packet and native708 previous-source evidence. Cost if wrong: final native/build and hosted proofs must use the corrected commit; any already-applied packet needs a separate reviewed forward migration, never silent historical rewrite. Final Task7 independent task review and final same-reviewer scoped assessment remain mandatory.

Ledger linea 162

Ruling: park newly observed M4 waiting/typing status sentence at zero as a nonblocking copy follow-up after the one final fix wave — same reviewer confirms Minor, while actual draft/urgent submission/persistence/server-authoritative closure all work — cost if wrong: confusing status copy remains during this synthetic-only MVP phase; no second broad fix loop or clinical-rule change is justified by this observation.

Ledger linea 166

Ruling: execute one newly actionable security-maintenance block Task8 after primary GitHub release/advisories establish Next16.4.1 on14Oct — this is the planned upstream patch gate becoming available, not another fix round for accepted I1/I2/M1–M3 — cost if wrong: dependency/build/runtime smoke and scoped review need new source identities, while historical acceptance remains explicitly dated. Three primary advisories GHSA-673q-mjm6-r5xr/GHSA-2464-fhr4-w9xw/GHSA-p3m5-59mp-jv5r state fixed16.4.1; cachedblogalone was insufficient. Planb67368e; SAMEsoleowner follows task-8-brief.md, immutableSQL724e/d9604, no hosted/clinical changes. Task8scopedindependentreview mandatory; no broadreview/suite repeat until actualdependencydelta.

Ledger linea 178

Ruling: correct the now-documented Decisions cache tariff in one bounded research-calculator Task10 — current official23Octguide bills cache while preset11Octvalued it at zero, so leaving it would understate the user's cost comparison — cost if wrong: a dated preset/test/documentary correction can be reverted; no patient model, clinical rule or auxiliary activation changes. Task9native7remainexactsource04052b4; Task10targetedcostregressions/offline/lint/types verify its unconnected research-only delta. Rootresearch/plancommite3c4450, SAMEdependency_expiryimplementerexecutes task-10-brief.md afterTask9accepted; scopedindependentreview follows. Jev1.14previewseen/notpromoted, defaultpatientmodelsunchanged. No onlinebenchmark/paidcalls.
