# Revisiones independientes hospedadas —24octubre2026

Archivo de los informes del mismo revisor técnico independiente. Cada bloque conserva su alcance, fuente y veredicto; el prefijo aceptado no implica que Task7, Task11 o la rama completa estén terminados. Los informes siguientes son copias literales de los checkpoints, sin convertir pruebas históricas en nuevas ejecuciones.


## Guard del paquete SQL

Origen `task-7-tag-guard-review.md`; SHA256 `f1b6ba0172d18366baaa7a10ccb1986c9bc081451f8640c0404e6f54d5a79123`.

# Task7 tag-guard supplement — independent review

Date: 2026-10-24. Same sole whole-branch reviewer; narrow supplement only.

## Scope and identities

Requirements: task-7-brief.md and the controller's concrete 23–24 October correction checkpoint. Exact source range `175abeea6072425936a5c1f1ddca22f0fe18ab9e` → `27f82d8e8d46257dff8517dbca5592e4a4681df9`. The saved 146,240-byte diff is byte-equal to this Git range and has SHA-256 `776bb4e65cb8a480ca5410f9a2fa70df40a912a34d028a79618dd2dcb0ac8d82`.

Read the changed source/tests/provenance/docs and the complete native packet harness, without repeating the broad review or running tests. The 93 KB archived SQL was checked by identity against BASE, not semantically reread. The originally assigned 6.4.2 reviewer template is no longer installed; its installed 7.0.1 counterpart supplied the same review structure. Supabase skill and project operations instructions were applied within this read-only review scope.

## Strengths

- `supabase/migrations/20261013073246_hosted_trigger_acl.sql:42-50` changes only the event tag predicate to the exact observed array using `IS NOT DISTINCT FROM`. Signature, owner, SECURITY DEFINER, search_path, routine body hash, event kind, enabled state and routine binding remain guarded. NULL/unfiltered tags are rejected. The existing fresh-local absence branch remains intact. The recorded original `hosted-before-metadata.json` event metadata independently matches all three tags; the original rejection was a fixture/guard mismatch, not evidence of platform drift.
- `scripts/test-hosted-packet.py:48-73` exercises the complete packet under the realistic filtered event trigger, then probes unfiltered/NULL, missing tag, extra tag, disabled trigger and wrong routine. Every negative path requires the intended error and checks rollback of the probe tags/enabled state, new-table DDL, preceding Auth ACL change and semantic catalog. The remaining actual signup/recreation, administrative RLS trigger, role privilege and local-absence checks still run.
- `scripts/hosted-packet.mjs:18-31` binds the rejected SQL and original manifest to fixed hashes and records the separate rejection outcome. It does not rewrite historical application status into success. `tests/tooling/hosted-acceptance.test.ts:48` adds archive/successor provenance coverage.

## Packet identity and preservation

Direct read-only recomputation confirms:

- Revised canonical: **93,052 bytes**, SHA-256 `6f0037fc74e115455e379795cdcb1c5318e4a9f65660d048f8ca5d7af30069b0`.
- Revised manifest SHA-256: `4e3582bdf910fedc9ad62deee31fe9cf82a148934bc43cc7faec9fe89b88f330`.
- Archived original canonical: **92,971 bytes**, SHA-256 `724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae`, byte-equal to BASE.
- Archived original manifest: **9,418 bytes**, SHA-256 `125c36195659add167cf569bed2feac7c9304e865572ad2ed0607dc4615254c0`, byte-equal to BASE. Its historical preparation snapshot and separate SQL_REJECTED_NOT_APPLIED outcome are correctly distinguished.
- All six manifest offsets/lengths/hash slices match packet bytes. First five section metadata and exact original migration bytes, retained history and catalog are unchanged. The sixth section is 3,625 bytes, SHA-256 `565fa459d6ed2588ac601bdbcd079888aca9b2fb51e5a28ba29f2553f6f6a9b4`.
- Both preservation SQL files are byte-equal to BASE. The separate inbox forward remains byte-equal, SHA-256 `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`.

## Existing verification inspected

From `.cache/hosted-task7/tag-guard-20261023/`: packet-red exit 1 with the expected binding error; provenance-red exit 1; packet-green and tooling-green exit 0; suite-final, lint-final and typecheck-final exit 0. The native green log contains all 11 PASS summaries; suite-final records 717 passed tests in 63 files. Checkpoint JSON binds these results to the exact reviewed range and packet. No suite, database, runtime or remote call was rerun by this reviewer. No keys, environment values, real profile/clinical rows or raw runtime logs were accessed.

## Issues

- **Critical:** none identified in this supplement.
- **Important:** none identified in this supplement.
- **Minor:** none newly identified. Previously deferred M4 remains outside this SQL correction.

## Separate clinical UI scope clarification

**Conditionally acceptable as a controller ruling for this synthetic acceptance run; not a packet property or completed UI test.** `app/(auth)/actions.ts:52` forces `/app`. Its clinician path calls the inbox at `app/app/page.tsx:95-99`; sidebar Links at `components/app/app-sidebar.tsx:29-31,70` can prefetch the inbox/patient index. Own-profile reads at `app/app/layout.tsx:16-20` and `app/app/page.tsx:88-92` use the authenticated actor ID. The patient index first selects closed sessions and only then reads profiles for those session user IDs (`lib/server/clinician/patients.ts:24-32,59-63`). The forward inbox derives candidates from closed sessions and joins profiles on selected session user IDs (`supabase/hosted/inbox-forward.sql:22-32,53`); its ancillary histories are also scoped to those session/user IDs.

Therefore the bounded forced landing/prefetch can meet the no-existing-profile-retrieval intent if the controller records and enforces all of these prerequisites **before** clinician login/browser rendering:

