# Task 4 — stable event-trigger identity in prepared profile packet

Implemented against `e0046dd` in `/Users/miguelluque/git/serenia`. Status remains **PREPARED_NOT_APPLIED**, no remote version assigned. This agent made no remote call or DDL attempt, accessed no credentials/.env.local and changed no dependencies, source migrations, ACLs, platform settings, preservation guards or root documents. Root owns independent review, fresh official preflight and any official apply.

## Cause and narrow correction

Root supplied the official failed-attempt evidence: the original packet rolled back with `Profile platform baseline changed`; independent official postcheck retained 43 history entries/no profile objects. `evtfoid::regprocedure::text` rendered six `extensions` function identities differently when the packet set `search_path=public,pg_temp`. This was a context-dependent representation, not an observed platform mutation.

Copied **verbatim** the official candidate query `.cache/profile-release-20261030/profile-baseline-query-candidate.sql` to `supabase/hosted/profile-baseline-query.sql`, and candidate `.cache/profile-release-20261030/profile-baseline-candidate-20261101.json` to new `supabase/hosted/profile-baseline-20261101.json`. Root reports having verified the entire candidate baseline equal in default and exact packet contexts. The new expression uses schema, routine name and identity arguments from pg_proc/catalog with identifier quoting: `format('%I.%I(%s)',fn.nspname,fp.proname,pg_get_function_identity_arguments(fp.oid))`. No platform comparisons are omitted or relaxed.

Measured candidate/query equality byte-for-byte after copying. New baseline SHA-256: `a93732427101c87e737a2c48a1c553941c2f19c3c300e209434c084e49553dda`; query SHA-256: `0739e19c1a35629c3573c7671b5cc727ff7bf3d593e759f1922f039e7d3efd06`. Updated generator read path/pins/manifest to these identities. The only baseline changes are capture time (`2026-11-01T11:05:18.516Z`) and schema-qualified event function representations. Unit regression verifies all other keys, all non-event platform metadata and all other event fields unchanged.

The original `profile-baseline-20261030.json` is untouched and regression-pinned to SHA-256 `e9672c963f6c342d8166c57fa6c7fdce5a6ba0b6c3fe40c56859a44a50d085c6`. Original attempted packet is retained in Git history. Guard templates `profile-before.sql`/`profile-after.sql`, exact new-object query/metadata, four accepted migrations and every applied historical packet are untouched. `rtk git diff --exit-code --` those paths succeeded.

## Packet identity and exact source slices

Original prepared/rejected packet: **81456 bytes**, SHA-256 `2133299d405d8ea5a04fdc88b4faeaee0cf78a5f4866050a211992a0c677882f` (independently measured from `git show e0046dd:supabase/hosted/profile-atomic.sql`). Revised prepared packet: **81693 bytes**, SHA-256 **`313b31b1c06bbe461313a81af9ff0f18fe0cd0a1882ee66ac8013c2ffc05e04a`**. Manifest still fixes target/name/sourceBase93fc4ef/PG17/noHistoricalReplay and has no remoteVersion. Platform manifest hash now `38faa9b39c4732ab31bc3adc8c9e9f4db5ee122cf0d4692af1ebc77373b20e26`; old schema/routine/catalog/history fingerprints are preserved.

| Exact source | Original offset | Revised offset | Bytes | Unchanged SHA-256 |
|---|---:|---:|---:|---|
| 20261028081958_progressive_profile.sql | 41055 | 41292 | 23032 | 1d57bcd44f9f37de88a68b46a75e1271b86f36acacfde228178dbd3d27545205 |
| 20261028180058_profile_review_rejected_target.sql | 64278 | 64515 | 4154 | 01a00ea14358c9d70b99a74bd0569660d9689ca157aaa1dbb37c35fde3687a06 |
| 20261028185351_profile_nonretryable_conflicts.sql | 68634 | 68871 | 3071 | 9fbff95d4afaa1c4076fca09674a0c601db86af9b69b4ff3e35a7acfdf342827 |
| 20261030152754_profile_memory_history_page.sql | 71904 | 72141 | 2770 | c9cc722dd713d6ee209f65b77b3ef912e2ae732443c8bdad424b2fa7c9293c6d |

## Regression and fixture boundary

The PG17 fixture now creates six test-only no-op event functions in `extensions` with the official seven event binding identities/owners/tags/enabled flags (including existing public ensure_rls). These stubs are **not** extension implementations and are never part of production packet DDL. It explicitly verifies all seven event binding metadata equal the official baseline, independently of the broader synthetic expected metadata substitution.

Legacy `regprocedure::text` comparison changes exactly six names between `public,extensions` and `public,pg_temp`. The complete revised snapshot is invariant between those contexts. The whole unchanged-guard/exact-source packet runs with both explicitly selected starting contexts, rolls back normally, and later commits locally. The original 36 rejection/rollback probes are preserved; three additional probes reject an extension event's wrong binding, same-named function in another namespace and disabled event while preserving all counts. Every failure compares the complete baseline after automatic rollback; no profile-DDL prefix or probe mutation persists. Normal local commit/signup/platform RLS/known ACLs/disabled-default/no-settings-autofill checks still pass.

