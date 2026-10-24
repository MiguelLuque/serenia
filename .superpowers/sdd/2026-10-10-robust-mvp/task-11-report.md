# Task11 — authoritative questionnaire facts (source checkpoint; acceptance pending)

BASE: `3f3f27a2e787d82e6947198dfc9eec8a06bb6c63`. Sole source owner; root controls hosted writes, fixtures, runtime handoff and independent review. This report does not claim new-source runtime acceptance.

## Cause and generation correction

Both `generateAssessmentStep` (the only production generation call path, through `generateAssessmentWorkflow`) and the still-exported legacy `generateAssessment` only placed scoring rows in a prompt, then persisted the model's `questionnaires` array. Neither treated failed/missing questionnaire reads as an unsuccessful report. Legacy generation has no current production caller, but remains exported and tested; both writers now share the same factual boundary.

`loadQuestionnaireFacts` scopes scored instances to session and owner, obtains canonical definition code/name and the persisted result, validates them and replaces only the model questionnaire list before persistence. Score, band and flags are copied, never recomputed. Other model narrative/risk fields, approved prompts/catalog, provider defaults and durable claim/persistence fencing stay under their existing contracts. The synthetic provider continues returning `questionnaires:[]` as an adversarial probe.

Order is instance ID ascending, retaining one entry per scored instance even when instrument codes repeat. This is deterministic, not a claim of chronological ordering. Successful empty instance reads yield `[]`; null/malformed reads, missing results/definitions, query errors and invalid flags fail closed. Active generation uses its existing retry/manual-review mechanism; legacy generation throws before model invocation or draft insertion. Item-level answer context remains in the active prompt and actual answer read errors also fail closed.

Primitive decode limits: instance/definition identifiers 1–128 chars, at most100 instances, code/band 1–64 chars, definition name 1–256 chars, finite score0–500 (50 supported numeric answers bounded0–10), at most50 flags. Canonical DB definition codes are retained rather than restricting historical instruments to today's active registry. Flag item order reuses `AnswerSchema` (integer1–50); reasons exactly match persisted `QuestionnaireFlag` (`suicidality`/`acute_risk`); unexpected keys/shapes fail closed. Existing chat flag parsing tolerates malformed values and is unsuitable here. These bounds are decoding safeguards, not clinical cutoffs or a recalculation.

Hosted HTTP acceptance source now asserts the generated report list equals the actual persisted PHQ9 result and canonical definition (and the controlled all-zero fixture has score0/minimal/no flags). The mode has not been replayed; old source27 evidence remains separately dated.

## Review immutability expansion

Root/same reviewer classified direct clinician RPC modification of `questionnaires` as Important and required within Task11. Wrapper-created `20261024145433_review_questionnaire_facts_immutable.sql` adds a JSONB `IS DISTINCT FROM` guard after locking the original assessment and before any idempotent-return or write path. Changed/omitted/added/reordered facts fail with SQLSTATE23514. Normal narrative/risk/task edits remain possible with identical facts. Genuinely identical legacy missing fields, JSON-null fields and empty arrays stay compatible, while missing versus JSON null remains distinct; SQL NULL payload cannot bypass validation. Historical reports are not rewritten.

Exact prepared copy: `supabase/hosted/review-facts-forward.sql`, manifest `.json`,8191bytes, SHA256 `86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504`, status `PREPARED_NOT_APPLIED`. Original bodyMD5 `119e629fd31c44c55476ca45d1d88282` / definitionMD5 `fa9bbdd61b38e492ca3c09151e3d92b6`; new bodyMD5 `7f83d3074a279a2740d1bf82a2977ebd`. Guards require the exact signature/sole overload, postgres owner, SECDEF, language/volatility/return type, config and ACL `{postgres=X/postgres,authenticated=X/postgres}`. Postcondition rechecks metadata/new body. Native harness compares all pg_proc metadata except changed prosrc before/after and asserts packet bytes/source/manifest mapping. CREATE OR REPLACE preserves the original ACL; there are no grant changes.

Native SQL RED exit1 reproduced an authorized clinician changing the score facts with existing historical migrations/seed passing. Native SQL GREEN exit0 verified9 fact mutations plus SQL-NULL payload denial, valid canonical narrative/risk edit, exact retry, task/history preservation, missing/JSON-null/empty compatibility, patient/parent denial and inherited-task failure rollback. Six forward drift cases (body/config/owner/ACL/security/signature) reject with the expected guard and restore the exact original metadata/definition on failed transaction. The final committed native gate will also cover the added exact packet/source/manifest assertion.

Existing canonical `6f0037fc…`, inbox forward `d9604…`, rejected archive and migration history are unchanged. Root alone owns later hosted application and a prepared direct-RPC negative probe; no new harness mode or acceptance write was added for that probe.