1. The authenticated clinician is a newly generated fixture account. Known fixture session IDs are unique, actually present and bound to newly generated fixture patient IDs; a raw count equal to the number of IDs in a local file is insufficient.
2. A fresh, error-checked privileged aggregate proves the **entire** clinical_sessions table count equals the count restricted to those known fixture session IDs (all statuses), with the expected fixture ownership verified through fixture-scoped checks. Do not use a clinician RLS-limited count or closed-only count. Null/error/truncated or stale evidence must stop the UI step.
3. Maintain the controlled single-writer test interval and recheck after fixture changes or a material interruption. These ordinary application queries are not a transactional snapshot with the preflight; if outside writers cannot be excluded, retain clinical UI NOT_RUN instead. Do not retrieve rows to inspect/redact after a failed aggregate gate.
4. Allow only the unavoidable login landing and incidental prefetch plus explicit navigation/actions on recorded synthetic session paths. Do not expand this ruling to exploratory global inbox/patient navigation, real accounts or production use. Preserve fixture-scoped writes and cleanup and record what UI was actually exercised.

This source check supports the proposed narrow interpretation; root owns its recorded ruling and actual aggregate evidence. No existing profile values were read to reach this conclusion.

## Declined to judge

- Actual revised canonical/forward application, retained remote history/catalog/account state, hosted Auth/JWT/advisors/types/browser/Workflow restart and cleanup: pending controller execution and evidence. The previous packet's rejection is not the revised packet's application result.
- Clinical UI behavior and absence of external writers during the future run: no browser or remote observations performed here; the conditions above are prerequisites, not claims already satisfied.
- Clinical/legal approval, public deployment and production operating commitments: existing release gates remain unchanged.
- Untracked `docs/audits/2026-10-24-postgres-maintenance.md`: observed in current status but outside the supplied committed range; not inspected or approved.

## Assessment

**Spec compliance: APPROVED for the scoped tag-guard correction.**

**Code quality: APPROVED for the scoped tag-guard correction.**

**Controlled application checkpoint: APPROVED for the exact revised packet and manifest above**, subject to root's immediate target/baseline checks and single official application protocol in Task7. No source fix is requested. Both revised canonical and separate forward remain PREPARED_NOT_APPLIED at this review checkpoint.

**Whole-branch/release approval: WITHHELD.** Task7 actual hosted acceptance and its final evidence review, plus the existing clinical/legal/production gates, remain outstanding. This report neither authorizes blind retries nor declares the unfinished Task7 complete.


## Guard de caché del runtime

Origen `task-7-runtime-cache-review.md`; SHA256 `8c378aab2a4917a0940a6bc5694ce01e251511fe62a612d474f499ad2be0c7dc`.

# Task7 runtime response-cache supplement — independent review

Date: 2026-10-24. Same sole reviewer, narrow source/spec/quality checkpoint; no broad review, test rerun, helper agent, remote call or runtime mutation.

## Scope and identities

Requirements: task-7-runtime-cache-brief.md and the controller's exact-boundary ruling. Reviewed the complete committed supplement `27f82d8e8d46257dff8517dbca5592e4a4681df9` → `3f3f27a2e787d82e6947198dfc9eec8a06bb6c63`, including helper, all 15 new artifact tests and reports/operations changes. Saved diff is byte-equal to that Git range: 24,072 bytes, SHA256 `3d5b061a3465615514f09b8899e92017625b7e4e6ef197f5a8f7528ceae2dc33`.

Executable standalone launcher source: `c1d78b4ae8936b208cd05432eda284619861d6e5`. Independently recomputed `scripts/hosted-start.mjs` SHA256: `971f429334007f8316e34e3210561b89550205d82bc63dbe2fb0758b467bf5cd`. Later commits are documentation only.

The application binary remains source `27f82d8e8d46257dff8517dbca5592e4a4681df9`, snapshot `/private/tmp/serenia-hosted-build-Nd4nXo/project`, BUILD_ID `xhrWTx9JGknr6oTSmk6va`, original aggregate `c3d0ddb6e48185deda89f9d4ec66b730bae6316f7aa2a17d6401497d8a3a9136`. Approval does not relabel this as a current-HEAD build.

## Strengths

- `scripts/hosted-start.mjs:12-21` excludes hashes only under exact `.next/cache` and `.next/server/route-cache` directory boundaries. The mutable flag propagates solely down those subtrees. Similar sibling names remain hashed. The recursion continues through cache data and rejects boundary/nested symlinks before hashing decisions; an existing boundary must be a real directory. Whole `.next/server`, compiled routes, chunks and immutable source remain covered.
- The installed Next16.4.1 self-hosting guide describes disk response caching. Its `route-cache-key.js:36` and `file-system-cache.js:469-496` confirm scoped response keys live under server/route-cache separately from compiled app/pages output. This is the relevant installed implementation, not an assumption based on older Next behavior.
- `tests/tooling/hosted-artifact.test.ts:30-64` verifies realistic cache population/refresh/removal, seven distinct immutable-byte mutations, extra code, lookalike cache siblings, compiled-file deletion, both boundary symlinks, a nested response-cache symlink and a regular-file boundary. Negative identity mismatch tests exercise the unchanged startup rejection at `scripts/hosted-start.mjs:39`.
- The unchanged startup still validates build/public-key/target/lock/artifact, forbids environment files in the snapshot, checks the port and starts the original snapshot's provider and Next executable (`scripts/hosted-start.mjs:37-49`). The external scanner can validate the original embedded helper bytes without rewriting that artifact or its recorded baseline.

## Evidence inspected

