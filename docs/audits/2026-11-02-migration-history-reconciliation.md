# Serenia migration-history reconciliation review — 2026-11-02

**Scope:** read-only inspection of the repository and its recorded hosted baseline. No hosted query, migration repair, SQL Editor Run, secret access, or repository edit was performed. The hosted state below is the captured `profile-baseline-20261101.json`, not a fresh live result. Every proposed route remains **NOT_TESTED**.

## Observed version sets

The repo has 53 `supabase/migrations/*.sql` versions. The recorded hosted baseline has 43 `supabase_migrations.schema_migrations` versions. Their intersection is 36; **17 are local-only and 7 are hosted-only before the new Dashboard wrapper**. This is a pre-existing divergence. A successful profile Dashboard wrapper would add hosted version `20261102122007`, making 44 hosted rows and 8 hosted-only versions while the 17 local-only versions remain. The wrapper does not create the original divergence.

Supabase says its CLI compares timestamps from `supabase/migrations` against `supabase_migrations.schema_migrations`; it does not compare SQL content for migration-list alignment. This was checked in current official documentation, not by running the repository's pinned CLI against hosted. A matched version therefore does not prove identical SQL. The prior Serenia preflight found content differences even at matching versions `20260502000004` (wipe) and `20260502000005` (restore). Those existing hosted rows must remain untouched.

**Risk ranking:** high for returning to ordinary `db push` or branch workflows without reconciliation; medium for reconstructing replayable seed/drop and combined migrations because their SQL content or execution context differs; low for the wrapper's immediate SQL atomicity under the stated one-connection assumption, with hosted Editor execution still unverified. This is not a finding that the manual profile wrapper has already altered hosted state.

## Exact unmatched-version map

| Local-only source version(s) | Hosted-only version | Evidence and qualification |
| --- | --- | --- |
| `20260503000001` seed BDI2 | `20260503204403` | Same named purpose; **version and content differ**. Local SHA-256 `0e9b4a652da95ac2d50909ca75ea0f25b7af0e4d496c46d13e8a2ae501620578`. |
| `20260503000002` seed BAI | `20260516175534` | Same named purpose; **version and content differ**. Local SHA-256 `a98091b4f4dee2a07e8d713514d3c7b46d5c498d70364f3358d0639f62b3cc0c`. |
| `20260517000001` seed CSSRS | `20260517151619` | Same named purpose; **version and content differ**. Local SHA-256 `f1cec56c78bb593b7e09878ac3ee6060daf3b4a1a793be6c461fd6c386d28d26`. |
| `20260517000002` drop ASQ | `20260517153400` | Same named purpose; **version and content differ**. Local SHA-256 `f5cd32db145243de52abbcb31512ea9b43a434f01f4d8d4e432bcb253ba079a0`; local SQL includes a DELETE with cascade risk. |
| `20261010075359`, `20261010123627`, `20261010231957`, `20261012083833`, `20261012084307`, `20261013073246` | `20261024092459` canonical hosted packet | `application-20261024.json` maps these six ordered source migrations to one hosted version; stored combined packet SHA-256 `6f0037fc74e115455e379795cdcb1c5318e4a9f65660d048f8ca5d7af30069b0`. `manifest.json` records each source slice and hash. |
| `20261013213559` inbox | `20261024092547` | Application record maps the single source to hosted packet SHA-256 `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`. |
| `20261024145433` review facts | `20261024203657` | Application record maps the single source to hosted stored SQL SHA-256 `86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504`. |
| `20261028081958`, `20261028180058`, `20261028185351`, `20261030152754` | **Proposed** `20261102122007` profile Dashboard packet | Four ordered source slices in `profile-manifest.json`; packet SHA-256 `313b31b1c06bbe461313a81af9ff0f18fe0cd0a1882ee66ac8013c2ffc05e04a`. Hosted version does **not** yet exist according to prepared manifest and this review made no live check. |
| `20261101104931` chronology | **No hosted counterpart recorded** | Source SHA-256 `5ef4d9fcef5191dbe0959689ecf1a32358a77d17c327801cc1e3aaf7f833499b`. A future hosted version must be learned from its actual application/readback; do not invent one. |

The four May seed/drop pairings are conceptual mappings, **not byte equality**. The 2026-10-12 preflight compared local and hosted coarse content and marked all four `VERSION_AND_CONTENT_DIFFERENCE`. Two same-version May migrations also had content differences. This limits any simple rename, replay, or repair plan.

## Delivery ordering and atomicity

