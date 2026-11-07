# Whole-branch review — progressive patient profile

Reviewed 29 October 2026, read-only against `/Users/miguelluque/git/serenia`. Base `11ec2c2`; head `dbbf240586f4a52e19385c56d935dbdf583cf5cc`; last product code `896ff37170dfb9520d83fa2238aab12e02d4a819`. Binding documents: `docs/superpowers/specs/2026-10-28-progressive-profile-design.md` and `docs/superpowers/plans/2026-10-28-progressive-profile.md`. Used the supplied whole-branch package, its ten-commit list/stat/diff, and the requesting-code-review reviewer template. No new diff, test run, database operation, account/fixture work, dependency change, or network operation was performed. This report is the only written file.

## Strengths

- **Authority and provenance are enforced in the database.** Owner-only reads, narrowly granted RPCs, compound source/owner FKs, literal-quote validation and the message UPDATE guard keep model output from choosing ownership or rewriting its evidence. Source deletion removes its dependent observations while detaching, rather than deleting, an independently sourced correction (`supabase/migrations/20261028081958_progressive_profile.sql:28`, `:51`, `:54`, `:61`, `:78`, `:113`). The existing session/conversation FK and auth-user erasure path are compatible with these changes.
- **Concurrency has a coherent contract.** Settings is the shared mutex for claim/start/finish/review/disable; one active job per user, oldest-first selection, lease recovery, bounded attempts, epoch/token checks and transactional insertion prevent old workers from resurrecting withdrawn work. Completion replay does not reinsert observations. The SQL tests include real independent connections and observed lock barriers, not only sequential examples (`scripts/test-database.py:298`; the supplied migration and SQL regression sections).
- **Correction decisions preserve user intent.** Pending replacements dispute their confirmed target; confirmation resolves pending siblings atomically; rejecting an already-confirmed replacement does not restore superseded facts. The forward correction permits confirming a new source after rejecting its original while preserving that rejection (`supabase/migrations/20261028180058_profile_review_rejected_target.sql:36`).
- **Optional memory is separated from chat admission and clinical authority.** Dispatch is scheduled only after durable admission, including replay. Extraction runs inside one Workflow step with IDs/token as durable input and IDs/status/count as output. It uses the existing structured model, bounded input/output and a sanitized failure boundary. The chat loads owner-authenticated context, drops it on RPC/schema failure or budget overflow, and preserves the pre-existing safety and closure authorization checks (`app/api/chat/route.ts:69`, `:149`; `lib/server/workflows/extract-profile.ts:13`; `lib/server/profile/extractor.ts:44`).
- **The integration failures were investigated at the correct boundary.** The guarded forward migration changes deterministic conflicts in all three new RPCs to PT409 without changing API/ACL/locks. The action exposes a reloadable conflict; the client consumes its old alert on refresh. Actual PostgREST and browser evidence supplements the mocks that missed the original retry loop (`supabase/migrations/20261028185351_profile_nonretryable_conflicts.sql:5`; `app/app/perfil/actions.ts:50`; `components/profile/profile-memory.tsx:70`).
- **The acceptance account is appropriately qualified.** The synthetic provider proves transport, persistence and context selection, not attribution accuracy or clinical quality. The receipt distinguishes the incremental browser journey from the fresh final-artifact HTTP pass and retains earlier failures, historical migration gaps and the default-off boundary.

## Issues

### Critical (Must Fix)

None found in this review.

### Important (Should Fix)

**I1 / P2 — Older observations become impossible to review while still eligible for model use.**