Read `.cache/hosted-task7/runtime-cache-20261024/checkpoint.json`, numerical exit records and bounded test summary lines. RED exit1 contains 2 failed/13 passed; GREEN exit0 contains 21 tests/2 files (15 artifact plus 6 existing hosted guards). Lint and typecheck exit0. No unrelated native, SQL, build or runtime suite was repeated.

Read the sanitized `actual-artifact-readonly.json`: PASS_READ_ONLY_NO_RESTART, correct binary source/buildId, 871 original files, allOriginalFilesMatch=true and the exact original aggregate above. This supports the recorded original-artifact comparison; it is not a new restart or browser observation by this reviewer. Initial aggregate failure and refined proof remain separate in the report. Cache response bodies, credentials, private runtime logs and clinical/profile rows were not read.

## Issues

- **Critical:** none identified in this supplement.
- **Important:** none identified in this supplement.
- **Minor:** none newly identified. Deferred M4 remains unrelated.

## Recommendations and declined-to-judge items

- Proceed only through root's coordinated normal restart after checking original artifact/state and port ownership. Preserve existing fixtures/clocks/jobs; do not rebuild or rebaseline to satisfy identity. This is the requested execution checkpoint, not another implementation change.
- The scanner intentionally does not attest mutable response contents. It attests the retained immutable file set/bytes under its existing scope and rejects cache symlinks; no broader production integrity or cache-poisoning guarantee is inferred.
- Actual subsequent restart, browser completion and scoped cleanup/postchecks remain pending execution evidence. The earlier runtime PID's disappearance does not establish its cause or signal.
- Root reports the two official migrations and automated hosted acceptance have succeeded. This source supplement does not independently re-review all those remote proofs; final Task7 evidence review remains outstanding. Root-owned untracked application mapping and Postgres maintenance record are outside this committed supplement.
- Clinical/legal/model-quality/public deployment gates remain unchanged. This does not reopen completed Tasks1–6/8–10.

## Assessment

**Spec compliance: APPROVED. Code quality: APPROVED.** The correction fixes the demonstrated false identity mismatch at the smallest documented response-cache boundary and retains code-tampering checks.

**Normal original-binary restart checkpoint: APPROVED** using the separately identified external launcher above, after root's operational handoff and artifact/state/port checks. No additional source fix requested. This approval is not evidence that the restart has occurred.

**Whole-branch/release approval remains WITHHELD** until Task7 browser/final cleanup and the final evidence review are complete, with the existing external release gates retained.

## Prefijo de aceptación real hospedada

Origen `task-7-evidence-prefix-review.md`; SHA256 `4e543043e3b9febd506720322ac5e4adf63ab76cc6b126f0da6ddace7862639b`.

# Task7 completed evidence prefix — independent review

Date: 2026-10-24. Same retained whole-branch reviewer. Evidence-only supplement for already reviewed application source `27f82d8e8d46257dff8517dbca5592e4a4681df9` and external launcher `c1d78b4ae8936b208cd05432eda284619861d6e5` (documentation HEAD `3f3f27a2e787d82e6947198dfc9eec8a06bb6c63`). Requirements: task-7-evidence-prefix-review-brief.md and retained Task7 contract. No new product source is approved here.

## Verdict

**SPEC: APPROVED for the completed prefix enumerated below. QUALITY: APPROVED for that prefix's evidence and its stated boundaries.** No new Critical, Important or Minor finding was established. This is not final Task7, whole-branch, clinical or release approval. Task11, final native UI/projection, cleanup and final postchecks remain outstanding.

The supplied `task-7-evidence-prefix-package.diff` is explicitly a 375-byte evidence-only descriptor, not a hidden product diff; SHA256 `0ec9ac3c2f251e9cc604c9f80793b5e7d118d217e6446ea5943010cbdcd71765`. The retained tag-guard and runtime-cache source reviews remain the source coverage map.

## Independently checked objects and reusable coverage

### 1. Exact hosted application and preservation before fixtures

Read `root-preapply-20261024.json`, both `root-*-applied-20261024.json` records and `supabase/hosted/application-20261024.json`. The recorded official outcomes each contain success=true, followed by concrete hosted history observations:

- Canonical reviewed6f0037fc,93,052bytes → version `20261024092459`; postcheck09:25:34UTC has41history, original40 fingerprints unchanged and stored SQL SHA256 `6f0037fc74e115455e379795cdcb1c5318e4a9f65660d048f8ca5d7af30069b0`.
- Only after that success/postcheck, forward5,172bytes → version `20261024092547`; postcheck09:26:11UTC has42history, both exact stored SQL hashes and forward SHA256 `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`.
- Original40 version/name/statement fingerprints and semantic catalog remain equal;2Auth/2profiles/5definitions/65items and zero clinical rows before fixtures. Canonical postcheck records new chat_turns/assessment_jobs present, no public tables without RLS, withdrawn anon/authenticated trigger EXECUTE and preserved tested platform privileges. Inbox body changes from guarded `d8cd7b9badc44fe4b4ec7191d878815d` to `9c91fd44e4c712465ebb44692b30c1da` after forward.

The exact original preapply sample is09:19:10UTC; the applied request separately records its immediate preflight09:23:17UTC. These timestamps are distinct. Preservation of full account rows inside the canonical transaction relies on the previously reviewed locked nonce-aggregate SQL; the external records expose aggregate counts/metadata, not original account fields. This is not a backup or post-cleanup claim.

### 2. Original hosted build, actors, Auth/JWT and HTTP

