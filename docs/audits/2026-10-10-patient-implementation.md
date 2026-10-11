# Implementación y revisión — flujos de pacientes y profesionales

Implementación `10ab373`, fixes `2638e13` y `683e0e6`, base `9a9960f`. La revisión inicial exige I1/I2; la primera revisión scoped confirma ambos y exige NF1; la segunda revisión scoped aprueba NF1 y conserva I1. Bloque aprobado sin hallazgos Critical/Important abiertos. Esta evidencia SQL/DOM no sustituye Auth/JWT/PostgREST, navegador ni Workflow construido de Task6.

## Informe del implementador

# Task3 — patient and clinician flows

Status: implemented; local component, server and real PostgreSQL gates GREEN. Independent review belongs to the controller. Review base `9a9960f`; HEAD before this implementation commit `9a229fa` contains controller documentation. No controller plan/spec/audit files are included here. The report is retained locally under the existing ignored .superpowers workflow directory, matching the prior task reports; implementation files are committed. Final Auth/Data API and built-artifact browser acceptance belongs to **Task6** under the controller's updated task split (the brief's earlier Task4 reference is stale).

Implementation commit: `10ab373` — `feat: harden patient and clinician flows`. Post-commit `rtk git status --short` is clean and `rtk git diff HEAD --check` exits0.

## Requirements coverage

| Requirement | Implementation | Evidence |
|---|---|---|
| Civil adult boundary, future/minor/impossible dates | UTC civil date and ISO round-trip validation; shared server-action schema; exact DB adult cutoff | 13 schema tests; real SQL exact eighteenth birthday and next-day minor |
| Current acceptance for existing accounts; no fabricated editable status | Server-stamped technical-draft version and acceptance payload; authenticated atomic onboarding RPC; direct consent writes revoked; readiness checks current profile plus server-recorded version/DOB | Onboarding action tests; SQL denies fabricated status/consent and edited invalid DOB; middleware regressions; API gate before admission/model |
| Consistent session/chat gate | Middleware, start action, authenticated create-session RPC, chat route and service-only begin-turn RPC enforce readiness | SQL and API tests; existing Task1/Task2 suite retained |
| Recoverable chat with original ID/text and no duplicates | Owned unresolved projection adds persisted userMessageId; authenticated recovery action reads owned visible conversation; SDK retry maps DB message ID while transport preserves requestId | Real SDK+DOM retry, reload state, before-admission failure and exact text/ID tests |
| Closed/exhausted states and accessible urgent exit | Error boundary rehydrates closed state; retry exhausted state; abort current SDK request and allow a new UUID signal; regular signals still respect existing server fencing | DOM tests for external closure, exhausted attempts, actual pending request abort and new urgent ID |
| Compose while quiz or stream pending | Textarea remains editable while submit is unavailable; questionnaire result notice only sends immediately when no turn is unresolved | DOM compose tests; Task2 durable result semantics retained |
| CSSRS branches, fresh instance, semantic selection | Skip3/4/5 after item2=No; skip7 after item6=No; keyed internal instance; native labelled radios; failure preserves answers | Negative and all-positive branch DOM tests; replacement instance; failed-submit retry payload |
| Complete clinician risk schema | Heteroaggression and acute substance use displayed and edited without discarding the other fields | Real DOM view/editor and saved whole-assessment assertions |
| Old pending rows accessible with global priority and bounded work | Authenticated clinician SQL projection applies approved risk priority, actionable filter, then limit/offset; 100-row page+hasMore; visible previous/next links and pending/all filters | Old urgent outside105 recent sessions is first; no page overlap; pending filter before limit; permissions/limits; SQL snapshots |
| Authorized patient reports at DB boundary | Patient assessment SELECT policy removed; scoped <=50-session RPC emits only reviewed patient-facing summary plus explicit state; clinician/service context remains authorized | Real SQL foreign scope/anon denies, internal notes/full report privacy, clinician reads, rejected/superseded selection; patient DOM pages |
| Name fallback and read errors | Trimmed display_name then informal_name in patient pages and clinician loaders; query failures propagate | Reload/history/summary/error and clinician pagination/error DOM fixtures |
| Honest provisional legal/privacy copy | Public versioned technical drafts identify Supabase, Vercel AI Gateway and configured provider; no approved legal terms or instant human review promise | Source reviewed; home crisis regression updated to disallow invented review-today claim |
| Local test tooling | Exact jsdom29.1.1 dev dependency; .test.tsx included; only component files opt into jsdom; server tests remain node | Final full Vitest50files/581tests |

## Changes and integration contract

Acceptance version is `technical-draft-2026-10-11`, deliberately a non-binding technical acknowledgement for fictional local users. Version/time cannot be fabricated through direct patient consent writes. A historical consent has server_recorded=false; existing patients must complete the current acknowledgement. The DB verifies actual name/pronouns/reason/DOB and matching server acceptance, rather than trusting onboarding_status. DOB changes invalidate the accepted DOB until onboarding is completed again. Clinician roles remain administratively controlled by Task1. The UTC civil-date cutoff is shared with SQL; it does not use elapsed milliseconds as age.

