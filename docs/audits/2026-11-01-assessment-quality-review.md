# Task 2 independent review — AQ1–AQ4

2026-11-01. Reviewed base `1c71a0ad2cd07e5b71e20ef8c908c21af172b556` → implementation `3d83bb771835b28b0a292df52375d3b57f836616` using the supplied 16-file diff, task brief/report, authoritative quality-corrections spec, assessment fix design, relevant surrounding source and installed PostgREST SDK documentation. Read-only review of implementation; this report is the only write. No tests, suite, build, DB, network, credentials, index or branch operations were run.

## Verdict

**Spec compliance: PASS within AQ1–AQ4 scope. Code quality: ready for root integration. Critical: 0. Important: 0. Minor: 0.** No actionable defect found in the reviewed changes. This verdict does not approve publication, hosted behavior, real-provider behavior or clinical acceptance, and does not replace root's final seven gates.

## Compliance and strengths

- **AQ1:** `lib/server/patient-context/builder.ts:209–225` retains the ten bounded detail rows and adds independent one-row critical/high probes. All three queries filter owner and open status; both probes propagate errors. The latest open event of any severity remains in the descending details, while any critical and the latest high cannot disappear behind those ten details. The combined inputs preserve all three sufficient facts used by the unchanged risk branches; duplicate rows do not affect `some`/`every`. New SDK-transport fixtures cover a critical hidden by ten newer highs, a high hidden by ten newer moderates, global latest-open behavior with a prior crisis closure, foreign/resolved events, query bounds, and errors in either probe.
- **AQ2:** `lib/server/patient-context/render.ts:123–134` renders reviewed-source risk notes plus heteroaggression and substance fields, explains that `none` does not establish negation or evaluation, and labels note truncation explicitly. Notes are capped at 500 characters. The existing reserved-section budget path retains the complete risk section and instructions while reducing optional context/tasks; added regression cases exercise long notes and competing agreements within 2500 characters. The change introduces no clinical resolution or new risk policy.
- **AQ3 builder:** `builder.ts:162–196` selects owned, closed, non-null closure observations with an explicit FK join. Reviewed reports order the parent by `observed_session(closed_at)`, then session ID, review time and report ID. This matches the installed SDK's documented parent-order syntax; `referencedTable` would only order embedded rows. Draft selection corrects the same root cause with stable parent ordering and retains its lower priority than any valid reviewed historic report. `observedAt` drives age, tier and risk input; `reviewedAt` remains distinct provenance. Headers describe session material age and separately show review date. Historic agreement inclusion compares against observation, so a late signature cannot erase later agreements.
- **AQ3 inbox:** the new forward changes only the reviewed-report lateral selection and the first timestamp supplied to the pure risk routine. It joins the owned session, requires closure/closed/non-null inputs, orders observation/session/review/report deterministically, and passes `v.observed_at`. The legacy SQL argument name is explicitly documented; the pure routine is not recreated. No new 90-day inbox cutoff appears. The builder's existing 90-day exclusion and inbox's lack of that exclusion remain an explicit preexisting policy difference.
- **Forward contract:** `supabase/migrations/20261101104931_assessment_observed_chronology.sql` guards exact pre/post body and definition hashes, single overload, owner, language, return type, stable/definer status, search path and exact ACL. Its `CREATE OR REPLACE` preserves the existing signature/defaults and grants. The harness also compares the complete `pg_proc` record apart from `prosrc`, and checks atomic rejection of eight drift classes. The diff contains no edits to earlier migrations, the hosted profile packet, baseline or manifest. The new forward's independently read bytes are **7215**, SHA-256 **`5ef4d9fcef5191dbe0959689ecf1a32358a77d17c327801cc1e3aaf7f833499b`**, matching the report.
- **AQ4:** only reminder wording changes: PHQ-9 15–19 is moderately severe, PHQ-9 ≥20 and GAD-7 ≥15 remain severe. This matches `lib/shared/questionnaires/scoring.ts`; scoring and the existing strict >7-day / >14-day reminder conditions remain unchanged. Added cases check both PHQ boundaries and GAD's distinct band.
- The separately authorized `tests/profile/view.test.tsx` change awaits the button after an asynchronous transition. It changes only test synchronization and does not alter consent, profile product code or privileges.

## Findings

- **Critical (must fix):** none.
- **Important (should fix):** none.
- **Minor (nice to have):** none.

## Existing evidence checked

Saved logs corroborate the reported TS RED (13 failed / 86 passed), focused GREEN (177/177, eight files), native SQL RED (`CHRONOLOGY REGRESSION: late confirmation displaced later observed active session`), SQL GREEN including eight atomic drift rejections and the two observation/review chronology cases, and full GREEN **1113/1113 in 89 files**. Lint/typecheck logs show the intended commands without diagnostics; their exit-zero status is recorded in the implementation report. No checks were rerun by this reviewer. The full GREEN retains the reported `TimeoutNaNWarning`, so it is not described as warning-free.

Evidence inspected under `.cache/pablo-pilot/logs/`: `20261101-114640-osku0qd2.log`, `20261101-114857-6pycpfz0.log`, `20261101-114846-dyd2qy4h.log`, `20261101-115227-szkq7pzn.log`, `20261101-115336-qkpiy0aj.log`, `20261101-115347-twnfhl7l.log`, and `20261101-115347-omp9pxwm.log`.

## Declined to judge

- Actual PostgREST server execution and authorization: the real SDK test replaces transport and proves request encoding/fixture selection, not a running server. The PostgreSQL harness proves SQL selection with the project's auth shim, not GoTrue/JWT or hosted RLS.
- Atomic snapshot consistency across the three independent event reads: the approved design explicitly uses bounded probes; this change is not a transactional snapshot mechanism.
- Reconciliation of the preexisting builder/inbox 90-day policy difference, or fallback among multiple malformed reviewed summaries: the brief explicitly preserves these differences.
- The persistent local stack's 49-version state and three known predecessor gaps, forward catch-up, final seven gates, dependency/build acceptance, hosted forward apply, profile packet runtime acceptance, real model evaluation, clinical approval and publication: root owns these separately. Existing predecessor gaps are not treated as a new defect or a passed gate here.
- Packet integrity beyond the supplied change set: no previous migration or packet modification appears in this diff; this review does not replace root's exact-byte packet checks.

No implementation change or additional test rerun is requested by this review.