Read the actual build metadata/result/artifact files in `/private/tmp/serenia-hosted-build-Nd4nXo/` and build-exit0. They bind original source27f82d8, hosted target `https://brpozobkoatabctjjadc.supabase.co`, lockSHA `e0f9eb1ffc90023ebb1b4bf2f1b7f85902f751229d2d679733f64f7b75fc1ed4`, BUILD_ID `xhrWTx9JGknr6oTSmk6va`,871 inventoried files and aggregate `c3d0ddb6e48185deda89f9d4ec66b730bae6316f7aa2a17d6401497d8a3a9136`.

All seven actual mode result records have numeric exit0: fixtures, http, restart-checkpoint, restart-verify, review, cron, browser-fixtures. Their corresponding single-line PASS records agree. Inspected the wrapper: it records the subprocess return code and exits with it. Read only the immutable snapshot's relevant scenario assertions to interpret these results, not a fresh broad source pass.

- Fixtures evidence covers actual GoTrue signIn/getUser, direct bearer PostgREST owner access, anon rejection, foreign-session denial, rejected patient escalation/forged consent, clinician scoped access and service setup. These are actual hosted client/server boundaries, not local auth.uid shims. The submitted modes use only generated fixture IDs.
- In the raw private aggregate proof, independently checked all six actor scopes and their session/user relationships. Patient has6 distinct completed turns/12messages (6user+6assistant); attempts are five1s and one2, supporting same-request503→200 recovery. One questionnaire instance,9answers/1result and one draft assessment/job support duplicate-answer and closure idempotency. All three completed workflow inputs bind to their scoped session/job token and one completed job attempt.
- Browser-fixtures proves a prepared synthetic questionnaire state only; no completed browser interaction is inferred.

### 3. Same-original-run recovery

Directly hashed and read scoped structures of private `restart-proof.json`:37,736bytes, SHA256 `913eb321477b5ef8d6125546e83891a6ab30b61bca6b38d0c9e42b63cef045ef`. It is equal to the nested restart proof in the automated capture.

Independent read-only assertions confirm original run `wrun_01M5PM20SNNFN77B90097Q4PSA` persists across PID9493→9673; the serialized input, job token/session/run binding and source/lock/build/artifact/snapshot/state identities agree. The selected retry belongs to this run. After normal startup, the job and run are completed with jobattempt1;23events contain exactly one run_created. Three steps completed before the checkpoint each have only one step_started across the final event history. The original serialized run input also agrees with the actor workflow record whose decoded input binds to the scoped job. Unique assessment at restart completion is asserted by the executed scenario; later clinician modification deliberately creates a successor.

This covers the actual hosted same-original-run restart requirement for this original build. It is not an inference from a new run or a manual requeue. The intentionally killed original launcher has terminal exit1/SIGKILL, preserved separately.

### 4. Clinical review RPC, projection and cron prefix

Executed immutable scenario assertions plus raw scoped effects cover patient denial of raw assessments and review RPC, pending projection without summary, clinician modify repeated with the same returned ID, safe patient-facing projection without the private marker, one active reviewed assessment and one open task. Independently checked the restart fixture's one reviewed_modified successor, its supersedes link to the superseded original and the task's link to the successor. This is the earlier **modify RPC** case, not approval of Task11 or the unfinished native UI/regeneration/projection flows.

Cron assertions include error-checked exact global-vs-fixture aggregate counts before the sweep, aging only the recorded actor/session, unauthenticated GET/POST401, cookie-less bearerPOST200, bounded closure/enqueue and replayGET200. Actual result is closed1/enqueued1/failed0; raw cron session is closed for inactivity with one assessment and one completed job attempt. This proves more than the unauthorized401 check but does not approve public production cron configuration.

### 5. Provider and artifact prefix

Private `automated-scoped-proof.json`:221,127bytes, SHA256 `214a0cfe620391903ab774a9ee88429d277039c01391360be1379d88bbb095c6`.

Read and assert scoped raw objects without printing clinical text, account fields or job tokens. Recounted63 provider rows: PID9493 has12conversational/2structured;PID9673 has4conversational/2structured; totals16/4/0fast, with no denied model/network events in this prefix. The36→45 startup gap contains one preload, seven Workflow HTTP calls and one structured call; restart-verify's own zero-call delta does not erase recovery generation. Prefix ends at the automated/browser-fixture handoff, not later UI activity.

The raw artifact evidence retains all original files unchanged,8response-cache additions and initialCaptureFailedClosed=true. Cache omission was independently source-reviewed in task-7-runtime-cache-review.md; no artifact rebaselining or new build is credited.

### 6. Hosted type contract reconciliation

Read the actual hosted generated TypeScript, raw comparison, semantic comparison and hosted catalog metadata. Additionally compared the immutable original binary's product types to hosted types through read-only TypeScript AST traversal across Row/Insert/Update/Relationships, Functions/Enums/Views/CompositeTypes. Counts are23tables/29functions/17enums, zero views/composites.

The reported differences reconcile as parenthesized syntax;42 NonNullable<Json> occurrences across14columns, each backed by the recorded jsonb nullable=NO metadata; and zero-argument Args representations for exactly get_onboarding_ready/is_clinician, each backed by pronargs0/boolean return. Table ComputedFields is also generator-only `never` versus absent and is outside the explicitly declared shape scope. No additional covered-contract difference was found. Json includes JSON literal null, so this is database-contract reconciliation with conservative existing product types, **not a claim of literal TypeScript assignability/byte equality or proof that SQL NOT NULL forbids JSON null**. No product types were overwritten.

### 7. Normal start after response-cache population