The migration wraps existing atomic session and turn RPCs under a profile lock and revokes caller access to their renamed implementations. Service-role chat admission retains Task2 ownership, lease, token and urgent-signal behavior after readiness. The route checks readiness before any admission/model work. There is no new auth bypass or fixture route.

Recovery is a narrow authenticated server action plus owned SQL projection. It exposes the persisted user-message UUID to map retry back to an existing message, preserving the original request ID and text in the transport. Failed-before-admission text is retained locally and can retry the same ID; the UI says the text is preserved without claiming it was persisted. External closure removes retry and refreshes the closed UI. Exhausted/leased states remain explicit. Urgent exit aborts the browser wait and permits a fresh request ID; only the existing urgent-safety detector can replace the unresolved server turn. Ordinary input continues to receive the existing conflict response. Synthetic questionnaire completion waits for the next admissible turn when another turn remains outstanding.

The patient projection selects the latest non-superseded closure assessment centrally in SQL and returns a summary only for reviewed_confirmed/reviewed_modified with a string patient_facing_summary. Draft/manual, rejected and unavailable have explicit states. Patients cannot SELECT full assessment records/clinical_notes through the authenticated DB role. Clinician RLS and privileged server context remain. Both patient pages use this projection, never an internal assessment SELECT. Errors propagate rather than silently rendering an empty summary.

Inbox output is <=100 rows and hasMore. SQL globally ranks risk acute>active>watch>none, then pending (missing/draft/manual), then closed_at/id descending, before pagination. It preserves the existing risk state logic and strict21-day window. It aggregates counts and returns at most3 trend values per longitudinal code inside DB rather than fetching an entire backlog/history into JS. A clinician gets only the scoped projection after an authenticated clinician check. Page links preserve the selected view. Snapshot evidence covers session ordinal, previous-session days, open tasks and PHQ9/GAD7/BDI2/BAI arrays.

## Rulings and cost

- Controller ruled that global priority must precede pagination; sorting each page or collecting the backlog in a loop is unacceptable. Chose a SQL projection, with controlled duplication of the small TypeScript risk rule and report-validation schema. Shared fixtures execute against both implementations:12 risk vectors plus5 full-schema vectors. Cost: the SQL counterpart must be updated together with future risk/schema changes; DB global prioritization still scans candidates using indices and returns bounded snapshots. No histories/backlog are materialized in JS.
- Retained current risk cutoffs, model defaults, signed prompt and CSSRS temporal wording. Heteroaggression/substance fields use existing enums. No clinical category or threshold was invented.
- Preserved Task2 recovery scope; only persisted userMessageId was added. No raw turn-table access or service client is exposed to the browser.
- Native radio controls replace custom selection buttons for semantic selection. A keyed inner quiz instance resets selection/index/submission even if the caller does not remount it. Existing ASQ branching remains.
- Removed the dashboard's unverified “Tu psicólogo la está revisando hoy.” claim. The old source regression explicitly states that dashboard text is outside the signed continuity block; Task3 requires truthful availability. It now protects no guaranteed immediate review, immediate help wording and centralized Línea024.
- jsdom29.1.1 is the only dependency addition. Other dependency upgrades and Vite's existing tsconfig-paths warning remain Task4. The test output is successful but is not warning-free.

## TDD and failure evidence

All full logs below remain in `/private/tmp`; no failures were truncated or overwritten. Commands were executed with the rtk prefix from the repository. The commands in the table are the substantive test commands; log redirection names identify the complete evidence.

| RED command / log | Functional failure and why expected | GREEN evidence |
|---|---|---|
| `rtk proxy npm test -- tests/onboarding/schema.test.ts tests/chat/components.test.tsx` → serenia-task3-ui-red.log |7failed/9passed: minor/future/Feb30/month13 accepted; error input disabled; CSSRS lacked semantic radio/negative branches; new quiz inherited state | same selector → ui-green.log16passed; final components expanded to5 tests |
| `rtk proxy python3 scripts/test-database.py` → serenia-task3-sql-red.log | `FLOW REGRESSION: patient reads internal assessment`; DB policy allowed full patient SELECT | sql-final.log11PASS |
| `rtk proxy python3 scripts/test-database.py --baseline-flows` → serenia-task3-gate-red.log | `FLOW REGRESSION: accepted select create_session_atomic(...)` with fabricated onboarding_status and no current acceptance | sql-final.log11PASS; baseline flag deliberately skips Task3 migration |
| `rtk proxy npm test -- tests/app/patient-pages.test.tsx tests/clinician/inbox.test.ts` → pages-inbox-red.log |6failed/6passed: rejected/superseded leaked, informal name/authorized summary missing, read error swallowed, risk priority wrong | pages-green.log; final page/inbox tests GREEN |
| `rtk proxy npm test -- tests/chat/recovery-view.test.tsx tests/clinician/components.test.tsx` → recovery-risk-red.log |6failures: absent retry/closure/exhausted states, compose blocked, absent risk view/editor fields | recovery-risk-green.log; final suite includes6 recovery and2 clinician DOM tests |
| `rtk proxy npm test -- tests/clinician/inbox.test.ts` against the9a9960f inbox loader → old-urgent-red.log |2failed/6passed; older urgent row omitted by original100-row limit. Fixture enforces the original builder limit, not an import failure | replacement bounded RPC tests plus real clinician-inbox-page.sql old urgent regression GREEN |
| `rtk proxy npm test -- tests/chat/recovery-view.test.tsx` → recovery-edge-red.log |1failed/5passed: transport failure before admission offered no original-ID retry | recovery-edge-green.log and recovery-rehydrate-green.log6passed |
| `rtk proxy npm test -- tests/api/chat-gating.test.ts` with the new route guard temporarily removed → chat-gate-red.log | expected403, received200: regression proves admission/model would run without current readiness | focused-final-candidate.log contains covering test; guard restored |