- **Locations:** `supabase/migrations/20261028081958_progressive_profile.sql:175`; `app/app/perfil/page.tsx:25`; `components/profile/profile-memory.tsx:76`; `lib/server/workflows/extract-profile.ts:36`.
- **Concrete trigger:** Confirm one quote, then accumulate 100 newer observations that are pending, rejected or superseded. `get_profile_memory()` selects the latest 100 across *all* statuses, so the confirmed quote is absent. The page renders only that projection and supplies no older-page/history control. Independently, the worker selects the latest 20 **confirmed** observations across the full table, so the invisible quote remains in `knownTargets` and is sent to the extractor on subsequent messages. The same visibility limit also prevents reviewing older pending quotes.
- **User effect:** A person using “Lo que recuerda Serenia” cannot inspect or discard a retained quote still used by the feature. Reloading cannot reveal it. A supplemental correction-source lookup is insufficient: it only runs after a visible pending replacement points at the hidden quote and returns source text/date, not a reviewable observation. Global opt-out is a coarse escape, not a replacement for the promised per-quote control.
- **Requirement assessment:** The explicit 100-row projection is a valid bound for the initial view and chat context. It does not waive the reasonable expectation that remembered data remains reachable for review. This is an integrated product-contract gap left by the plan, not a reason to remove model/context limits or load all history at once.
- **Fix:** Provide bounded, authenticated, owner-only access to older reviewable observations, preferably stable keyset pagination with a visible older-items control and existing exact-version review actions. Keep the current chat and extraction budgets. An alternative must demonstrably prevent hidden observations from being used and preserve an understandable way to manage retained quotes; merely adding a “latest 100” label does not resolve the control gap.
- **Focused acceptance:** Cover more than 100 observations with an old confirmed quote plus newer non-confirmed rows; show that it remains reachable, can be discarded, and is absent from subsequent extraction targets. Also cover an old pending quote, tied source timestamps, other-owner exclusion and stale review after paging. Existing tests cover DTO maximum size and individual controls but do not exercise this history boundary. The finding follows directly from the three query/render contracts; no database mutation was needed to establish it.

### Minor (Nice to Have)

**M1 / P3 — Selecting the profile from the mobile sidebar leaves the drawer covering the destination.**

- **Locations:** `components/app/app-sidebar.tsx:72`; `components/ui/sidebar.tsx:184`.
- **Effect:** The navigation link changes the route without changing `openMobile`. The recorded browser journey observed the drawer remaining open until Escape. A person expects the selected page to become visible; instead an extra dismissal is needed. This is inherited shared navigation behavior, but the new profile entry exposes it too. There is no evidence of data loss or an inability to reach the profile, so it is not a merge blocker.
- **Fix:** Close the mobile drawer when a navigation item is selected, preserving desktop state and keyboard behavior; verify the profile route and the other shared navigation destinations. A broad navigation redesign is unnecessary.

### Previously deferred observations — retained disposition

- **Generated whitespace, P3:** `lib/shared/supabase/types.ts:422` contains the official generator's whitespace-only line. Exact CLI parity is more valuable here than hand-cleaning generated bytes. Retain the explicit exception until the pinned generator changes; no functional defect or new blocker.
- **Synthetic timer warning, P3:** `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-6RHL7z/test.log:135` contains `TimeoutNaNWarning`. It can obscure future diagnostic signal, but the supplied baseline history identifies it as pre-existing and the final suite passes. Track its origin separately; this review does not diagnose or claim to fix it.

## Verification assessed

Read the supplied diff in bounded sections, including source, migrations, harness changes and all changed tests. The acceptance document was used as an evidence index, then the following underlying records were inspected:

- `serenia-verify-6RHL7z/results.json`: all seven native gate exits are zero. The test log records 85 files/1,032 passing tests and the disclosed warning. The SQL log records profile source/grant/consent/cascade and independent-connection race checks, plus all three conflict routines' drift rejection and metadata-preservation checks. Wire evidence records 20 prior payloads and 24 roundtrips; audit reports zero advisories in production and full graphs at that run.
- `serenia-verify-6RHL7z/build-isolated.log` binds the ordinary isolated build to `896ff37`, the expected lock SHA and pinned versions. `20261029-222422-56z0qm3r.log` separately binds the local acceptance build to the same product commit. The later reviewed head adds documentation only.
- `20261029-222009-3r5ri6cy.log`: local DB lint, advisors and generated-type check, with no schema/advisor issues. It postdates the last database change; the later product edit only consumes a client alert and adds its regression.
- `20261029-221513-p5tp7iy3.log`: real stale-review, duplicate-start and fail-completed requests return HTTP409/PT409 in 6/3/4 ms. This supports the specific retry-loop fix, not a universal PostgREST reliability claim.
- `20261029-223011-o4mdrnw7.log` and the corresponding `http-final` implementation in `.cache/profile-acceptance/probe.mjs:145`: a fresh synthetic actor goes through generated Workflow extraction, pending review, confirmation, correction/dispute, updated context, replay deduplication, opt-out and re-enable without backfill. Four completed profile jobs, no closure job and an open session support independence from report generation.
- `20261029-223022-17eipjr6.log`, `20261029-222723-8nvuuayt.log` and the wire verifier at `.cache/profile-acceptance/probe.mjs:313`: the installed SDK hydrates actual job-bound run/step I/O and rejects non-ID/status strings and source-bearing keys. Four runs/steps for the fresh pass and six for the browser actor pass this check.
- `20261029-222724-3mpouc8z.log` and the progress ledger: seven browser-actor turns, six completed jobs, four source-bound observations deliberately discarded during the scenario, and context absent after disabling. Browser conflict/reload observations are recorded controller evidence; I did not independently rerun a browser. Their incremental e2ef15a → 67aa0af → 896ff37 provenance remains explicit.