Read normal-after-browsing-prestart/result and retained actual-artifact-readonly records. Prestart10:18:32UTC records priorPID9673 absent/causeUNKNOWN, free port, original artifact identity and private ownership. Result10:18:57UTC records original binary/state ready atPID11147 with separately identified external launcherc1d78b4/fileSHA971f4293…; readiness check exits0 while launcherProcessExit remains null. This establishes historical RUNNING_READY on the original populated-cache artifact, not launcher terminal exit0, restart latency certification or current liveness. Lost handles/sandbox signal permission errors alone do not establish stopped state. No new liveness check or restart was performed by this reviewer.

## Preserved failures and limitations

- Read-only manual preflight SQL42601 is retained with canonicalApplySent=false and corrected-query provenance. It is not a successful preflight result.
- Planned original launcher SIGKILL/exit1, initial artifact capture exit1, refined read-only capture exit0 and raw type-representation differences remain distinct.
- No remote requests, source/product edits, runtime/fixture writes, tests or helper agents were used. All additional assertions were read-only analysis of saved evidence. Raw runtime logs and credentials were not opened or printed.
- Detailed advisor dispositions, hosted Auth SMTP/callback settings and Postgres maintenance are not accepted by this prefix; final evidence must retain their exact verified/unavailable status. Free plan limitations are not silently waived.
- Final native UI, Task11 source/native/runtime evidence, final private projection, fixture signout/cleanup and post-cleanup counts/history/catalog/runtime state remain pending. Existing clinical/legal/live-model-quality/public-production gates remain unchanged.

## Reuse at final closure

The final reviewer can reuse numbered objects1–7 above and the two prior source reviews for their exact immutable identities. Do not rerun or reread the broad branch or these unchanged successful prefixes. Review only Task11's actual delta and evidence, final UI/projection/cleanup/postchecks and any later identity changes. Changed runtime/source claims require their own binding; they do not retroactively relabel this original27f82d8 prefix.

## Alcance de la inmutabilidad en revisión clínica

Origen `task-11-questionnaire-review-boundary-adjudication.md`; SHA256 `bcd4fbd08f8a91d2b00f59db3b42bb727a227b7040e0b2b22021543f1b0c5590`.

# Task11 scope adjudication — questionnaire facts during clinician review

Date: 2026-10-24. Requested by root during the independent Task7 evidence-prefix review. Narrow source/requirement assessment only; no tests, remote calls, product edits or implementation review of the owner's in-progress Task11 changes.

**Disposition: Important; required within Task11 before declaring authoritative questionnaire facts preserved end-to-end.** This is a concrete existing contract gap, not a request to change clinical policy or broaden the audit.

## Basis

`docs/superpowers/plans/2026-04-22-plan-5-clinician-panel.md:150` explicitly says questionnaires are not editable because they come from scoring. Task11's brief:9-17 requires persisted scoring facts to control report questionnaire data. The clinician can edit judgment/narrative; that privilege does not grant an exception to the noneditable factual fields.

`app/app/clinica/sesion/[sessionId]/actions.ts:53,83-89` validates and forwards the caller's entire summary. Schema shape validation does not compare its questionnaires to trusted stored facts. Applied canonical `supabase/hosted/serenia-atomic.sql:194-213` validates object/proposed_tasks shape and then inserts caller-supplied p_summary as the reviewed successor, without preserving the locked original's questionnaires. The corresponding source is `supabase/migrations/20261010075359_robust_authorization_review.sql:147-166`.

Concrete path: a clinician submits an otherwise valid narrative edit with questionnaires replaced by an empty array or altered code/score/band/flags. It is accepted through the server action/RPC path and becomes the active reviewed report. A readonly editor prevents the ordinary form from offering that edit; it does not enforce the RPC contract against a crafted/stale/future client. Task11's correct model-to-facts projection would therefore be undone by the next accepted review write.

## Narrow required outcome

Preserve questionnaire facts across review modifications at the authoritative write boundary. A minimal contract can reject changed or missing questionnaires by comparing the proposed array to the locked original assessment before any new modify write. Keep clinician narrative/risk judgment edits, existing locking/task lifecycle and idempotent retries intact. An application-action-only guard is insufficient because authenticated clinicians can call the granted RPC directly.

Use a separate guarded forward migration because the canonical6f0037fc packet is already applied. Do not edit the applied packet or historical migration identity; no clinical catalog/scoring/threshold change, recomputation policy or history rewrite is needed. Existing historical malformed reports are not silently repaired by this limited guard and should not be represented as repaired.

Targeted acceptance should reject removal, addition or alteration of questionnaire facts through the RPC while allowing an unchanged factual array with a valid narrative edit and same-request retry; rejected attempts must leave the original report/tasks unchanged. Preserve the intended confirm/reject behavior and patient/foreign denial. The owner/root retains implementation design and must provide the concrete forward packet/checks before application.

## Relationship to the prefix approval

Task7's earlier actual modify-RPC/projection test remains valid for its submitted unchanged questionnaire array and verified effects. It never asserted resistance to altered questionnaire facts. The completed-prefix SPEC/QUALITY approval is unchanged; final Task11/Task7/whole-branch approval remains withheld pending this integrity boundary and the already pending source/runtime/UI/cleanup evidence.

## Fuente Task11 y forward de hechos inmutables

Origen `task-11-source-review.md`; SHA256 `9a778ac34ee6e9d7b36ee6289824cb29133a88f8e77b78f715ab86d3d78d2c42`.

# Task11 source and SQL checkpoint — independent review

Date: 2026-10-24. Same retained strongest whole-branch reviewer, narrow supplement only. Requirements read first: task-11-source-review-brief.md, task-11-brief.md including the review-write expansion, binding scoring-authority clauses and the retained questionnaire-review boundary adjudication.

## Scope and verdict