The original inbox module and missing route guard were temporarily restored solely to obtain functional baseline RED evidence; both were immediately restored to the implementation. The old loader now delegates to SQL, so the obsolete mock-history enrichment assertions were replaced with real PostgreSQL snapshot coverage and strict bounded RPC contract tests.

Iteration failures retained: SQL fixture initially lacked reviewed_by; foreign-owned report scope exposed an ambiguous SQL alias and was fixed with requested(session_id); separate SQL connections lost pg_temp fixture helper and were consolidated; ambiguous DOM selectors were narrowed; the longitudinal snapshot test compared UUID output against raw unhyphenated md5 text and was corrected with a UUID cast. The last snapshot failure is retained in sql-snapshots.log and superseded only by the complete sql-final.log exit0.

Final first full suite: all-tests-final.log580passed/1failed, solely the obsolete review-today copy assertion. First lint and lint-iteration2 logs retain the React callbacks diagnostics. The installed AI SDK HttpChatTransport constructor only assigns the fetch callback (src/ui/http-chat-transport.ts140); it does not call it during render. A narrowly explained react-hooks/refs suppression covers that constructor, while request tracking runs inside a stable fetch callback. Error rehydration is scheduled at the asynchronous transport boundary with timer cleanup. No blanket lint disable was added. Covering corrections passed before the justified second full-suite execution.

## Final commands and results

- `rtk proxy python3 /Users/miguelluque/git/ai-workbench/project_checks.py inspect /Users/miguelluque/git/serenia` → exit0; project-checks-inspect.log identifies package test/lint/build entrypoints. Package's installed commands were used directly, preserving full private logs.
- `rtk proxy npm test -- tests/api/chat-gating.test.ts tests/clinician/risk-parity.test.ts tests/chat/recovery-view.test.tsx tests/chat/components.test.tsx tests/clinician/components.test.tsx tests/app/patient-pages.test.tsx tests/onboarding/schema.test.ts tests/onboarding/submit-profile.test.ts tests/clinician/inbox.test.ts` →9files/67testsPASS; `/private/tmp/serenia-task3-focused-final-candidate.log`.
- `rtk proxy npm test -- tests/chat/recovery-view.test.tsx tests/app/home-crisis-notice.test.ts tests/chat/components.test.tsx` →3files/15testsPASS after final corrections; `/private/tmp/serenia-task3-final-corrections-green.log`.
- `rtk proxy python3 scripts/test-database.py` (authorized Docker escalation) → exit0,11PASS blocks including migrations from empty auth.users, Task1/Task2 gates, current acceptance, report privacy, bounded/global inbox and snapshots; `/private/tmp/serenia-task3-sql-final.log`. Uses already installed postgres17.6-bookworm, no network/volumes, ephemeral tmpfs; fictional fixtures only. Both sets of shared parity fixtures run in this harness.
- `rtk proxy npm test` → exit0,50files/581testsPASS; `/private/tmp/serenia-task3-all-tests-final-green.log`. Full suite was run once initially, then repeated only after its actual failure and associated corrections.
- `rtk proxy node_modules/.bin/tsc --noEmit` → exit0; `/private/tmp/serenia-task3-types-final-green.log` (empty successful output).
- `rtk proxy node_modules/.bin/eslint <all41 touched .ts/.tsx files>` (argv generated from exact Git diff/untracked paths in `/private/tmp/serenia-task3-commit-paths.txt`) → exit0, no warnings/errors; `/private/tmp/serenia-task3-lint-final-green.log`.
- `rtk git diff --check` → exit0, no whitespace errors.

## Self-review

Read the changed acceptance, middleware/session/chat gates, recovery action/transport/view, private report loaders/pages, SQL migration/projections and tests. Confirmed renamed internal RPCs have no direct caller grants; patient report foreign ownership is checked per requested session; clinician/service assessment reads remain; no patient full-report read exists in the changed pages; global filter/order precedes limit; JavaScript receives bounded snapshots; recovery uses the persisted DB message ID for existing-message replacement, while transport retains request ID. Confirmed the new urgent UUID and preservation of typed draft across failed/aborted submissions in real SDK DOM tests. Improved copy that previously claimed a local fallback was necessarily persisted and updated stale questionnaire comments. Final tests and static checks reflect these corrections.

No production fixture route, auth bypass, remote data access, .env.local read, paid model call, deployment, push/merge, external message or global configuration change occurred. Only the exact pinned jsdom addition was installed. No new agents were dispatched.

