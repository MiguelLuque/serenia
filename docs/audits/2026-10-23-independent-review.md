# Revisiones independientes — archivo23octubre2026

Las aprobaciones de bloques locales y las correcciones estan completadas; **la aprobacion final de rama permanece retenida por Task7**. Las secciones historicas conservan reproducciones de defectos ya corregidos: consultar sus disposiciones posteriores y el [estado actual](2026-10-23-mvp-status.md). Los informes proceden del mismo revisor final; no son una nueva revision ni nuevas ejecuciones. Los hashes identifican los originales; los enlaces internos se adaptan a este archivo.


---

Fuente `final-review.md`, SHA256 `dfe6bbe36e00cc2650f8002142a622c33153bf738d7db8416e8275b266c1b3a8`.

# Final whole-branch review — provisional source pass

Status: **NEEDS_FINAL_EVIDENCE — source fixes accepted on `7ffc910` / evidence HEAD `8e1cd46`; no final approval issued.**

Update, 23 October 2026, Task10: the same reviewer independently **APPROVED specification compliance and quality** in [task-10-review.md](#task-10), exactHEAD `51b7690df8b895d0c936b7dbfa435ec7aa372c8e`. The disconnected Decisions cost estimator now charges inclusive cache reads/default-retention writes correctly, preserves free output and dated per-preset provenance, with8targeted tests/lint/types/offline passing. No new finding; prior Task9 all-seven evidence keeps source04052b4 identity. Root reports another terminal hosted invalid_request_state and unchanged fresh baseline; actual Task7 acceptance remains unavailable. Overall approval remains withheld.

Update, 23 October 2026: the same reviewer independently **APPROVED Task9 specification compliance and quality** in [task-9-review.md](#task-9), executable source `04052b47a43b871a41e6a319ea76ed5d1d1c6ac1` / evidenceHEAD `1ea0928677763aa189ffdb3d22035c93506d972d`. The expired waiver is removed; current production/full audits are both zero with no exemptions, the minimal Vitest dev patch and all seven native gates are accepted. Runtime dependencies/source are exactly unchanged from Task8; no new runtime smoke or liveness claim. No new finding. Task7's currently root-owned hosted operation and acceptance still require actual evidence; no result is inferred from an in-flight call. Task10 is outside this reviewed range.

Update, 15 October 2026: the same reviewer independently **APPROVED Task8 specification compliance and quality** in [task-8-review.md](#task-8), exact source `e7b79ea9111c760da2fa824f869b5d42b3a9bf8f` / evidence HEAD `cb02c2d108eb62a6037be1d0f5ce84f0de6fc45a`. The narrowly pinned Next/React patch, unchanged strict exception boundaries, seven passing native gates and new local generated-run smoke satisfy this maintenance scope. No new code finding or correction wave. Historical I1/restart proofs keep their original identities. Hosted Task7 and existing external gates remain unresolved; M4 remains nonblocking.

Update, 14 October 2026: the same reviewer completed the one scoped fix pass in [final-fix-review.md](#correcciones-finales). I1/I2/M1/M2/M3 are all **ADDRESSED at source level**. All seven native gates on corrected source exit 0; original canonical packet remains unchanged and I2 has a separate reviewed forward correction. The subsequent evidence-only pass on docs HEAD `c88c11f` **accepts the actual local visible-deadline browser proof for I1**. It records M4, a misleading waiting-status sentence at expiry, as a nonblocking copy follow-up; no new Critical/Important concern. Hosted applications and Task7 acceptance/independent task review remain pending. The initial findings and broad reading map below are retained as historical evidence, not outstanding requests to repeat the already accepted fixes.

Sole whole-branch reviewer, 13 October 2026. Frozen range: `0a2a139a900a510345726ba2d878ea83115dbce8..57a7cd56b32115ab0143283f011d41b80ce77315` (39 commits, 220 files). Package: `review-0a2a139..57a7cd5.diff`, 2,425,730 bytes. This report follows the requesting-code-review `code-reviewer.md` template. Implementation, Git and hosted state were not modified. Only this review artifact was written; no child reviewers or package-wide reruns.

## Strengths

- Ownership and authorization are enforced at multiple relevant boundaries: authenticated server entrypoints, same-owner relationships, restricted table privileges, explicit service-role worker ownership checks, and transactional RPCs. Patient report projection exposes only current reviewed public content rather than selecting private assessment JSON into the browser.
- Closure, conversation state and the durable assessment outbox are coordinated transactionally. Turn identity, retry leases, completion fencing, deterministic confirmation and recoverable delivery address important cross-layer failures. Questionnaire validation checks the whole definition and options before atomic scoring and handles the existing CSSRS skip rules.
- Source, synthetic PostgreSQL, actual JWT/PostgREST, generated Workflow startup/restart and browser evidence are distinguished. The offline model evaluation does not claim online clinical quality, calibration or measured savings. Hosted tooling positively binds the target, source/artifact identity and synthetic actors.
- Dependency work has pinned versions, real SDK serialization compatibility fixtures, a narrow expiring advisory exception and a fail-closed seven-gate entrypoint. The unsafe legacy reset has been retired without rewriting hosted history.

## Critical

None confirmed in the reviewed range. This is not a claim of clinical or production safety.

## Important

### I1 — the rendered deadline discards an urgent draft and removes its submission path

Locations: `components/chat/chat-view.tsx:140`, `:256-262`, **`:314-351`**; draft storage `components/chat/chat-input.tsx:15`.

When the page remains open while the local clock passes `expiresAt`, the interval makes `isTimeExpired` true. The `isExpired` branch unmounts the entire questionnaire/recovery/composer subtree. Since `ChatInput` owns its text in local state, an unsent draft disappears, including an explicit new crisis signal. The urgent-interruption and retry controls disappear too. The server's new crisis-before-time-limit behavior cannot help because the browser can no longer submit that text. This violates the planned protection for a new explicit crisis at the time boundary, and the recovery promise that typed text survives waiting/failure.

The submitted B07 browser case is narrower: the page was loaded unexpired, then only database `opened_at` was advanced before submission. The browser's own timer did not cross zero. That valid API/resource proof does not establish preservation or sendability across the rendered deadline. Parent explicitly confirmed this limitation.

Recommendation: preserve draft state and an available safety submission route across the rendered deadline while retaining server-authoritative closure rules and existing clinical criteria. Add a focused component regression for the clock transition and actual browser evidence that a typed explicit signal survives and is submit-able when the visible timer crosses zero. Do not claim a DB-only clock edit reproduces this boundary.

### I2 — a valid pending assessment disappears from the inbox or crashes its all-status page

Locations: **`lib/server/clinician/inbox.ts:37`**, `:52-53`; **`supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql:192-195`**. Valid enum member: `lib/shared/supabase/types.ts` (`assessment_status` includes `pending_clinician_review`).

The new Zod row schema excludes `pending_clinician_review`, although it is a valid database status supported by the review lifecycle. The new SQL pending filter and pending-first ordering exclude it as well. Such a row is hidden from the default clinical pending inbox; switching to the all-status view returns it and makes parsing the whole page throw `ZodError`. The current generator normally emits `draft_ai`, and the hosted baseline contains no clinical rows, but neither fact removes this supported status or makes the new reader safe for it.

Focused offline reproduction, executed successfully with a synthetic RPC stub (no DB or network):

```sh
rtk proxy node --conditions=react-server --import tsx --input-type=module - <<'JS'
import {getClinicianInboxPage} from './lib/server/clinician/inbox.ts';
const row={sessionId:'synthetic-session',userId:'synthetic-user',displayName:'Synthetic',closedAt:'2026-10-13T10:00:00Z',closureReason:'user_request',assessmentStatus:'pending_clinician_review',hasCrisis:false,topRisk:null,sessionNumber:1,daysSincePrevious:null,trendsByCode:{},openTasksCount:0,riskState:'none'};
try { await getClinicianInboxPage({rpc:async()=>({data:{rows:[row],hasMore:false},error:null})},{pendingOnly:false}); console.log('ACCEPTED_VALID_PENDING_STATUS');}
catch(e){console.log(JSON.stringify({rejected:e.name,issues:e.issues?.map(i=>({path:i.path,code:i.code,allowed:i.values}))}));}
JS
```

Observed exit 0 with caught result:

```json
{"rejected":"ZodError","issues":[{"path":["rows",0,"assessmentStatus"],"code":"invalid_value","allowed":["draft_ai","reviewed_confirmed","reviewed_modified","rejected","superseded","requires_manual_review"]}]}
```

Recommendation: include the existing enum in parser, pending filter and pending ordering, and add schema plus real SQL coverage for a pending row. If the frozen hosted packet has already applied, use a separately reviewed forward migration; do not change the applied packet, original migration bytes or recorded history. Parent has acknowledged this constraint and owns the fix.

## Minor

### M1 — urgent-mode copy promises a broader interruption path than the admission rule supports

Location: `components/chat/chat-view.tsx:346`.

The text invites immediate danger “para ti o para otra persona” and says a safety signal can replace the pending turn. Admission is actually limited to the existing lexical high-signal labels. A concrete threat toward someone else can therefore be rejected while a turn is pending. This is an inaccurate promise in the new recovery UI; it does not justify broadening the clinical classifier without approval. Clarify the wording and preserve direct emergency guidance under the existing approved criteria. No recommendation to change scoring, labels or thresholds is made.

### M2 — local restart observer can associate another run's retry with its fixture

Location: `scripts/acceptance-scenarios.mjs:107-113`.

The local observer accepts any newly finalized `step_retrying` event before recording the actor/checkpoint and stopping the PID. README's idle-local-namespace requirement and the actually correlated evidence make the submitted local proof usable, but concurrent retries would produce a misleading future proof. Bind this local observer to the fixture's durable job/run identity and stop scanning after the selected event. The hosted observer's actor/job/token/run binding is an improvement and does not automatically fix this local path.

### M3 — expected negative-test errors remain indistinguishable from unexpected stderr

Location: `tests/chat/safety-flow.test.ts:38-47`.

The persistence-failure regressions deliberately emit application errors. Tests pass, but stderr is not an asserted part of their contract. A scoped, restored `console.error` spy would verify the intended errors while allowing unexpected noise to remain visible. This is a harness clarity concern, not evidence that the existing passing suite failed.

## Verification and evidence limits

- Read the spec, plan, final-review brief, progress Ruling/deferred lines, implementation and acceptance reports. Reviewed the full range by area, prioritizing production behavior and architectural interactions. No extra broad suite was run.
- Directly inspected `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-hmUg3q/results.json`: all seven entries (`test`, `lint`, `typecheck`, `workflow:wire`, `db:test`, `audit:dependencies`, `build:isolated`) exit 0. Parent reports 708 tests/63 files. Private raw logs were not opened or reproduced.
- Read actual browser and independent local-acceptance reports. Same-original-run restart on c345887 and later generated smoke/browser acceptance on a69651b remain distinct; no blanket preload equivalence is asserted. I1 identifies a gap in the B07 scenario, not a denial that its recorded request succeeded.
- Verified generated hosted SQL packet size 92,971 bytes and SHA-256 `724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae`; all six included migration sections match source bytes. This establishes packet/source identity, not successful hosted application.
- Read lockfile changes structurally: 1,263 to 1,059 packages, root declarations agree with package.json, resolved registry URLs use npm. Verified all 20 historical SDK payload files match their recorded hashes and sizes. Generated types, lockfile and metadata were checked structurally and for affected contracts rather than treated as independently authored executable code.
- The synthetic I2 call above is the only additional behavioral check. It proves the parser failure; the SQL omission is directly visible in the predicate/order. No credentials, environment values, real Auth/profile/clinical rows or raw runtime logs were accessed.

## Reading map retained for continuation

Diff indexes are zero-based after splitting the immutable package on `diff --git`; use this map to avoid restarting the broad pass. Large terminal output was bounded; truncated portions were narrowed in subsequent reads. Coverage is source-level for production changes, contract/scenario-level for tests and reports, and structural/identity-level for generated artifacts. It is not a claim that every generated lockfile line or fixture byte received semantic manual review.

| Area / indexes | Pass and interaction checked |
| --- | --- |
| Config, CI, docs, package (0–5, 17, 22–24, 33–66, 93, 97–99, 219) | Environment names only; exact pins/overrides; vendor licensing; CI evidence/redaction; dependency exception; upstream/clinical/legal gates; model research frozen-date limits; reports checked against acceptance scope. |
| API/auth/onboarding/patient UI (6–20, 25, 31, 64–65, 68, 79, 82–87, 92, 94–95, 100) | Auth and owner checks before elevation; route bounded body; age civil date/current consent; profile safe grants; redirect/cookie refresh; safe patient report projection; session/history name fallbacks. |
| Chat/questionnaire/recovery (26–28, 32, 70, 80–83, 90–91) | One-user-turn transport, full persisted bounded history, high-signal-before-expiry, exact retry identity, race/fencing and rehydration, drafts, proposal confirmation; complete answer/options/CSSRS transitions. I1 and M1. |
| Clinician and worker (11–12, 29–30, 67–69, 71–78, 88–89) | Global inbox priority/pagination, full risk dimensions, review/version/task transaction, rejected regeneration, explicit owner/job fences, outbox claim/dispatch/recovery, fail-to-manual on history limits; prompt artifact paths; auxiliary no-authority/offline only. I2. |
| SQL and generated DB contracts (96, 125–138) | Restricted grants/RLS, composite ownership, consent wrappers, public projection, clinical review atomicity, turn leases, questionnaire atomicity, outbox tokens/global slots, trigger ACL guard, no remote history rewrite; packet preservation transaction and source identity. I2. |
| Operations/runtime (101–124) | Loopback-only local tools; exact hosted target/actor scope; positive environment launchers; immutable artifact identity; actual generated SDK runtime/restart observer; synthetic providers and cleanup bounds; fail-closed audit/build/SQL/wire/verify scripts. M2. |
| Tests and synthetic artifacts (139–219) | SQL actor/RLS/grant/transaction/concurrency contracts; route and recovery cases; UI questionnaires/onboarding; risk parity; offline corpus limitations; all SDK fixture hashes; baseline replay implementation and final wire gate distinction. M3. |

## Declined-to-judge items and reasons

- **Clinical validity, live model behavior/calibration and new classifier thresholds:** synthetic tests and schema checks cannot establish these; the plan requires clinical approval and leaves online evaluation NOT_RUN. No new labels/cuts or draft prompts should be introduced to make this review pass.
- **Availability promises inside retained signed clinical prompts:** the existing “hoy mismo” review language in `docs/agents/prompts/session-therapist.md:78` needs a real operational/clinical owner before patient use. This review does not certify that service or silently rewrite preserved signed copy. M1 concerns newly introduced recovery wording and can be addressed without changing signed prompts.
- **Current external prices, model account availability, vendor changes and announced upstream patch:** research documents are dated snapshots; no production model switch is made. This source review does not refresh web research or call paid providers. Expiring gates remain explicit.
- **Production deployment, Local World public ingress, production cron scheduling, real patient use and legal adequacy:** outside authorized local/targeted-hosted acceptance and explicitly gated. Successful local/hosted synthetic proofs cannot approve publication or real care.
- **Legacy tokenless Workflow replay and the unused alternative generator's historical truncation:** compatibility is documented; the new durable path supplies tokens and the alternative generator has no identified productive caller. No new failure in the scoped path was established. Future reuse needs a fresh review.
- **Maximum-attempt exhausted recovery and unrelated legacy GDPR behavior:** reviewed the bounded new job behavior and touched SQL variable resolution; no concrete new defect established. Did not broaden into an unrelated redesign.
- **Post-cleanup full original-account preservation:** transaction-internal full-row/catalog assertions prove the migration boundary; post-fixture aggregate counts/catalog checks are narrower. No real row/hash inspection or backup claim is made by this review.
- **Task7 hosted application, actual JWT/browser/restart result and final source identity:** evidence has not yet been supplied. PREPARED_NOT_APPLIED is neither success nor failure of the pending run. The same reviewer will consume the final report, independent Task7 review and supplementary diff before any verdict.

## Recommendations and assessment

One coordinated fix wave should address I1/I2 and triage the minors, preserving the applied hosted packet if Task7 has already migrated. Then supply focused regression results, actual visible-deadline browser proof, any forward-migration review/application evidence, Task7's completed acceptance and independent task review, and the final HEAD/supplementary diff.

**Ready to approve: no.** All five source fixes and I1's actual local visible-deadline proof are accepted; Task8/9 maintenance and Task10 estimator correction are independently approved, latest scopedHEAD51b7690. Task9's strict audits/all-seven evidence remains tied to04052b4; Task10 has its narrower targeted acceptance. Hosted application outcomes and Task7 final acceptance/independent review remain blocked by the repeated official connector failure, with existing external release gates unchanged. M4 is a deferred nonblocking copy follow-up. See `final-fix-review.md` and `task-8-review.md` through `task-10-review.md` for exact evidence identities and limitations. Resume this same reviewer when hosted evidence or a subsequent source delta is available; do not restart or duplicate the whole-branch pass.

<a id="correcciones-finales"></a>


---

Fuente `final-fix-review.md`, SHA256 `a5f5ced53a55c4b011b26afb1490ec4bf62667f37bf41cc86992ce3b523f6d1c`.

# Scoped final fix review

Status: **SOURCE FIXES ACCEPTED; NEEDS_FINAL_EVIDENCE. No final branch approval.**

Evidence update, 14 October 2026, docs-only HEAD `c88c11f9d2629e51ffd76dd8ae1de978d53c5e38`: **I1 actual visible-deadline local acceptance is now ACCEPTED.** The original source dispositions remain valid. A newly observed Minor copy issue is recorded below; hosted Task7 remains the outstanding acceptance gate.

Same sole whole-branch reviewer, resumed 14 October 2026. Reviewed only `57a7cd56b32115ab0143283f011d41b80ce77315..8e1cd46f175bde2412967b8ece060af8fd7d48f7`, using the supplied 111,681-byte supplement and existing broad reading map. Fix source is `53c20c36ca8f754a8c5a148f583dab43162dc80d` plus test typing correction `7ffc910ef5a93b5fc23171e41da711e034adeeb6`. Direct Git comparison confirms `7ffc910..8e1cd46` changes only the two implementation/evidence reports. The earlier broad review is retained, not repeated.

## Finding dispositions

| Finding | Disposition | Review evidence |
| --- | --- | --- |
| I1: draft lost at rendered deadline | **ADDRESSED; actual local browser evidence ACCEPTED** | `components/chat/chat-view.tsx:207,314,324,342,350` keeps the same composer mounted until confirmed closure, blocks ordinary submission/retry at the local deadline, and exposes urgent opt-in without changing server admission. `tests/chat/recovery-view.test.tsx:22` covers the actual component clock transition with and without recovery. The subsequent real browser/persistence evidence below closes the previously pending visible-clock dimension. |
| I2: supported pending status omitted/rejected | **ADDRESSED in source; hosted application pending** | `lib/server/clinician/inbox.ts:37,53` now accepts and prioritizes `pending_clinician_review`. The separate `supabase/migrations/20261013213559_final_inbox_pending_review.sql:32,35` adds it to both SQL status lists; no other function-body change. Parser regression covers all seven enum states; real SQL regression at `supabase/tests/clinician-inbox-page.sql:64-66` requires pending/all-page inclusion and priority while retaining urgent-first and bounded pagination assertions. |
| M1: broad urgent-interruption promise | **ADDRESSED** | `components/chat/chat-view.tsx:347` describes personal self-harm/suicide signals and explicitly limits the replacement path; danger to another person is directed to emergency help. No classifier, signed prompt, cutoff or clinical rule changed. |
| M2: unrelated retry could satisfy local checkpoint | **ADDRESSED in source** | `scripts/acceptance-checkpoint.mjs:6-23` binds session, recorded job token/run, installed SDK-hydrated arguments and finalized intended event files. Local observer uses it at `scripts/acceptance-scenarios.mjs:109-117` and breaks immediately after recording/stopping the intended checkpoint. Hosted observer shares the helper. New tests use actual SDK serialization and reject an unrelated-first event and mismatched token/session. This fixes attribution; actual Task7 restart evidence remains separate. |
| M3: expected error output unasserted | **ADDRESSED** | `tests/chat/safety-flow.test.ts:39-54` scopes the spy to the two failure regressions, asserts the exact request/failureRecorded call list, forwards other error prefixes and restores the spy in `finally`. Extra same-prefix calls still fail the exact assertion. No production error suppression. |

## Strengths and new-breakage check

The fixes target the demonstrated failures without changing clinical thresholds or weakening server closure/ownership checks. The new forward migration guards the exact old body, owner, security-definer property, return type, volatility and search path before replacement. CREATE OR REPLACE preserves signature/ownership/ACL. Direct byte comparison confirms that the new function body differs only in the two pending-status lists.

The new hosted `browser-deadline` fixture sets a real future expiry before page load, on a newly created manifest-recorded synthetic actor, enabling the requested visible-clock proof. The hosted-build change canonicalizes the OS-created temporary directory before existing guards; it does not accept a destination override or relax target/environment checks. Grant metadata additions contain structural grant information, not account/clinical values. The test typing correction performs a real `Uint8Array` check before encoding, without weakening the serializer contract.

**New Critical: none. New Important: none. New Minor: none confirmed in the supplement.**

## Verification reviewed

- Read the complete executable/test changes in the supplement, the forward manifest and the fix/task reports. Structural grant metadata and duplicate SQL were checked structurally/by identity. No whole-branch rescan, child agent, remote query or suite rerun.
- Directly read `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-MroEUx/results.json`: all seven gates exit 0 (`test`, `lint`, `typecheck`, `workflow:wire`, `db:test`, `audit:dependencies`, `build:isolated`). Fix report records 720 tests/63 files on source `7ffc910`. RED/GREEN history and the initial test-typing build failure are explicitly retained in that report; private raw logs were not opened or relabeled as new reviewer executions.
- Separate hosted-build success is reported for source `7ffc910`, BUILD_ID `h_Y-3xImJ5IJapWAPgNBj`, artifact SHA-256 `2c1cfcc8a28ce4679b3907b5709d133cf602af986f4f49ae1ca1d95a4dc75528`, lock SHA-256 `86749cc76613926df395608ea88f243ad40a3e1e26e0ea86c1ff8df0f7c476a4`. Build success is not hosted runtime acceptance.
- Directly verified `supabase/hosted/inbox-forward.sql` equals its source migration, size 5,172 bytes and SHA-256 `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`; old/new function-body MD5s are `d8cd7b9badc44fe4b4ec7191d878815d` and `9c91fd44e4c712465ebb44692b30c1da`.
- Directly verified original canonical packet remains SHA-256 `724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae`. Neither original history nor the original migration was rewritten by this wave.

## Unresolved evidence and declined-to-judge items

1. **Actual visible-deadline browser proof:** accepted by the evidence-only continuation below. It establishes this UI boundary on the local target; hosted Task7 acceptance remains separate.
2. **Task7 canonical and forward hosted application:** pending. Parent reports latest official MCP call failed with expired requestState and actual poststate remains 40 historical migrations, canonical/new tables absent, two accounts/two profiles and no active queries. This reviewer did not query remote state and makes no independent application success claim. Both exact packets remain prepared, not applied; root owns connection recovery and application.
3. **Task7 actual acceptance and independent task review:** pending, including real target Auth/JWT/HTTP, generated runtime/same-run restart, scoped UI, preservation/cleanup and required advisor/type dispositions. No inference from a successful build or synthetic SQL tests.
4. **Clinical/legal/live-model/upstream/production gates:** unchanged from the broad review. No new online benchmark, production approval, real patient use or external patch availability was evaluated. The dated Next patch announcement remains an external fact to verify when that gate is addressed; its date alone is not proof of installation or resolution.

## Assessment

All five requested findings are **ADDRESSED at source level** on `7ffc910`, carried unchanged into evidence-only HEAD `8e1cd46`. The scoped fix wave is accepted. The subsequent local I1 proof is accepted; M4 below is a nonblocking copy follow-up. **Final whole-branch approval remains withheld** until completed Task7 acceptance/independent review arrives. Resume this same reviewer for those evidence items and any truly subsequent source delta; do not repeat the broad review or passed suites without a concrete new doubt.

## Evidence-only continuation: actual visible deadline

Reviewed `docs/audits/2026-10-14-visible-deadline-acceptance.md`, viewed the actual deadline screenshot and checked the scoped private JSON through assertions that print only booleans. Direct Git comparison confirms `8e1cd46..c88c11f` changes only reports/audit documentation; executable source remains the already reviewed source. No source edit, suite/runtime rerun, browser replay, remote access or helper delegation was performed.

The root's CUA sequence establishes future expiry → 2 minutes → 1 minute → rendered zero with the same draft, ordinary submission disabled → explicit urgent opt-in → one send → static response → actual reload/Home showing closed for safety. The screenshot independently inspected here shows the expired banner, preserved explicitly fictional draft, disabled ordinary Enviar, and urgent opt-in. Its 49,840-byte artifact matches SHA-256 `6f54721d43afd508c9fd04898d8fdf75403899c2a13a9e5db2784fab9dcc521e` (root CUA call `call_afdc77b7fe31434d97805def55f0d0c9`). The screenshot alone does not establish the whole sequence; the root's actual observations and persistence correlation supply those remaining parts.

Private proof `/private/tmp/serenia-local-visible-deadline-20261014/actual-visible-deadline-persist-proof.json` matches SHA-256 `ac6f74c296e48115832c9a25a5822840163b76774f85953a7815ace390555b6e`. Reviewer assertions independently confirm source `8e1cd46`, BUILD_ID `XSm_U12OjXVVPCdUkN870`, PID55134; exact scoped session/owner; two message roles; one completed single-attempt request `2a3d0bd0-46d1-4ed2-9166-51fe2fa9c6bf`; one high-risk event; crisis closure; one completed single-attempt outbox job for run `wrun_01M4Y2RVNZEKXREPE45PYTY5W7`; one `requires_manual_review` assessment; individual conversational/structured/fast/provider-denial counts all zero; and the proof's asserted Workflow identity binding. Raw rows, text bodies and tokens were not printed.

**I1 disposition: ADDRESSED with actual local browser acceptance.** This closes the precise gap left by B07's DB-only expiry edit. The one-message transcript correctly reaches the minimum-three-messages manual-review guard; this is neither a successful clinical-summary claim nor a same-original-run restart proof. Local acceptance does not establish hosted migration/I2 parity or Task7 acceptance.

### M4 — Minor, nonblocking: misleading waiting copy at the deadline

Location: `components/chat/chat-view.tsx:340-341` (the status ternary inside the recovery block, shown when `isTimeExpired` is true).

Actual browser evidence shows “Esperando respuesta. Puedes seguir escribiendo.” at zero before any request, when ordinary input is disabled until urgent opt-in; root also observed that text after the static response until reload. The default status branch describes waiting whenever the expiry block is visible, even when no response is pending. This may confuse the user about whether a request is running and whether typing is enabled. It is a confirmed copy/state mismatch, **not** evidence of lost text, duplicate submission, failed safety response or loss of server-authoritative closure: the demonstrated urgent path completed and reload showed the correct closed state.

Disposition: **defer as a nonblocking UI follow-up**, without reopening the completed single source-fix wave. A later copy change should distinguish expired/idle from genuinely submitted/streaming status and describe the urgent opt-in accurately. No clinical criterion or backend behavior change is indicated. No new Critical or Important concern was found by this evidence-only pass.

Hosted gate remains open: parent reports the 14 October 20:56 UTC exact-target postcheck retains original 40 history fingerprints/catalog baseline, no canonical/forward/new tables/clinical rows/active packet queries, two Auth users and two profiles; the human-requested retry again returned expired requestState. These are parent-supplied observations, not remote checks by this reviewer. Both applications and Task7 acceptance/task review remain **NOT_RUN**, so full approval remains withheld.

Subsequent parent notice during this evidence pass: primary GitHub sources now reportedly publish Next16.4.1 and three advisories affecting <=16.4.0. Parent is assigning a separate newly actionable security-maintenance delta to the same source owner. This reviewer did not research or assess that patch in the I1 evidence-only pass. Its exact diff and verification must receive a scoped independent review before final approval; earlier native/build evidence remains tied to its original source. This does not reopen the five accepted fixes or require another broad branch review.


---

<a id="task-8"></a>

Fuente `task-8-review.md`, SHA256 `5d1f3d8b1c8c565cb0754af74ce2753a2a4783e6161cd460776c9fae369e73aa`.

# Task8 independent scoped review

15 October 2026. **Specification compliance: APPROVED. Code quality and scoped acceptance: APPROVED. Whole-branch release approval: WITHHELD for Task7 and existing external gates.**

Same sole final reviewer; no helpers or repeated broad pass. Exact reviewed range `b67368eb2f2dfaf8c60e44fe3b82a5d1d92a8902..cb02c2d108eb62a6037be1d0f5ce84f0de6fc45a`. Executable source `e7b79ea9111c760da2fa824f869b5d42b3a9bf8f`; direct Git comparison confirms only the two evidence reports changed afterward. Supplied seven-path diff verified: 36,122 bytes, SHA-256 `2e186519abc06831cc6bd59103f418b2e5dc2b961b3e8a0b21a956c4549ef7ad`.

## Specification and primary evidence

The four exact pins implement the authorized maintenance: Next and eslint-config-next16.4.1, React and ReactDOM19.3.1. Direct primary-source checks confirm Next16.4.1 is the patched version for the [typed-array cache RCE](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), [SVG optimizer RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) and [Server Action DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r). The SVG advisory also specifies sharp>=0.35.5; the existing locked0.35.5 satisfies it. The [Next release](https://github.com/vercel/next.js/releases/tag/v16.4.1) links those advisories and tag7217011.

The [React19.3.1 release](https://github.com/react/react/releases/tag/v19.3.1) and [merged PR37845](https://github.com/react/react/pull/37845) substantiate the paired transport-protocol maintenance. The report correctly avoids claiming that Next requires this exact React patch or that a separate React advisory was established. Installed peer ranges remain compatible.

Release-date precision limitation: the live Next release page viewed during this review displays14Oct17:47, whereas the submitted report records14Oct15:39. The date, version, tag and advisory links agree. The exact minute is not used as acceptance evidence and is not a code/security defect; preserve it as a prior observation or omit minute precision in subsequent summaries.

## Quality, graph and audit policy

- Independently compared parsed base/current lockfiles:1,059 entries in each, zero additions/removals; exactly14 package nodes changed, plus root dependency declarations. Those are Next/@next/env, eight SWC platform packages, eslint-config-next/plugin and React/DOM. All other package objects are equal. Lock SHA-256 `4f7ab0eee4e989a1dbabe3b6f248529db1859eb2c9899b87f91ab3ab00744e8a` matches the report. Read the complete lock delta; changes are versions, registry artifact identities and the corresponding Next/SWC/plugin/sharp/React peer edges.
- `scripts/audit-dependencies.mjs:9,11` changes only the two parent versions and exact plugin edge from16.4.0 to16.4.1. The GHSA identity, five-entry shape, dev-only requirement, production-zero requirement, consumer checks, report consistency validation, config SHA and hard expiry18Oct00:00UTC are unchanged. Direct config hash remains `6b440fd458d9a2820a20e10b81127025eb257b04aacd06ea539fc40f4eca5ed2`.
- The three added negative cases in `tests/tooling/audit-exception.test.ts:82-91` reject either old parent and a widened plugin edge. They strengthen exactness rather than relaxing the gate. The report preserves the old-guard RED and37/37 targeted GREEN results; no suite was rerun by this reviewer.
- Documentation continues to distinguish production audit0 from full audit exit1/five inherited high entries. The temporary exception is not extended or generalized. No audit-fix force, unrelated dependency drift, clinical/prompt/product change, SQL edit, Workflow SDK update or runtime-harness source change appears in this scope.

## Evidence verified

Directly read final native `serenia-verify-f3eMCR/results.json`: all seven numeric exits0; its SHA-256 is `63072591d08606307cb73aac626a81594600f3ee120958ae6b46ed9132d8b52e`. The report records723 tests/63files and20prior/24current wire cases. Directly read the first restricted `BwBGj7/results.json`: four exits0 and three exits1 (DB/audit/build). That unsuccessful run remains distinct and was not counted as acceptance. Raw runtime logs were not opened.

Generic build3lkG0c and actual-local-key buildJJwkyM are separately recorded. The latter's structured smoke proof independently matches SHA-256 `2007256b69fd9cda198675ae1a2c785de87c47e50b13fe26ccde1710e917baeb`. Without printing raw rows, tokens or message bodies, reviewer assertions verified:

- Exact sourcee7b79ea/lock above, BUILD_ID `eb82GmzSYtaaGZPdfJxGO`, PID59857.
- Five successful HTTP turns, five persisted completed single-attempt turns scoped to the manifest actor/session, ten scoped messages with five user/five assistant roles.
- User-request closure, one completed single-attempt outbox job, hydrated input session/token bound to completed run `wrun_01M4YAS61A3EH3X3AEJXK1A8Z0`.
- Scoped `draft_ai` assessment, patient projection pending_review with null summary, and individual provider counters5conversational/1structured/0fast/0networkDenied/0modelDenied.

These checks support the new artifact's ordinary generated Workflow/Auth/chat integration. Reported current consent, generated endpoint health/malformed checks, original runtime ownership checks and graceful switch provenance were read as implementation evidence; this reviewer did not independently replay them. The exact historical I1/restart evidence is retained rather than relabeled as a new patched-build browser or restart run.

Independently rehashed hosted packets: canonical remains `724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae`; forward remains `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`. Task8 did not apply either.

## Findings and declined-to-judge items

**Critical: none. Important: none. Minor code findings: none in Task8.** The release-minute discrepancy above is a nonblocking provenance precision note, not an implementation fix request. Existing M4 remains a deferred nonblocking copy issue outside this maintenance delta.

Declined to certify: hosted application/I2 deployed parity and Task7 acceptance (not run); a new same-original-run restart or native browser acceptance on patched dependencies (not performed or claimed, unchanged SDK and targeted ordinary-run acceptance satisfy Task8); live model quality/clinical/legal/privacy approval (synthetic provider evidence does not establish those); production deployment or complete vulnerability absence (outside this task, and the exact development exception is still active). Did not rescan package registries for newly published braces releases: the submitted bounded registry evidence and unchanged hard expiry support this task's temporary disposition; the exception must still be removed when a compatible fix is available or fail at expiry.

## Assessment

**Task8 APPROVED for both specification compliance and quality.** The new security-maintenance source/build gate is satisfied on e7b79ea and evidence-only HEADcb02c2d. No correction wave is requested. Full branch approval remains withheld for actual hosted canonical+forward application, Task7 acceptance/independent task review and the existing clinical/legal/production gates. The development exception remains time-limited; this approval does not extend it.


---

<a id="task-9"></a>

Fuente `task-9-review.md`, SHA256 `247edfaa5b78796e95fd65c49857b63e27f25f372ad8e78dc5fd23d5ff6ea584`.

# Task9 independent scoped review

23 October 2026. **Specification compliance: APPROVED. Quality and scoped acceptance: APPROVED. Full branch approval remains WITHHELD pending Task7 and existing external gates.**

Same sole final reviewer. Requirements-first review of `task-9-brief.md`, report, full unique diff and focused evidence. Exact range `86e1ac8cfa2e59aa4d757e65722778c47fa6c627..1ea0928677763aa189ffdb3d22035c93506d972d`; executable source `04052b47a43b871a41e6a319ea76ed5d1d1c6ac1`. Verified diff40,963bytes/SHA-256 `507b264d357eb43c6edbe042c41e06683b60765e2f9a38130293ba73ef7893d4`. No helpers, broad review repeat, suite/runtime execution or hosted action.

## Specification compliance

The expired exception is removed, not extended. Direct primary-source inspection confirms [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was withdrawn23October and lists no patched braces version. The author identifies lack of practical exploitability as the withdrawal reason. This does not imply that the repository patched braces or that the previous exception was valid after its expiry.

The current Vitest findings are addressed by the minimal official4.1.12 backport. Both [manual mock injection](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8) and [Windows redirect traversal](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp) identify4.1.12 as patched; the [release](https://github.com/vitest-dev/vitest/releases/tag/v4.1.12) links hardening PR11580. No forced incompatible major or unrelated upgrade is present.

Independently compared parsed base/current lockfiles:1,059 entries in each, no addition/removal; only Vitest and seven @vitest packages change4.1.11→4.1.12, all dev-only before/after, plus the root dev pin. Lock SHA-256 is `e0f9eb1ffc90023ebb1b4bf2f1b7f85902f751229d2d679733f64f7b75fc1ed4`. Package artifacts/edges in the entire diff are consistent with the patch. The optional browser-webdriverio peer becomes^4.1.11 as published; it is not installed or a production-node change.

## Quality review

`scripts/audit-dependencies.mjs` now accepts only zero findings in production and full scopes. It retains npm v2 shape/count/dependency consistency validation, rejects unknown scope and requires clean production evidence before accepting full. CLI calls always pass the actual process exit, and failed/incomplete command evidence fails the overall gate. The added optional JSDoc parameters preserve existing helper call patterns while allowing a real numeric/null exit to be checked; undefined is intentionally a report-only helper invocation, never the CLI's omitted process status. No cast or test weakening conceals the initial typing failures.

The replacement audit-policy tests retain malformed/inconsistent report checks and add all-severity rejection, formerly exempt graph rejection even before the old deadline, missing/nonzero production evidence and report/exit mismatch cases. Removal of graph/config/clock exception tests follows removal of that entire bypass; the smaller suite count is explained, and no product test changed. Audit child environment now has private HOME/cache, empty user/global config and explicit public registry. Effective ESLint configuration is unchanged, independently hashed `6b440fd458d9a2820a20e10b81127025eb257b04aacd06ea539fc40f4eca5ed2`.

Read the focused installed API script and its successful recorded result. Direct source inspection finds JSON.stringify for module URL/export names in `node_modules/@vitest/mocker/dist/chunk-utils.js:5-11` and pathname normalization before allowlist checks in `dist/node.js:200-204`. The recorded exported helper/plugin call is a proportionate compatibility check. It is accurately limited to installed API/source behavior, not a live Windows/browser exploit reproduction.

## Evidence verified

- Directly read all three native results files and verified their hashes. RestrictedOilFHI: test/lint/wire0, typecheck2, DB/audit/build1. IntermediatebF5Qkt: typecheck/build1, other five0. FinalDYEnp5: all seven numeric0/no errors, SHA-256 `b1171cab9fe8f5f571f4748f21fef13585a44b66cd6518b0688a81f9631e3751`. Report records713tests/63files and20prior/24current wire cases. Initial failures are retained, not recast as passing.
- Directly read final production/full audit JSON and exit records: every severity/total0 and npm exit0 in both scopes. No exemption outcome remains. The indexed RED/exit-mismatch RED are exit1; strict/final targeted/typecheck/native/API records are exit0. Evidence index has126 retained file entries; all indexed paths exist at review time. Raw runtime/failure logs were not printed or replayed.
- Read final isolated build metadata/result and BUILD_ID: source04052b4, matching lock, Node24.14.1, Next16.4.1, Vitest4.1.12, localAcceptance=false, exit0, BUILD_ID `KTqj18xsAQLNY9ZYIkNoN` at `serenia-build-IAV7hh`. It is an accepted placeholder build, not local Auth/runtime acceptance.
- Direct Git comparison confirms the only post-source change at finalHEAD is the tracked audit document. Compared against approved Task8 sourcee7b79ea: production root dependencies and every non-dev lock node are equal; app/components/hooks/lib/Next-config/acceptance sources have no change. Therefore the brief's dev-only allowance for no new runtime smoke applies. No present server/PID or new smoke success is inferred.
- Independently rehashed canonical724e and forwardd9604 packets unchanged. Task9 source does not touch SQL or hosted state. Root's currently live official hosted operation is outside this review; its result must be supplied separately.

## Findings and limitations

**Critical: none. Important: none. Minor: none introduced by Task9.** Existing M4 remains the previously deferred copy issue.

Declined-to-judge items: current runtime/JWT/browser/restart liveness (not run; dev-only equivalence justifies this task's acceptance but cannot prove live health); missing old temporary Task8 raw artifacts (their original source-specific review remains historical evidence, not a fresh verification); hosted migration/application/advisors/types/acceptance (root owns the live operation; no success assumed); Windows/network exploit behavior (not reproduced); clinical/legal/live-provider/production authorization (unaffected and unresolved). Current audit results are point-in-time registry evidence, not universal vulnerability absence.

Task10 pricing work was mentioned by root but has no source delta in this range and receives no approval here.

## Assessment

**Task9 APPROVED for specification compliance and quality on source04052b4 / evidenceHEAD1ea0928.** The expiry blocker is resolved through removal of the waiver, verified upstream withdrawal and the minimal active Vitest patch; strict production/full audit0 and all seven native gates pass. No correction wave is requested. Full branch approval remains withheld until the actual Task7 outcome, acceptance and independent task review are supplied; any later source block needs only its scoped review.


---

<a id="task-10"></a>

Fuente `task-10-review.md`, SHA256 `7cd96c87889f5f6971986f8c7c45c0bca83657583c246145d182d65d1ca1917a`.

# Task10 independent scoped review

23 October 2026. **Specification compliance: APPROVED. Code quality and scoped acceptance: APPROVED. Full branch approval remains WITHHELD for Task7 and existing external gates.**

Same sole final reviewer. Read the Task10 brief first, then report, root's dated research context and the entire three-file diff. Exact range `e3c44506fa08355dbf4a087cf19f41fb62ba9fbc..51b7690df8b895d0c936b7dbfa435ec7aa372c8e`; verified8,437bytes/SHA-256 `1eb2557ff1d629864355c5d0581c2db1b3f668deefdd900e99a152f9bd03ae84`. No broad review repeat, helpers, test/runtime rerun or remote action.

## Specification and arithmetic

Directly checked current primary documentation. The [Decisions guide](https://developers.openai.com/api/docs/guides/decisions) states that output is free, cache reads/writes are charged at standard Luna rates, both counters are already included in input, and regional/long-context input premiums apply. The [Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna) confirms input0.10/read0.01/write0.125USD per million; the [pricing table](https://developers.openai.com/api/docs/pricing?latest-pricing-expanded=true) distinguishes30-minute from12-hour writes and regional uplift. The code explicitly limits its single write rate to default30-minute retention.

`lib/shared/llm/candidates.ts:21,35-40` correctly updates Decisions only to `[.1,0,.01,.125]` and returns its own23October snapshot with11October fallback for other presets. The typed `CandidatePreset` local permits the optional field without casting. Existing inclusive arithmetic yields:

`(700000 × 0.10 + 200000 × 0.01 + 100000 × 0.125) / 1000000 = 0.0845USD`.

The two applicable premiums yield `0.0845 × 2 × 1.1 = 0.1859USD`; zero output tariff keeps both results invariant with arbitrary output counts. Cache tokens are not double-counted. The existing1000uncached-token example remains0.0001USD with the corrected date. Other candidates are deliberately not marked freshly revalidated.

## Quality and verification

Meaningful regressions cover cache accounting, output-free behavior under both premium modes, prior dates for all other presets, each missing counter, invalid numeric values and cache overlap. Unsupported-premium validation is unchanged. The evaluator's dated expectation matches the preset.

Directly inspected retained exit records and concise test summaries: RED exit1 with2failed/6passed; GREEN exit0 with8passed/2files; lint/typecheck/offline all exit0. Parsed offline output identifies exactHEAD51b7690, trackedSourceDirty=false, seven checks PASS including costFixture,26synthetic seeds, zero online budget, auxiliary off and all online compatibility/quality/latency/calibration/measuredCost NOT_RUN. These are implementation executions reviewed here, not reviewer reruns.

Independent import search finds only the offline evaluator/tests consuming candidates and only the offline script/tests consuming evaluation. Direct Git comparison confirms exactly three changed files; model config, auxiliary implementation/flag behavior, lock and both SQL packets are byte-equal to BASE. Lock remains `e0f9eb1ffc90023ebb1b4bf2f1b7f85902f751229d2d679733f64f7b75fc1ed4`; canonical724e and forwardd9604 are unchanged. No patient configuration, default model, prompt, clinical rule, dependency or SQL change.

## Findings and limits

**Critical: none. Important: none. Minor: none introduced by Task10.** No correction requested; existing M4 remains deferred outside this task.

Declined to judge: actual provider billing/usage or clinical quality (no paid calls or online measurements);12-hour writes/other processing tiers (explicitly unsupported); current tariffs/compatibility of every other candidate and root's broader Jev/Sonnet/Supabase research (outside this three-file task; dates retained); production/browser/build/SQL acceptance at this HEAD (not rerun and not claimed). The targeted gates are appropriate for this disconnected research calculator. Task9's all-seven acceptance remains tied to source04052b4 and its build, not relabeled as51b7690 acceptance.

Hosted status is external to this review: parent reports the latest canonical call ended in invalid_request_state again, with a fresh17:53:08UTC postcheck retaining40original history entries,2Auth/2profiles/5definitions/65items, missing new tables and no active packet queries. No hosted success is inferred. The repeated connector failure requires a usable official migration connection; this reviewer performed no retry or query.

## Assessment

**Task10 APPROVED for specification compliance and quality on51b7690.** Narrow tariff/date correction, meaningful RED/GREEN and offline evidence satisfy its brief. Full branch approval remains withheld for actual hosted canonical/forward application, Task7 acceptance/independent review and existing external release gates. The local/source blocks may be recorded complete while the overall hosted objective remains blocked.