BASE `3f3f27a2e787d82e6947198dfc9eec8a06bb6c63` → HEAD `5accbed8da205f331dc69b56ccd62196ea5ee2d7`; executable source `f1ff5b788f1f217c21c0883923cacbf056e991f1`, tree `e97b6130b051ad72fb3354a770ca7c7997a7877a`. Later Task12 working-tree edits are excluded. Saved package:86,743bytes, SHA256 `740866ad10b811396a64bfe4d66c27f53e334b357e2f4449225d21b33ead9810`. Its context formatting differs from a default Git diff; independently reconstructed every packaged patch against BASE and matched all14 resulting files to exact HEAD. No unexplained content discrepancy.

**SOURCE SPEC: APPROVED. SOURCE QUALITY: APPROVED. SQL FORWARD SPEC/QUALITY: APPROVED for the exact prepared bytes below.** No new source correction is requested.

**FINAL TASK11 COMPLETION / REMOTE APPLICATION / NEW HOSTED BUILD OR RUNTIME CLEARANCE: WITHHELD.** Strict dependency audit actually fails; Task12 correction/new strict gates, reviewed hosted artifact and root's fresh metadata/application checkpoint remain required. No approval to bypass that gate is implied by source correctness.

## Strengths and requirements coverage

1. **Deterministic generation facts.** `lib/server/assessments/questionnaire-facts.ts:36-63` scopes scored instances to both session and user; reads canonical definition and persisted result; validates primitive/flag contracts; returns one result per instance in stable ID order. No score, clinical band or flag meaning is recalculated. Empty successful array is valid; null/malformed/error/missing definition/result fails. Repeated instrument codes are retained. Bounds match the existing operational answer envelope, not new clinical cutoffs. Canonical historical definition codes are preserved.
2. **Both report writers use the same boundary.** Active `lib/server/workflows/generate-assessment.ts:251-270,324-331` replaces only model questionnaires with persisted facts; item answer read errors now propagate. The existing generation step checks job ownership and closed-session/conversation relations before elevated reads, retries up to its existing limit and routes final generation failure to manual review. Existing persistence token fencing remains unchanged. Exported legacy `lib/server/assessments/generator.ts:150-154,202-210` also replaces model facts and throws on failed facts reads before model invocation or insertion. No alternate exported writer remains model-authoritative for this field.
3. **Meaningful adversarial regressions.** New tests cover empty/invented model lists, nonzero12/moderate results, canonical flags, legitimate empty sets, repeated instruments/distinct ordering, session/owner filters and12 read/decode failure categories. Both writers are exercised. Existing synthetic provider is unchanged and still returns the adversarial empty list. `scripts/hosted-scenarios.mjs:89-95` adds equality against actual persisted PHQ9 facts; this stronger mode is not represented as already executed on Task11.
4. **Database write authority.** `supabase/migrations/20261024145433_review_questionnaire_facts_immutable.sql:33-42` compares proposed questionnaire JSONB to the locked original before any new write or idempotent return. Changed/omitted/added/reordered facts fail. Identical legacy absent fields, JSON null and empty arrays are deliberately distinct but compatible with unchanged edits. SQL-null payload cannot bypass the existing modify validation. This addresses the separately adjudicated Important direct-clinician-RPC gap without broadening clinical authority.
5. **Existing clinical transaction preserved.** Independently extracted old/new routine bodies: the only body change is the six-line comment/predicate/raise guard. Narrative/risk/task editing, locking, reviewer/authentication checks, parent binding, version succession, task lifecycle, confirm/reject and identical retry paths otherwise retain the prior body. Historical reports are not rewritten.

## Exact forward and drift contract

Prepared packet `supabase/hosted/review-facts-forward.sql` is byte-equal to source migration `20261024145433_review_questionnaire_facts_immutable.sql`: **8,191 bytes**, SHA256 **`86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504`**. Manifest targets only `brpozobkoatabctjjadc`, migration name `serenia_review_questionnaire_facts_immutable`, status PREPARED_NOT_APPLIED.

Independently hashed routine bodies: prior `119e629fd31c44c55476ca45d1d88282`, successor `7f83d3074a279a2740d1bf82a2977ebd`. Saved root read-only hosted metadata14:50:23UTC agrees with the prior body, signature, ownerpostgres, SECDEF, search_path, ACL and full-definition MD5 `fa9bbdd61b38e492ca3c09151e3d92b6`.

Precondition checks exact sole overload/signature, owner, SECDEF, UUID return, volatility, language, search_path, ACL, body and full-definition hash. Postcondition checks the expected new body with unchanged metadata/ACL. CREATE OR REPLACE adds no grants, tables, roles or policies. Native harness compares all pg_proc metadata except prosrc and proves body/config/owner/ACL/security/signature drift failures roll back exactly. Its packet/source/manifest assertion passed in the final native run.

Applied canonical6f0037fc, inboxforwardd9604 and canonical manifest are byte-equal to BASE; the committed delta does not touch rejected archive, approved prompts, catalog/scoring sources, synthetic provider or dependency declarations/lock. Root alone owns subsequent application; no historical/applied packet is repurposed.

## Verification evidence inspected, without reruns