## Evidence so far

Private directory `.cache/task11/` retains full logs and numeric exit JSON. Initial focused RED exit1 reproduced14 failures across both writers: empty/invented model facts or multiplicity lost, read/decoder failures accepted as completed. First focused GREEN:37 tests/2files exit0. Expanded focused GREEN:43 tests/2files exit0. First typecheck exit2 exposed test-only Vitest `it.each` array-row spreading/typing; fixture cases changed to objects so the intended arrays are passed exactly, then focused43 and typecheck both exit0. Lint exit0 and hosted scenario syntax check exit0. The final corrected43-case suite was also replayed against the exact BASE writer files:20 expected failures, exit1; source files restored byte-exact in a finally block, then focused GREEN rerun. This removes ambiguity from the initial test-row typing correction. These are focused results, not final mandatory gates.

Read installed Next data-fetching guide and Workflow foundations (step IO/errors/retries), TDD/systematic-debugging/project-checks, project operations, pinned Supabase skills and official filter/single documentation. Supabase markdown changelog fetch was unsupported by the web reader; HTML changelog was read successfully. No SDK contract change is required. PostgreSQL17 CREATE OR REPLACE documentation confirms ownership/permissions remain unchanged; forthcoming forward tests must verify the actual metadata/ACL too.

## Committed native verification

Executable source: `f1ff5b788f1f217c21c0883923cacbf056e991f1`, tree `e97b6130b051ad72fb3354a770ca7c7997a7877a`. `rtk npm run verify` completed overall exit1. Exact private evidence: `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-jgKyNw/results.json`; command wrapper/full output `.cache/task11/native-verify{,-exit.json}` (full output file is `native-verify.log`).

| Gate | Exit | Actual evidence |
| --- | --- | --- |
| test |0|752 tests /64 files passed |
| lint |0|zero warnings required |
| typecheck |0|tsc --noEmit |
| workflow:wire |0|20 previous payloads /24 current roundtrips, zero failures |
| db:test |0|PG17.6 packet/source/manifest exact, six atomic drift guards, immutable facts/legacy compatibility, prior authorization/task/concurrency controls |
| audit:dependencies |1|production and full npm exits1;22 High package-graph entries from five distinct advisories |
| build:isolated |0|committed snapshot described below |

Generic isolated build: `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-MfoOLu/project`, BUILD_ID `tMoKmmzcxF9cgo5sF_B6F`, source f1ff5b7, Node24.14.1, lock SHA256 `e0f9eb1ffc90023ebb1b4bf2f1b7f85902f751229d2d679733f64f7b75fc1ed4`, actual result exit0. It uses placeholder public configuration and was never started; it cannot establish hosted login acceptance.

The strict audit is an unresolved gate, not a waiver or Task11 regression hidden by the earlier green source. Actual full/production JSON, npm exits and stderr are preserved in the verification directory. [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [body-parser GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), and Undici [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472), [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) match the observed vulnerable copies. These are five advisories propagated across22 graph entries, not22 vulnerabilities. Root authorized a separate bounded Task12 dependency wave; Task11 does not change package.json/lock or audit policy.

The attempted hosted-build invocation was rejected before process creation because automatic approval review hit a usage limit (review infrastructure failure, not an unsafe-action determination). No child, build directory or resumable handle was created by that attempt. Root then explicitly deferred the vulnerable f1ff hosted build to the patched Task12 source. Hosted build is NOT RUN for Task11; no hidden retry or bypass occurred.

## Runtime and remaining checkpoint

Original build `/private/tmp/serenia-hosted-build-Nd4nXo/project`, source `27f82d8e8d46257dff8517dbca5592e4a4681df9`, BUILD_ID `xhrWTx9JGknr6oTSmk6va`, artifact `c3d0ddb6e48185deda89f9d4ec66b730bae6316f7aa2a17d6401497d8a3a9136`, remains separate. No runtime start/stop, fixture write/clock edit, provider call or hosted DDL was performed for Task11. Root's earlier PID11147 observation is dated; current liveness is unverified and a missing historic unified handle does not establish termination. No Task11 write is in flight.

The source11 checkpoint is ready for root/same-reviewer inspection, not accepted complete. Pending: strict dependency repair/new gates and committed hosted build under Task12; independent Task11/forward review; exact fresh metadata/root-only forward application; reviewed runtime handoff; root-controlled directRPC negative attempts and actual scored-result → generated report → clinician review/patient UI proof. Preserve source27's dated evidence and fixture state; do not relabel it. All root-owned untracked records and the new Task12 plan edit are excluded from this documentation-only checkpoint. Original canonical6f0037fc/inboxd9604/archive and prepared8191B/86a461 forward stay unchanged.