## Explicit limits and remaining gates

- No real browser automation, build/start acceptance, GoTrue login/JWT, PostgREST/Data API request, hosted Supabase or production migration application was executed in Task3. The DOM tests render actual components/server-page output with synthetic DB/auth boundaries and use the real SDK with synthetic SSE/fetch; they do not prove a deployed browser flow. Real PostgreSQL tests use auth.uid() test shim, not JWT validation. Task6 owns the consolidated real Auth/Data API + built-artifact browser gate; Task4 owns dependency/Supabase integration.
- The application and new migration must be delivered together. Existing accounts will be redirected to current draft acknowledgement. This local evidence grants no approval to process real health data or launch.
- CSSRS documented branch logic is implemented without changing persisted temporal wording. Existing lifetime/recent3months wording versus the documented since-last-visit use on later sessions remains an external clinical agreement/licensing/validation gate. Signed prompts, temporal phrases and clinical cutoffs were not rewritten.
- Privacy/terms are technical drafts. Actual provider/model, region, contracts, retention, transfers, clinical availability and responsible contact remain deployment/legal/clinical gates; runtime env was deliberately not inspected.
- SQL risk/schema parity is controlled duplication, not automatic code generation. Fixtures cover approved cases and boundary values; future schema/rule changes must amend SQL plus shared parity vectors. Inbox pagination is offset-based; simultaneous review/risk updates may move rows between pages, and very large offsets/global aggregation can have database cost despite bounded response size. No page requires fetching the entire backlog into the application.
- Controller independent review is still pending this report; no claim of independent approval is made.

## Files changed

- `app/api/chat/route.ts`
- `app/app/actions.ts`
- `app/app/chat-recovery-actions.ts`
- `app/app/page.tsx`
- `app/app/sesion/[id]/page.tsx`
- `app/app/sesiones/page.tsx`
- `app/onboarding/actions.ts`
- `app/onboarding/page.tsx`
- `app/privacidad/page.tsx`
- `app/terminos/page.tsx`
- `components/auth/register-form.tsx`
- `components/chat/chat-input.tsx`
- `components/chat/chat-view.tsx`
- `components/chat/questionnaire-card.tsx`
- `components/clinician/assessment-editor.tsx`
- `components/clinician/assessment-view.tsx`
- `components/onboarding/profile-form.tsx`
- `lib/server/assessments/patient-reports.ts`
- `lib/server/clinician/inbox.ts`
- `lib/server/clinician/patient.ts`
- `lib/server/clinician/patients.ts`
- `lib/server/clinician/session-detail.ts`
- `lib/server/supabase/middleware.ts`
- `lib/shared/chat/recovery.ts`
- `lib/shared/clinician/display-name.ts`
- `lib/shared/onboarding/acceptance.ts`
- `lib/shared/onboarding/schema.ts`
- `lib/shared/supabase/types.ts`
- `package-lock.json`
- `package.json`
- `scripts/test-database.py`
- `supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql`
- `supabase/tests/clinician-inbox-page.sql`
- `supabase/tests/patient-flows.sql`
- `tests/api/chat-gating.test.ts`
- `tests/app/home-crisis-notice.test.ts`
- `tests/app/patient-pages.test.tsx`
- `tests/auth/refresh-redirect.test.ts`
- `tests/chat/components.test.tsx`
- `tests/chat/recovery-view.test.tsx`
- `tests/clinician/components.test.tsx`
- `tests/clinician/inbox.test.ts`
- `tests/clinician/risk-parity.test.ts`
- `tests/fixtures/assessment-risk-parity.json`
- `tests/fixtures/risk-parity.json`
- `tests/helpers/chat-harness.ts`
- `tests/onboarding/schema.test.ts`
- `tests/onboarding/submit-profile.test.ts`
- `vitest.config.ts`
- `.superpowers/sdd/2026-10-10-robust-mvp/task-3-report.md`


## Fix round1 — independent review I1/I2

Source/fix base: `10ab373`. Scope is only the two Important findings in task-3-review.md and the covering regressions. Controller docs/audits/2026-10-10-acceptance.md and progress.md were not edited/staged by this implementer. Original Task3 behavior, clinical cutoffs, signed prompts, model defaults and temporal wording remain unchanged.

### I1: stale asynchronous recovery

Added a monotonically increasing operation fence. Each recovery read, send, retry and urgent-exit transition advances it. A recovery applies transcript/recovery/closed/error state only if its operation remains current and the component is mounted in the same session. Session effect setup/cleanup advances the generation, invalidating prior session and unmounted reads. Local fallback is captured at the read start rather than taken from a newer send after the await. Send/retry completion likewise avoids clearing a newer operation's recovery. Successful retry retains the authoritative current snapshot instead of unconditionally clearing its recovery after an await.

The tests continue using the real AI SDK and actual owned recovery action with synthetic authenticated DB boundaries. The fake DB can defer a captured snapshot at the messages or session read; this is a deferred old response, not a mocked useChat. Added five DOM behaviors: finish a newer urgent response before releasing the old snapshot; finish retry before releasing it; reverse two manual-check completions; change session before old completion; unmount before an old closed snapshot calls router.refresh. Each asserts current transcript/state or lack of late navigation effects.