- `.cache/task11/final-tests-baseline-red-exit.json` and bounded summary: final corrected43-case tests against BASE produce20fail/23pass, exit1. Source restoration hashes retained. Final focused run43passed, exit0.
- Initial test development RED and intermediate typecheck exit2 remain recorded; later corrected typing exit0 and final focused RED/GREEN make the intended test arrays unambiguous.
- SQL RED exit1 includes `QUESTIONNAIRE FACTS REGRESSION: clinician changed scored facts`. SQL GREEN exit0 and final native PG log cover9fact mutations plus SQL-null denial, unchanged canonical narrative edit, exact retry, legacy absent/null/empty, patient/parent denial, unchanged assessments/tasks after rejection and inherited-task rollback. Six migration drift probes fail with the intended guard and exact restoration.
- Actual `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-jgKyNw/results.json`: test0, lint0, typecheck0, workflow:wire0, db:test0, **audit:dependencies1**, build:isolated0. Test log records752passed/64files. Overall verify exit1, not seven-gate success.
- Raw production/full audit JSON and corresponding numeric exits both1:22High graph entries propagated from exactly five advisories (Zod, body-parser, three Undici). These are not22independent advisories. No waiver or gate suppression was introduced by Task11. Current upstream remediation is reserved for the separate Task12 review.
- Generic build metadata/result binds sourcef1ff5b7, unchanged lockSHA `e0f9eb1ffc90023ebb1b4bf2f1b7f85902f751229d2d679733f64f7b75fc1ed4`, result0 and BUILD_ID `tMoKmmzcxF9cgo5sF_B6F` in `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-MfoOLu/project`. This placeholder-config artifact was not started and is not hosted Auth acceptance. No Task11 hosted build is accepted.

No tests, SQL/runtime/remote operations, fixture writes, helper agents or product edits were performed by this reviewer. Inspected only saved evidence and immutable source. Credentials, environment values and original profile/clinical rows were not accessed.

## Issues and declined-to-judge items

- **Critical:** no new source issue identified.
- **Important:** no new implementation defect identified in this scoped correction. The known strict-audit failure remains an unresolved mandatory clearance gate tracked by Task12; source approval does not downgrade it.
- **Minor:** no new finding. Existing deferred M4 is unchanged.

Declined to judge: Task12 dependency changes/current upstream fix sufficiency (separate source/gate review); actual application of the8191-byte forward and direct hosted RPC negatives (not executed yet); new-source generated/browser/patient-projection behavior and fixture cleanup (pending); clinical validity of assistive narrative/risk judgments and historical malformed report repair (outside this factual-copy correction); production hosting/cron/legal approval (existing external gates). None is silently marked successful.

## Reusable reading map and next checkpoint

Package indexes0–2: report/audit/plan provenance;3–5: both generation paths/shared loader;6: stronger hosted facts assertion;7: native migration identity/drift harness;8: manifest;9–10: identical prepared forward/source (SQL semantically read once, duplicate byte identity checked);11: native SQL mutation/rollback/legacy controls;12–13: active and legacy generation regressions. Unchanged callsites were read only for generation failure/token fencing and existing primitive/flag contracts. The already accepted Task7 evidence-prefix objects1–7 were not re-reviewed.

After Task12 clearance, reuse this source/forward assessment if bytes remain exact; supply the patched-source hosted build identity, root's fresh exact-routine preflight and application record, actual direct-RPC negative/positive results, scored-result→generated report→native review/projection proof and final cleanup/postchecks. Final Task11/Task7/whole-branch approval remains withheld until those gates are satisfied.

## Fuente y build Task12

Origen `task-12-review.md`; SHA256 `3076f04d0f00fbab65d46d4d0163e49c3ebbc85a3b02d40ab81b5524adaf475d`.

# Task12 dependency/source/build checkpoint — independent review

Date: 2026-10-24. Same retained whole-branch reviewer, scoped supplement only. Requirements: task-12-review-brief.md, task-12-brief.md and the existing mandatory strict audit/build contracts. No broad review or prior Task11/Task7-prefix rerun.

## Verdict and exact scope

**SPEC: APPROVED. QUALITY: APPROVED. SOURCE/HOSTED-BUILD TECHNICAL PREREQUISITE: APPROVED.** No new Critical, Important or Minor finding. The Task11 dependency hold is cleared for root's fresh target/function/history/catalog preflight and coordinated exact-forward/runtime handoff. This does not claim remote application, runtime startup or final Task7/whole-branch acceptance.

BASE `5accbed8da205f331dc69b56ccd62196ea5ee2d7` → HEAD `b0a46eabd29c0fe6776cb267e466d73243d44c13`; executable source `f2d69ea088403a3f3e641d20112318b54a344577`, followed only by report/audit documentation. Review package40,625bytes, SHA256 `b30317c8b7cd7927a4975ec01c7877fce9808d226c5a5ef0c9b497d4a3b1bca3`. Reconstructed all seven packaged patches against BASE and matched exact HEAD content.

## Dependency scope and upstream evidence

The structural lock comparison contains exactly10 changed entries: root Zod declaration; root Zod/body-parser/qs/Undici; three nested Undici7copies; two removed nested Zod copies. No other package/integrity churn. Next16.4.1, React/DOM19.3.1, AI6.0.303, Workflow4.8.13 and @workflow/next4.1.17 remain fixed.