The bootstrap now selects only pre-October sources plus the needed pre-profile October hardening. Its former “skip only filenames starting 202610” loop accidentally tried to apply newly added forward migration20261101104931 before its prerequisites; that migration is not part of the official 43-row profile baseline, and is correctly excluded from this fixture. No production migration was rewritten.

All prior nonce-salted Auth/profile/catalog preservation, locks/timeouts, history/catalog/source fingerprints, RLS/new metadata/ACL checks remain intact. As before, expected historical metadata/Auth shim/routine source differences are substituted once with measured synthetic fixture metadata; actual catalog semantic hashes/counts/old identity lists and exact new metadata are not substituted. No real Auth/clinical rows, secrets or nonce hashes are read or emitted. Docker uses installed `postgres:17.6-bookworm`, `--pull never`, `--network none`, tmpfs and finally removal.

## Commands, failures and complete local logs

Full logs reside in `.cache/pablo-pilot/logs/`; all shell commands prefixed `rtk` and tests use existing project_checks.py runner. Docker and the final full suite required reviewed sandbox escalation only for the local Docker socket/loopback listeners.

- Generator command: `rtk proxy python3 .cache/pablo-pilot/project_checks.py run /Users/miguelluque/git/serenia -- rtk npm test -- tests/tooling/profile-hosted-packet.test.ts`.
  - RED **`20261101-120729-nynp78f7.log`**: expected new baseline path, received old30 path (one expected failure).
  - GREEN **`20261101-120815-gcpncqy5.log`**: 3/3 tests, deterministic packet/artifact equality, pinned exact source slices/tamper rejection, immutable old baseline and permitted-only baseline changes, no CLI target overrides.
- SQL command: `rtk proxy python3 .cache/pablo-pilot/project_checks.py run /Users/miguelluque/git/serenia -- rtk proxy python3 scripts/test-profile-hosted-packet.py`.
  - Setup failure **`20261101-120728-60r2d4r9.log`**: `Unexpected assessment chronology baseline`, caused by the new November migration being included by stale fixture loop. Corrected fixture selection as explained above.
  - Correct context RED **`20261101-120743-5hdeadse.log`**: legacy six binding differences reproduced, then full snapshot context-invariance assertion failed with the old production query.
  - Initial GREEN **`20261101-120813-kengwr81.log`**, then **`20261101-120925-8owll7zj.log`** after same-name/other-namespace probe.
  - Final **GREEN `20261101-121004-wydx2dts.log`** (19.7s): both explicit contexts, seven exact event bindings, **39 rejection/atomic rollback probes**, normal rollback/local commit and signup/RLS/ACL/no-autofill checks.
- Regeneration: `rtk proxy node scripts/profile-hosted-packet.mjs` — exact revised hash/bytes above, no parameters or target override.
- Full lint: `rtk proxy python3 .cache/pablo-pilot/project_checks.py run /Users/miguelluque/git/serenia -- rtk npm run lint` — **GREEN `20261101-120826-035zgake.log`**, `eslint --max-warnings=0`.
- Types: same runner `-- rtk npm run typecheck` — **GREEN `20261101-120826-ahu2b4ol.log`**, `tsc --noEmit`.
- Full suite: same runner `-- rtk npm test`.
  - Sandbox **`20261101-120826-9y0rngx9.log`**: 1110 passed, 4 failed due only `listen EPERM 127.0.0.1` in dependency-integration's “survives trailing bytes…”, provider-utils excessive encodings, world-local excessive encodings, mixed-case SRI cases. Full failure log read before repeating with loopback permissions.
  - Escalated **GREEN `20261101-120922-xd18anbf.log`**: **1114/1114 tests, 89/89 files**. Existing `TimeoutNaNWarning` is present; no task change or suppression made for it.
- Read-only identity/self-review: candidate copies matched byte-for-byte; original packet hash measured from Git; no diff on guards/new metadata/old baseline/migrations. All root uncommitted documents remain outside Task4 staging.

## Limits and release state

This proves context-invariant catalog representation and fail-closed packet behavior in the disclosed local fixture. It does not independently prove current hosted state or actual extension implementations, JWT/PostgREST/Workflow, browser/clinical acceptance, a successful official apply or remote migration mapping. Root alone supplies official provenance/preflight/apply/postcheck. No new fetch or remote verification claimed by this agent.

Known dependency audit remains **BLOCKED: production22/full37**, carried from root's accepted evidence, not rerun here. No package/lockfile or audit gate was touched. No isolated build with root's uncommitted docs, deployment, merge, waiver or audit retry performed. Those plan/release gates remain root-owned.

Self-review found no additional Task4 blocker. Assigned delta is only generator/harness/query/new baseline/prepared packet/manifest/test. Commit **`d4547977c4af981ebf71d6de5fceb8a63b54d304`** (`fix(db): stabilize prepared profile event trigger identities`) contains exactly those seven paths; `git diff --cached --check` passed before commit. Root's uncommitted documents remain unstaged and unchanged by this agent; report stays local ignored as requested.
