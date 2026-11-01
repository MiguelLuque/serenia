# Task 2 independent review

Review target: `159ce26..e1c6725dca92994e5de7d4fc24dbcb3df1f5619c`, checkout `/Users/miguelluque/git/serenia`. Reviewed the supplied 183,472-byte review package, Spec/Plan, brief, implementation report, relevant guards/generator/fixtures and existing focused verification logs. No database, remote service, suite, credential, account, source, index or branch mutation was performed. This review file is the only intentional write.

## Spec compliance

Compliant for Task 2's **prepared packet** scope. The eleven added paths match the supplied package; accepted migrations and historical packets are outside the delta. The generator pins the official baseline/query and new-object metadata identities, pins all four accepted migration SHA-256 values, and concatenates their bytes without rewriting them (`scripts/profile-hosted-packet.mjs:7-14,19-44`). Fixed target metadata, contracted source base `93fc4ef`, `PREPARED_NOT_APPLIED`, no historical replay and no invented remote version are retained (`:48-66`).

Independently measured packet: **81,456 bytes**, SHA-256 **`2133299d405d8ea5a04fdc88b4faeaee0cf78a5f4866050a211992a0c677882f`**. Exact source slices match the accepted files and contracted hashes at offsets/lengths **41055/23032**, **64278/4154**, **68634/3071**, **71904/2770**, in the required order. A read-only import of `makeProfilePacket()` returned `packetEquals:true` and `manifestEquals:true` against both committed artifacts. Source internals already accepted at e14 were checked for exact preservation, not subjected to a new product audit.

## Strengths

- Preconditions compare full 43-entry historical source fingerprints, semantic catalog hashes, seven-event/Auth-trigger/RLS-function metadata, table/routine identities and fingerprints, counts and all 17 empty clinical tables, rather than just totals (`profile-before.sql:29-45`; `profile-baseline-query.sql:1-32`). Old-object fingerprints include owner, RLS, ACL, source/config and structural metadata. The only generation-time query changes restrict postchecks to the authoritative original identity lists (`profile-hosted-packet.mjs:27-31`).
- Auth/history and all old public tables are locked with bounded waits before capture; four relations receive fresh nonce-salted, sorted row-hash aggregate equality checks. Nonce/rows/per-user hashes are neither selected into output nor placed in exception messages; temporary relation privileges are revoked and state drops on commit (`profile-before.sql:2-18,21-28,46-50`; `profile-after.sql:12-23`).
- Exact new-object metadata comparison covers all three tables, fourteen final routine definitions, owner/config/security/ACL, policies/defaults/indexes/triggers and message additions after all four source sections. Effective API/worker privileges, absence of PUBLIC grants/custom 40001, empty default data and public RLS are separately enforced (`profile-after.sql:24-54`; `profile-new-objects-query.sql:1-19`). Pre/post excluded-name collision checks prevent the authorized fingerprint exclusions from hiding same-name objects on other tables (`profile-before.sql:37-43`; `profile-after.sql:48-54`).
- The SQL fixture substitutes only the embedded expected baseline with measured synthetic metadata. Production guard queries and DDL stay intact; semantic catalog hashes, counts, old identities and expected new metadata remain unchanged (`scripts/test-profile-hosted-packet.py:63-80`). Rejected transactions verify the complete baseline snapshot afterward, including absence of profile objects (`:36-40`). Docker is installed-image-only, network-none, temporary and cleaned in `finally` (`:46-47,165-166`).

## Critical

None found in the reviewed Task 2 delta.

## Important

None found in the reviewed Task 2 delta.

## Minor

None requiring a change before the root-owned release gates.

## Checks

Performed read-only byte/hash/offset checks with `rtk proxy python3 -c ...`; all four exact-source slices and the packet SHA/length matched. Official baseline/query and new-object metadata measured hashes matched the pinned values. `rtk git rev-parse HEAD` returned the full reviewed SHA. The corrected read-only Node import check matched both generated artifacts; its first command had a reviewer one-liner parenthesis error before execution, with no file writes.

All **14 report-mentioned log files exist**. Inspected the final generator log `20261030-233313-hrq0pme_.log` (2 tests passed), final SQL log `20261030-233304-zhmvhqdq.log` (36 rejection/atomic-rollback probes, normal rollback rehearsal, local commit, signup/platform/ACL and disabled/no-autofill checks), and final lint log `20261030-233313-7qxcr08e.log` (expected ESLint command output, no diagnostics). These are existing implementer receipts, not reviewer reruns or independent execution-exit receipts. Also inspected the meaningful RED `20261030-233136-wjjtehdj.log`, which demonstrates the RPC-body gap before the exact metadata guard, and the corrected metadata-capture receipt `20261030-233103-rbqkdloi.log`. Final source now contains the corresponding guard and probe (`profile-after.sql:54`; `scripts/test-profile-hosted-packet.py:128`).

No suites or DB rehearsals were repeated. The fixture disclosure is accurate: one local event trigger/Auth shim and synthetic historical statements replace expected baseline metadata; this does not reproduce the seven hosted platform triggers or real Auth/JWT/PostgREST/Workflow. The delivered packet still retains the real official baseline, not the synthetic replacement.

## Assessment

**Accept Task 2 as a reviewed PREPARED_NOT_APPLIED packet; no actionable blocker found in scope.** Root must perform the seven release gates, fresh official target/history/platform/catalog preflight, reviewed hash comparison, single official atomic apply and exact postcheck/mapping of the real 44th historical entry/source. A local success does not establish any of those hosted outcomes. Unexpected hosted metadata must remain a rollback condition, not lead to relaxed guards.

## Declined to judge

Current hosted state or authorization, remote application/migration mapping, production build/deployment, real JWT/PostgREST/Workflow/browser behavior, Pablo's consent/onboarding, conversation semantics or clinical quality. The separately reported AI Gateway 403/free-model access credential problem is outside this SQL packet review and is neither resolved nor a SQL finding here.