- Direct Zod4.6.6 and the major4-scoped exact override replace root4.3.6 and deduplicate the two vulnerable Vercel4.1.11 copies. Current official advisory identifies4.6.6 as patched. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Undici6.29.1 and7.30.1 overrides remain separate; AI provider-utils retains6, Workflow local/vercel and jsdom retain7. Official EventSource/excessive-encoding advisories fix both branches; mixed-case SRI fixes the affected7branch. No unnecessary major8 transition. [EventSource](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [SRI](https://github.com/advisories/GHSA-f72v-6w45-q472), [excessive encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c).
- body-parser2.4.0 fits the existing Express range and fixes the affected2branch. Its qs minimum necessitates6.16.1. The newer content-type/iconv-lite minimum declarations require no additional lock package change because existing copies satisfy them. [body-parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828).

Independently reread these five GitHub primary advisory pages during review; publication/update dates are distinguished from24Oct observation. Saved registry-selected/branches metadata confirms current4-branch Workflow parents still constrain Zod~4.3.6/Undici7.30.0; selected5parents likewise do not resolve those vulnerable constraints. Vercel CLI parents retain exactZod4.1.11. Avoiding parent upgrades/downgrades is justified. Overrides deliberately exceed some original parent pins/ranges; passing integration evidence is the justification, not an unsupported claim that every parent range natively accepts them.

Inspected actual production/full installed-graph JSON logs and exits0: only Zod4.6.6, body-parser2.4.0 and Undici6.29.1/7.30.1 appear among affected packages, with no invalid/missing flags. All seven affected physical package paths including qs agree with lock versions in the hosted snapshot. No audit policy, waiver, global configuration or credential handling change occurs in this delta.

## Tests and preserved failures

`tests/tooling/dependency-integration.test.ts:8-94` uses real Zod and AI schema conversion plus bounded disposable transport children. Children use positive PATH/NODE_ENV=test, ephemeral127.0.0.1 ports,12-second timeout and bounded output; no app3000/hosted/model calls. Coverage includes constrained-array short-circuiting, strict required assessment schema, body-parser subsequent-request compatibility, both installed Undici branch transports after excessive encodings and Workflow7mixed-case SRI rejection.

The tests do not merely compare package.json. Existing logs confirm FOUR actual failures before installation and TWO already-passing compatibility smokes, then6/6GREEN. The body-parser probe does not prove it reproduced that CVE, and no EventSource exploit reproduction is claimed. Patch provenance and strict audit cover those advisory identities; transport compatibility remains bounded. Initial positive-environment typing failure exit2 is retained and corrected to NODE_ENV=test; later typecheck0. Focused schema/Task11 run70tests/4files passes, and the final six probes pass. No reviewer rerun.

## Final native gates independently inspected

Actual evidence `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-5MXDSq/results.json`: test, lint, typecheck, workflow:wire, db:test, audit:dependencies and build:isolated all numeric0. Test summary758passed/65files. Wire record has20previous payloads/24current roundtrips,0failures. Both raw npm audit reports are version2 with empty vulnerabilities and info/low/moderate/high/critical/total all0; both real npm exits0. The strict audit implementation is byte-unchanged from the prior approved source. Task11's earlier audit1 is preserved and remains attributed to its earlier lock.

Generic isolated build and hosted build remain separate. Generic BUILD_IDc8XKB05fOmf7LmdLCY-w5 is not hosted Auth proof. Source/lock/native evidence are bound to executablef2d69ea, not the later documentation HEAD.

## Actual hosted artifact verification

Snapshot `/private/tmp/serenia-hosted-build-w4zDky/project`:

- Executable source `f2d69ea088403a3f3e641d20112318b54a344577`; Nodev24.14.1.
- Lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`.
- BUILD_ID `7-SFAHJkzrF9ef47Bhjl7`;876inventoried files.
- Artifact aggregate SHA256 `bc0ef03700d0c28d3de31bb188208916ee110dd08315caab71908c03fee6ca9f`.
- Actual build result exit0; hostedAcceptance=true and exact origin `https://brpozobkoatabctjjadc.supabase.co`.
- Metadata file SHA256 `6560efcdf8fa406a5c1facd2929fb667f8caa91ee80f14814c7531e1accde4b9`; artifact-record SHA256 `2503fd3b69d677866a5c7666e192724d01e117771ae3cc928c1760f15d5fe746`.

Directly rehashed every recorded artifact file and recomputed aggregate/BUILD_ID agreement. Read the actual copied affected package manifests and confirmed their patched lock versions. Read saved exact artifact-inventory recheck. The previously reviewed hosted-build/positive-environment implementation is byte-unchanged; selected target configuration handling is reused. No key/environment value or private clinical/profile row was printed. The build is **NOT STARTED at this checkpoint**; no new-runtime proof is inferred.

## Frozen application/SQL boundary

Task11 generation code and SQL semantics are untouched by this dependency delta. Canonical6f0037fc/93,052bytes, inboxforwardd9604/5,172bytes and review-facts-forward86a461/8,191bytes remain byte-equal to Task11. The independently approved exact Task11 forward can proceed through root's fresh guarded preflight/application protocol now that source/dependency/build prerequisites are cleared; no applied history or packet is rewritten.

Original source27/buildxhrWTx9JGknr6oTSmk6va and its earlier seven accepted prefix objects retain their historical identities. They are not substituted for new-source actual JWT/HTTP/Workflow/browser/review/cleanup acceptance. Missing historical process handles do not establish stopped state.

## Declined to judge and remaining gates

- Actual Task11 forward application and hosted direct-RPC fact-mutation denials: pending root execution and evidence.
- New patched-runtime startup, same-original-run recovery, native scored-facts/report/review/patient projection, combined fixture scope and cleanup/postchecks: pending. Technical readiness permits controlled execution, not a success claim.
- Universal vulnerability absence or future upstream advisories: audits are observations at their run time. No ongoing security guarantee is made.
- Clinical/legal/model-quality/public deployment and the human-deferred UX/diagnosis phase: separate unchanged gates.

No suites, remote queries, runtime/fixture writes or helper agents were used. Local hashing/AST-free patch reconstruction and saved-evidence analysis were read-only.

## Retained reading map

Package0–3: report/audit/dependency gates/plan;4: structural10-entry lock delta;5: exact direct pin and branch-scoped overrides;6: six integration probes. Reuse Task11 source/SQL review and Task7-prefixobjects1–7 without another broad pass. Final evidence supplement should inspect only actual new-source runtime/forward/UI/cleanup outcomes and any later delta.