RED before implementation:

- `rtk proxy npm test -- tests/chat/recovery-view.test.tsx > /private/tmp/serenia-task3-fix1-recovery-red.log 2>&1` → exit1,4failed/7passed. The urgent/retry/manual/session cases lose the current transcript after the old snapshot is released. The first unmount assertion only tested an open snapshot and was tightened before implementation to capture a closed session.
- `rtk proxy npm test -- tests/chat/recovery-view.test.tsx -t 'unmounted recovery' > /private/tmp/serenia-task3-fix1-unmount-red.log 2>&1` → exit1,1failed/10skipped; unmounted old closed snapshot called router.refresh once.

GREEN: `rtk proxy npm test -- tests/chat/recovery-view.test.tsx > /private/tmp/serenia-task3-fix1-recovery-green.log 2>&1` → exit0,11/11PASS, including the tightened unmount case.

### I2: PostgreSQL infinite DOB

Both the input gate and stored-profile readiness now require isfinite(date). Added authenticated direct-RPC denies for positive and negative infinity. Added direct patient profile changes to both infinite dates, with matching pre-existing server-recorded acknowledgement fixtures inserted by the privileged test setup, so the readiness assertion cannot pass merely because DOB mismatches consent. Readiness must remain false and session admission must reject negative infinity. Existing exact eighteenth-birthday success and next-day-minor rejection remain in the same harness.

RED before implementation: `rtk proxy python3 scripts/test-database.py > /private/tmp/serenia-task3-fix1-sql-red.log 2>&1` (authorized local Docker escalation) → exit1, `FLOW REGRESSION: accepted select complete_patient_onboarding(...,'-infinity'::date,...,true)` under authenticated role. Complete log retained.

GREEN: same command redirected to `/private/tmp/serenia-task3-fix1-sql-green.log` → exit0, all11PASS blocks including non-finite input/stored DOB, exact birthday, privacy, global inbox, parity and existing Task1/Task2 transactional/concurrency gates. The pending local Task3 migration was amended; no remote/hosted migration was applied.

### Final fix verification and self-review

- `rtk proxy npm test -- tests/chat/recovery-view.test.tsx tests/chat/components.test.tsx tests/onboarding/schema.test.ts tests/onboarding/submit-profile.test.ts tests/api/chat-gating.test.ts` →5files/40testsPASS; `/private/tmp/serenia-task3-fix1-focused-final.log`.
- `rtk proxy node_modules/.bin/tsc --noEmit` → exit0; `/private/tmp/serenia-task3-fix1-types.log`.
- `rtk proxy node_modules/.bin/eslint components/chat/chat-view.tsx tests/chat/recovery-view.test.tsx` → exit0, no warnings/errors; `/private/tmp/serenia-task3-fix1-lint.log`.
- `rtk git diff --check` → exit0.

Read the full four-file fix diff. Checked every recovery apply/error branch and the closed router refresh behind the fence, retry's post-await handling, urgent invalidation, lifecycle cleanup, and both SQL predicates. No extra dependency or API surface was added. Full Vitest was not repeated in this round: its prior581PASS remains source-commit evidence, while the affected and adjacent paths were verified with40focused tests and the full SQL harness. Existing Vite warning remains. No build, browser, JWT/PostgREST or real provider claims are made; Task6 limits above still apply. Independent fix review remains the controller's next gate.

Fix files: components/chat/chat-view.tsx, tests/chat/recovery-view.test.tsx, supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql, supabase/tests/patient-flows.sql. This report append remains in the existing ignored local workflow directory.

Fixround1 commit: `2638e13` — `fix: fence recovery snapshots and reject infinite birth dates`. Post-commit status contains only the controller-owned acceptance/progress audit docs; all four fix files are committed.


## Fix round2 — scoped rereview NF1

Source/fix base: `2638e13`. Read task-3-fix-review.md and the temporary real-SDK reproducer. NF1 is confined to recovery checks during an already-running transport: fix1 used the same generation for reads and transitions, so a manual check cancelled a successful retry's post-success snapshot and left stale failed recovery blocking normal input. I1/I2 remain implemented.

Separated two monotonic counters: transition generation advances on send/retry/urgent/session/unmount and successful completion; recovery-read sequence orders only snapshots. Reads capture both. Applying snapshot/closed/error still requires current transition plus latest read and live session, while a later manual read cannot invalidate a valid send/retry completion. Successful completion advances transition generation to invalidate manual snapshots captured while transport was pending. Retry then obtains the latest authoritative snapshot. A valid closed snapshot also invalidates outstanding completion. Cost: one additional local counter, no API/schema/dependency changes.

Added the meaningful rereview case to tests/chat/recovery-view.test.tsx, using its actual SDK, owned recovery action and deferred synthetic DB response: finish an old failed manual check during retry, then complete the stream; assert Reintentar disappears and a second ordinary message uses a new request ID and clears its input. Added the inverse ordering (manual snapshot started during retry remains pending until after successful completion) and normal-send variant proving draft clears and a late snapshot cannot erase the current answer. Existing11 recovery cases still verify exact ID/no duplicate, urgent exit, external close, latest manual ordering, session change and unmount.