The proposed Dashboard wrapper is 165,992 bytes, SHA-256 `b7abdf8c18ea1a8ab94d8349d7e2d25a9780ff0f16ec1cebdb73be3aa024cec0`; the underlying packet is 81,693 bytes. It starts `BEGIN`, sets a local 50-second transaction timeout, checks a second exact packet copy, executes the packet, inserts one new history row carrying the packet, verifies the old 43 fingerprints and new row, then commits. On full execution on one PostgreSQL connection, an SQL error before commit aborts the DDL and registration together. The local synthetic test covers collision, post-insert error, success, and repeat rejection; hosted Editor behavior and stored-history replay remain unverified.

Any reconciliation that adds history rows **before** this wrapper would violate its exact 43-row preguard. Apply/profile readback, then any separately reviewed chronology forward/readback, **then** consider historical alignment. Do not interpret a lost Editor response as failure or repeat the wrapper without activity/history/schema readback.

## Alternatives — all untested

### A. Curated local migration lineage; no remote history mutation

After hosted delivery and fresh readback, prepare a reviewed deployment migration tree whose version set matches the hosted set. Preserve every original source file and its SHA outside the active `supabase/migrations` directory. For each hosted-only version, create a replayable local migration with an explicit source-to-hosted mapping and recorded hashes. The four seed/drop cases require exact remote SQL retrieval or a proven semantically equivalent reconstruction; they cannot be copied or renamed blindly. For the combined canonical/profile packets, the local migration must be replayable from a clean database without target-specific user counts, platform fingerprints, or 43-row guards. Do **not** claim it is byte-identical to the stored hosted packet. If chronology is delivered under a new hosted version, map it only after that version is observed. Keep the 36 matching-version files but audit the two known May content differences as part of schema/data equivalence.

Acceptance gates: isolated clean `db reset` with the curated tree, full local database tests, exact schema/routine/RLS/grant/trigger and catalog semantic comparison against fresh hosted readback, version-set comparison with no unexplained entries, and CLI dry run with zero historical SQL pending. This may enable normal future CLI migrations with new timestamps while leaving all original hosted rows unchanged. It requires repository workflow changes and testing; no such tree has been built.

### B. Add-only history repair after proving all effects

Keep the current 53 local migration files; mirror each hosted-only version locally as a documented marker or replayable file, and use `migration repair --status applied` for each local-only version **only after proving its exact effect exists hosted**. Supabase documents that repair changes the tracking table but executes no SQL. It would add 17 rows, leaving the original 43/44/45 rows untouched; after profile plus a separately registered chronology forward, a fully aligned set could have 62 versions (53 original locals plus 9 remote-only counterparts). This is audit-heavy: synthetic marker files and repair rows do not establish SQL equivalence and may undermine future replay. Do not mark chronology as applied until its forward is observed. Never use `--status reverted` on an original hosted row to force agreement.

### C. Keep the custom hosted-packet workflow

Continue to record reviewed packet-to-source mappings and exact hosted readbacks, without claiming normal `db push`, `migration fetch`, `db pull`, or Branching acceptance. This preserves the current history but leaves timestamp divergence for ordinary CLI workflows.

`db pull` or `migration fetch` alone cannot solve both sides of the difference. A fetched hosted packet can contain target-specific guards and may not replay into an empty database. A schema-only squash can omit DML including catalog seeds, so it needs separate data review. Dashboard-created Supabase branches use hosted migration history; GitHub-connected branches use repository migration files. Both branch routes require separate clean replay tests. In particular, the hosted profile packet expects the exact old history, three Auth users/profiles and hosted platform metadata, making replay into a fresh branch doubtful; this is an inference from the SQL and Supabase's branch model, **not an observed branch failure**.

The repository's `scripts/supabase-local.mjs` deliberately permits only local CLI commands. Any later remote CLI workflow needs a separately reviewed/authorized entrypoint; do not weaken that wrapper or reuse global credentials.

## Sources

- Repo: `supabase/hosted/profile-baseline-20261101.json`, `supabase/hosted/profile-dashboard-20261102.sql`, `supabase/hosted/profile-dashboard-20261102.json`, `supabase/hosted/profile-manifest.json`, `supabase/hosted/manifest.json`, `supabase/hosted/application-20261024.json`, `scripts/test-profile-dashboard-packet.py`, `scripts/supabase-local.mjs`.
- Repo: `docs/audits/2026-10-12-hosted-supabase-preflight.md` lines 87–110; `docs/audits/2026-11-02-profile-dashboard-delivery.md` lines 3–45; `docs/operations/supabase.md`.
- Supabase CLI migration list and repair: https://supabase.com/docs/reference/cli/supabase-migration-list ; https://supabase.com/docs/reference/cli/supabase-migration-repair
- Supabase deployment guidance on history alignment, repair, and its limits: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase Branching model: https://supabase.com/docs/guides/deployment/branching ; https://supabase.com/docs/guides/deployment/branching/dashboard