The tests are meaningful for transactional state, authorization, fencing, failure containment and serialization. They do not make the I1 history/control scenario pass by implication, nor does their total count measure semantic quality.

### Focused inspection outside the package

- Inspected `supabase/migrations/20261010075359_robust_authorization_review.sql:45` to verify that the new compound source references rest on an existing session/conversation ownership constraint and authenticated clients cannot insert operational messages directly.
- Inspected readiness wrappers in `20261010231957_patient_flows_acceptance_private_reports.sql:8` to verify adult-patient activation, rather than trusting a UI-only check. Shared readiness admits clinicians; the new activation RPC independently requires patient readiness, so direct clinician navigation does not grant activation or foreign-owner access.
- Inspected `20261012083833_acceptance_strict_function_lint.sql:2` because source immutability could have broken erasure. The current erasure path deletes the auth user rather than rewriting message text, and the added FK cascades fit that path.
- Inspected the surrounding `app/api/chat/route.ts` safety/tool/finalization code to verify that adding profile context did not remove server authorization for closure, alter scoring, or replace persisted crisis gates. Semantic influence on generated prose remains a separate evaluation limit.
- Inspected `lib/shared/llm/models.ts` and `lib/server/supabase/server.ts` to verify existing model selection and authenticated/service client separation. Read the installed Next `after.md` to confirm the post-response scheduling contract. Inspected the mobile Sheet state only to assess M1.

## Recommendations

Resolve I1 in one focused change and review its new pagination/visibility contract and regressions. Preserve existing query/model budgets, owner RLS and review timestamp semantics. Keep the mobile behavior and generator/timer exceptions explicitly tracked. Update the final receipt after the scoped fix/review; the current receipt correctly says whole-branch review was pending at its commit.

## Declined to judge

Every considered behavior set aside from this branch's technical acceptance is listed here for the executor's explicit disposition:

- Real-provider attribution, third-party exclusion, negation, temporal meaning, inferred diagnoses, ambiguous agreements and correction matching — the provider is synthetic; the prepared Pablo corpus still requires real-model execution and human evaluation.
- Clinical efficacy, diagnostic accuracy, appropriateness of remembered facts, safety of generated prose and real-world prompt-injection resistance — structural/literal validation and unchanged authorization gates cannot establish those outcomes.
- Clinical/legal approval of consent wording, retention, care use or a public launch — this goal authorizes local fictional technical acceptance and keeps the feature off by default.
- Hosted migration acceptance, deployment compatibility, real-provider cost/latency, production availability and operational load limits — no remote apply/deployment or real-provider trial belongs to this review; local gates are not evidence for those environments.
- Reconstruction or repair of the three pre-existing local migration-history gaps — current lint/advisors/types and a clean SQL harness do not prove those historical versions were applied from their files; no history repair is authorized or necessary to establish this branch delta.
- Actual execution of the daily cron schedule and a latency SLA for extraction — cron authorization/batch logic is reviewed and tested, but the real schedule was not exercised; durable recovery does not promise immediate incorporation.
- The exact cause of the earlier delayed initial nudge — a later normal turn recovered it, but the association with the former conflict loop remains unproved. The report retains this uncertainty.
- Previously documented composer/retry, questionnaire, session-close and final-report UX redesign — those flows were not changed by this increment; I inspected their integration boundaries, not their entire inherited product experience. The newly exposed mobile-navigation behavior is judged above, not silently excluded.
- Exhaustive browser/accessibility combinations and production-scale performance — the supplied local browser journey and component tests do not establish every device, assistive technology or long-running load scenario. I1 is nevertheless judged from its deterministic reachable data state.
- Retraction of a provider request already begun before opt-out, or erasure of third-party/provider retention — the approved product explicitly does not promise undoing such a request. Database fencing, later context suppression and SQL deletion/cascade behavior were assessed; external retention policy was not.

## Assessment

**Ready to merge? With fixes.**

The branch has a strong technical foundation, credible final local acceptance and no Critical finding, but I1 leaves a reachable user-control gap in the feature as delivered. Resolve it and obtain a scoped re-review before marking this implementation complete; the flag must remain off by default. This verdict is technical only and does not authorize clinical use, public activation, hosted migration or deployment.