### TDD and exact verification

- RED: `rtk proxy npm test -- tests/chat/recovery-view.test.tsx > /private/tmp/serenia-task3-fix2-recovery-red.log 2>&1` against2638e13 before implementation → exit1,3failed/11passed. Two retry assertions found the stale Reintentar button after success; normal-send assertion found the draft still retained because manual read invalidated send completion. Full failure evidence retained.
- GREEN: `rtk proxy npm test -- tests/chat/recovery-view.test.tsx tests/chat/components.test.tsx > /private/tmp/serenia-task3-fix2-recovery-green.log 2>&1` → exit0,2files/19testsPASS (14 recovery +5 questionnaire/input).
- `rtk proxy node_modules/.bin/tsc --noEmit > /private/tmp/serenia-task3-fix2-types.log 2>&1` → exit0.
- `rtk proxy node_modules/.bin/eslint components/chat/chat-view.tsx tests/chat/recovery-view.test.tsx > /private/tmp/serenia-task3-fix2-lint.log 2>&1` → exit0, no lint diagnostics.
- `rtk git diff --check` → exit0.

Self-review read the full component/test fix diff: manual checks advance only read order; send/retry start and completion invalidate old snapshots; latest-read checks cover both success/error; lifecycle and urgent transition invalidation remain; authoritative retry snapshot is not unconditionally discarded. Tests exercise both possible manual/read versus stream completion orders. Changed only components/chat/chat-view.tsx and tests/chat/recovery-view.test.tsx plus this ignored local report append. Root-owned acceptance/progress and new patient-implementation audit document are untouched/unstaged.

No SQL changed or was rerun: fix1's full11PASS PostgreSQL evidence remains the non-finite DOB gate evidence. No full Vitest, build, real browser/Auth/JWT/PostgREST or paid/remote-provider run was added; the scoped19 tests and static checks verify this round. Existing Vite warning and Task6 acceptance limits remain unchanged. Scoped independent fix review follows under the controller.

Fixround2 commit: `683e0e6` — `fix: keep recovery reads from cancelling chat completion`. Post-commit status contains only the three controller-owned audit documents; both fix files committed.


## Revisión independiente inicial

### Spec Compliance

- ❌ Issues found: asynchronous recovery can restore an obsolete turn after a newer urgent/retry request, so the recovery/urgent-exit requirement is not robust under real latency (`components/chat/chat-view.tsx:125`). Direct onboarding RPC also accepts a non-finite birth date, contrary to coherent server/SQL invalid-date rejection (`supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql:37`).
- ✅ The scoped implementation otherwise covers authenticated current acceptance, private patient report projection, global inbox priority before pagination, complete risk editing, C-SSRS branches/reset/semantic controls, and provisional copy (`supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql:31`, `:81`, `:174`; `components/clinician/assessment-editor.tsx:354`; `components/chat/questionnaire-card.tsx:52`; `app/privacidad/page.tsx:5`).
- ⚠️ Real GoTrue/JWT/PostgREST, built-artifact browser and Workflow acceptance remain Task6; this review does not claim those gates ran. The existing Vite tsconfig-paths warning remains the explicitly assigned Task4 item, not a new Task3 blocker (`task-3-report.md`, Final commands and Explicit limits sections; `/private/tmp/serenia-task3-all-tests-final-green.log:6`).

### Strengths

- Patient pages consume a narrow, owned projection; SQL removes the own-assessment SELECT policy and returns only reviewed patient-facing text, retaining clinician access. Real SQL fixtures exercise rejected/superseded and cross-owner cases (`supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql:81`; `supabase/tests/patient-flows.sql:44`).
- Inbox filtering and global clinical priority precede the page limit; bounded application responses replace full JavaScript histories, with old-urgent and longitudinal snapshot coverage (`supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql:174`; `supabase/tests/clinician-inbox-page.sql:50`).
- The DOM tests use the real AI SDK transport and check original request/text identity, existing-message replacement, external closure and abort behavior, rather than mocking useChat (`tests/chat/recovery-view.test.tsx:23`).
- C-SSRS controls use native labelled radios and reset through an instance key; both positive and negative branches have behavior assertions (`components/chat/questionnaire-card.tsx:52`; `tests/chat/components.test.tsx:18`).

### Issues

#### Critical (Must Fix)

- None identified in this scoped review.

#### Important (Should Fix)

- **I1 — Fence recovery snapshots against newer sends.** `components/chat/chat-view.tsx:125` awaits `getOwnedChatState()` and unconditionally applies its recovery/messages at lines 134–135. Neither `send()` at line 171, `retry()` at line 158, nor the urgent exit at line 305 invalidates a recovery call already in flight. A recovery started after a failed ordinary turn can return late, after the patient interrupts and successfully submits a new urgent signal, restoring the old failed/generating turn and replacing the newer transcript. Concurrent manual state checks can produce the same ordering. The cancellation set only guards send completion; it does not guard rehydrate. Add a monotonically increasing operation/generation fence (including session/unmount invalidation), and apply a snapshot only if no newer send/retry/urgent transition has superseded it. Add a focused DOM regression with a deferred recovery promise: finish the newer urgent response first, release the older snapshot, and assert that the new messages and current recovery state remain intact.

- **I2 — Reject non-finite dates in both database gates.** `supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql:37` checks only null and the upper adult cutoff; `patient_onboarding_ready()` at line 11 uses the same upper cutoff. PostgreSQL accepts `'-infinity'::date`, so an authenticated direct `complete_patient_onboarding(..., '-infinity', ..., current_version, true)` call can persist this impossible birth date and a matching server-recorded acknowledgement. The form validator rejects it, but direct Data API calls bypass that validator. A focused PostgreSQL17.6 query confirmed all three conditions: readiness cutoff accepts it, onboarding's date rejection expression is false, and JSON consent DOB matches the stored date text. Add `isfinite(p_birth_date)` and `isfinite(p.birth_date)` checks (or an equivalent shared database constraint) and an authenticated SQL regression for non-finite input. Preserve the exact eighteenth-birthday behavior.

#### Minor (Nice to Have)

- No additional polish findings raised.

### Checks and Scope

- Read the supplied 9a9960f..10ab373 diff in bounded chunks; re-read only the output-truncated component subsection. Controller plan-split documentation was distinguished from implementation commit10ab373. No Git commands, suites, code/index/HEAD edits or subagents were used.
- Named outside-diff risk: revoking patient assessment SELECT could leave another permissive read policy. Checked assessment policy declarations in migrations; the remaining clinician SELECT policy uses `is_clinician()` (`supabase/migrations/20260423000001_rls_clinician_write.sql:46`).
- Named outside-diff risk: SQL risk/schema duplication could change approved clinical rules. Compared `lib/server/risk-rules.ts:7` and `lib/server/assessments/generator.ts:14` with the SQL counterpart and shared vectors; no substantive rule/schema mismatch identified.
- Named outside-diff risk: consent grant removal could break unchanged registration. Checked consent references in `app/(auth)/actions.ts:11`; registration consumes the checkbox and does not insert into consents there.
- Named outside-diff risk: retry replacement/abort semantics could differ from SDK assumptions. Checked the installed `node_modules/ai/src/ui/chat.ts:335`, `:385`, `:587`, `:734`; replacement and abort behavior match the intended calls. This does not fence independent recovery promises (I1).
- Named outside-diff risk: an existing date constraint might already reject non-finite values. Searched birth-date constraint declarations in migrations; none found. Ran only the unanswered date-predicate check in an ephemeral installed postgres:17.6-bookworm container with no network or volumes, then removed it. Result: `readiness_accepts_invalid_date=t`, `onboarding_rejects_invalid_date=f`, `consent_dob_matches=t`. This was a predicate check, not a complete Auth/Data API run.
- Read preserved final evidence: `/private/tmp/serenia-task3-sql-final.log` contains 11 PASS blocks; `/private/tmp/serenia-task3-all-tests-final-green.log` reports 50 files/581 tests passed and the known Vite warning. No suite was rerun.

### Assessment

**Task quality:** Needs fixes.

**Reasoning:** The privacy and clinician projection boundaries are well covered, and the implementation respects the task split. Recovery needs protection from stale asynchronous results, and the SQL adult gate must reject non-finite dates before this scoped task can be approved.


## Revisión scoped del fix round 1

### Finding Verdicts

- **I1 — Fence recovery snapshots against newer sends** — ADDRESSED. `components/chat/chat-view.tsx:91` introduces a monotonic operation generation; `:94–104` invalidates it on session lifecycle changes/unmount, `:142–158` gates snapshot, closed refresh and error application, `:184`/`:203` fence retry/send, and `:337` invalidates on urgent exit. Local fallback is captured before awaiting. `tests/chat/recovery-view.test.tsx:84–143` covers deferred old snapshots after urgent/retry success, reversed manual reads, session replacement and late unmounted closure. The specific original stale-before-newer-operation defect is removed; NF1 below concerns a read begun during an already-running retry.
- **I2 — Reject non-finite dates in both database gates** — ADDRESSED. `supabase/migrations/20261010231957_patient_flows_acceptance_private_reports.sql:11` requires `isfinite(p.birth_date)` for readiness; `:37` rejects non-finite onboarding input. `supabase/tests/patient-flows.sql:17–24` covers authenticated positive/negative infinity rejection and preserves exact eighteenth birthday/next-day-minor behavior; `:42–50` covers stored infinities with matching privileged acknowledgement fixtures and negative-infinity session denial.

### New Breakage in the Fix Diff

- **NF1 — Important: manual state checks invalidate successful retry completion** — `components/chat/chat-view.tsx:142` advances the same generation captured by retry at `:184`, and the new `:192` guard then skips its authoritative post-success rehydrate. Reproduce: start a retry with transport pending; click “Comprobar estado guardado” and finish that read while the server still reports the original failed turn; then complete the retry successfully. The successful assistant answer appears, but recovery remains failed/canRetry and “Reintentar el mismo mensaje” stays available. `ChatView` continues supplying submitted status to the input while recovery exists, blocking the next ordinary message until another manual check/reload. Before this fix, successful retry performed its post-success read even when a manual read happened in flight. Distinguish invalidation by a newer send/retry/urgent/lifecycle transition from invalidation by a read, or otherwise ensure successful completion obtains a newer authoritative snapshot without clearing a genuinely newer turn. Add the covering DOM regression. Focused real-SDK test failed 1/1 at `/private/tmp/serenia-task3-rereview/recovery-during-retry.test.tsx:35`; complete evidence is `/private/tmp/serenia-task3-rereview-focused-before-completion.log`.

### Out-of-Scope Observations

- None.

### Checks

- Read supplied `review-10ab373..2638e13.diff` once, appended fix report, original I1/I2 findings and task brief. No Git commands, checkout code/index/HEAD edits, remote/paid calls or child agents. Created only temporary reproduction artifacts under `/private/tmp` and this requested review report.
- Inspected preserved `/private/tmp/serenia-task3-fix1-focused-final.log`: named five covering files, 40/40 PASS; `/private/tmp/serenia-task3-fix1-sql-green.log`: all 11 PASS blocks. These runs do not cover NF1's check-during-retry ordering.
- Inspected `/private/tmp/serenia-task3-fix1-types.log` and `/private/tmp/serenia-task3-fix1-lint.log`: empty diagnostic output consistent with the report's exit0 claims; did not rerun static checks or suites. Existing Vite warning remains assigned to Task4.
- Ran only the unanswered race with installed Vitest and real AI SDK in a temporary DOM harness: first released an old check after retry success (1/1 FAIL, `/private/tmp/serenia-task3-rereview-focused.log`); then isolated the new completion-guard regression by finishing the check before retry success (1/1 FAIL, `/private/tmp/serenia-task3-rereview-focused-before-completion.log`). No broad suite repeated.
- Synthetic ephemeral PostgreSQL auth shim/DOM evidence does not prove real Auth/JWT/PostgREST/built-artifact browser acceptance; Task6 gate remains unchanged.

### Verdict

**Fix round:** Findings remain open — NF1. Original I1 and I2 are addressed; the fix introduced an Important retry-completion regression.


## Revisión scoped del fix round 2

- **NF1 — Manual state checks invalidate successful retry completion** — ADDRESSED. `components/chat/chat-view.tsx:91–92` separates transport/lifecycle transitions from recovery-read ordering; `:143–149` makes a read capture the transition without advancing it. A manual failed snapshot can therefore finish during retry without invalidating the completion guard at `:195`. Successful retry advances the transition at `:197` and obtains an authoritative snapshot at `:198`, invalidating snapshots captured while transport was pending. `tests/chat/recovery-view.test.tsx:146–164` covers the reported ordering, removal of the retry button, a subsequent ordinary send with a new request ID, and draft clearing; `:166–180` covers the inverse late-read ordering. The normal-send variant at `:182–198` verifies completion and draft clearing survive a pending read.

### New Breakage in the Fix Diff

- None. I1 remains addressed within the changed fencing code: snapshot/message/closed/error application requires the current transition, latest read and live session (`components/chat/chat-view.tsx:104–105`, `:149`, `:161`); session/unmount, send/retry start, urgent exit and successful completion invalidate older snapshots (`:95–101`, `:187`, `:208`, `:215`, `:342`). A valid closed snapshot also invalidates outstanding completion (`:152`). Read ordering remains independent and monotonic.

### Out-of-Scope Observations

- None. I2 SQL was untouched and was not re-reviewed. Existing Vite configuration warning remains assigned to Task4; real Supabase Auth/Data API and built-artifact browser acceptance remain the Task6 gate.

### Checks

- Read supplied `review-2638e13..683e0e6.diff` once, the appended Fix round2 report, task brief and prior scoped review. Inspected only changed component/test context for line evidence. No Git commands, code/index/HEAD edits, child agents, remote/.env/paid calls or repeated suites. Wrote only this requested review artifact.
- Inspected `/private/tmp/serenia-task3-fix2-recovery-red.log`: the three newly added cases fail for the reported stale retry button and retained normal-send draft; 3 failed/11 passed. Their ordering and assertions match the supplied fix diff.
- Inspected `/private/tmp/serenia-task3-fix2-recovery-green.log`: the covering `tests/chat/recovery-view.test.tsx` and adjacent `tests/chat/components.test.tsx` completed with 2 files/19 tests PASS. This includes the three added cases and preserves the existing 11 recovery cases. No additional focused test was necessary: the existing run answers the scoped races raised by the changed code.
- Inspected `/private/tmp/serenia-task3-fix2-types.log` and `/private/tmp/serenia-task3-fix2-lint.log`: both contain no diagnostics, consistent with the appended report's exit0 claims; did not independently rerun static checks. Reported diff-check success was not rerun.

### Verdict

**Fix round:** All findings addressed, no new Critical/Important breakage — NF1 addressed; I1 preserved. Scoped approval only; Task6 external acceptance remains pending.
