# Task7 — exact hosted event tags correction, 23 October 2026

Resume BASE `175abeea6072425936a5c1f1ddca22f0fe18ab9e`. Sole implementation owner; no helpers/review dispatch, remote tools/DDL/Auth/rows, runtime switch, credentials or clinical changes. Root exclusively owns all hosted actions and poststate checks. This checkpoint is a prepared replacement, not a hosted application success.

## Cause and preserved rejected identity

Root's official atomic application of packet `724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae` (92,971bytes) reached PostgreSQL and returned SQLSTATE P0001 `Unexpected hosted event trigger definition/binding`. It was a SQL rejection, distinct from earlier expired connector requestState failures. `docs/operations/hosted-before-metadata.json` already recorded `ensure_rls` with `WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')`; migration and test fixture incorrectly assumed no event filter. Original function postgres/event_trigger/SECURITY DEFINER/search_path=pg_catalog/body MD5 `99be20677b456ea8d3be47bdd44fb369` is unchanged.

Immutable archive: `supabase/hosted/archive/724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae/serenia-atomic.sql`, `manifest.json`, `outcome.json`. Packet SHA/size exact above; original manifest bytes retained SHA256 `125c36195659add167cf569bed2feac7c9304e865572ad2ed0607dc4615254c0`. Its old PREPARED status is a historical snapshot; separate outcome explicitly records SQL_REJECTED_NOT_APPLIED/P0001. Generator verifies the fixed archival identity and points `supersedes` to it; old724e is never relabeled as the revised bytes.

Controller-reported postcheck19:17:17UTC: all40 normalized history fingerprints unchanged, five semantic catalog entries unchanged,2Auth/2profiles/5definitions/65items;17clinical tables sum0, new chat/job tables absent, active packet queries0. Source owner did not independently query remote data. Root's private `.cache/acceptance/hosted-reconnect-20261023.json` retains official evidence.

## Narrow change

`20261013073246_hosted_trigger_acl.sql` changes only the event tags predicate from IS NULL to `IS NOT DISTINCT FROM ARRAY['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[]`. Signature/owner/body hash/search_path/SECURITY DEFINER/enabled/event/function binding and all privileges remain enforced. Local absence branch stays valid. Test fixture adds the exact real WHEN TAG clause; no product event trigger is created on local installs.

Active packet `supabase/hosted/serenia-atomic.sql`: **93,052bytes**, SHA256 **6f0037fc74e115455e379795cdcb1c5318e4a9f65660d048f8ca5d7af30069b0**. Active `supabase/hosted/manifest.json` SHA256 `4e3582bdf910fedc9ad62deee31fe9cf82a148934bc43cc7faec9fe89b88f330`. Sixth section3,625bytes/SHA256 `565fa459d6ed2588ac601bdbcd079888aca9b2fb51e5a28ba29f2553f6f6a9b4`, offset88,010. All six source byte slices asserted against the generated packet. First five sources/offsets/hashes identical to rejected manifest; combined original-five SHA `b2379784c13c23ddc9ea22c2fcaa863ebc9a87efb29057b39cf50e57e9098086`. History40/catalog entries unchanged; preservation-before/after unchanged. Separate5,172byte forward remains `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`.

## RED/GREEN and exact commands

Private evidence directory `.cache/hosted-task7/tag-guard-20261023/`0700; full logs0600 and numeric *-exit.json files. No failure counted as success.

| Command | Result | Full private log |
|---|---|---|
| `rtk proxy python3 scripts/test-hosted-packet.py` on realistic fixture + unchanged724e | RED exit1, exact hosted binding error | packet-red.log |
| `rtk npm test -- tests/tooling/hosted-acceptance.test.ts` before provenance implementation | RED exit1, missing supersedes assertion (5pass/1fail) | provenance-red.log |
| `rtk proxy node scripts/hosted-packet.mjs` after narrow guard/generator change | exit0, revised SHA/bytes above | generated metadata/manifest; packet-identity.json |
| `rtk proxy python3 scripts/test-hosted-packet.py` after correction | GREEN exit0, native PostgreSQL17.6 network-none | packet-green.log |
| `rtk npm test -- tests/tooling/hosted-acceptance.test.ts` | GREEN exit0,6/6 | tooling-green.log |
| `rtk npm test` | exit0,717tests/63files,9.03s | suite-final.log (previous same717 suite-green.log also retained) |
| `rtk npm run lint` / `rtk npm run typecheck` | exits0/0 | lint-final.log / typecheck-final.log (initial0/0 logs retained) |

Native packet test first rehearses the entire revised packet successfully then rolls it back. Five separate transactional full-packet probes reject unfiltered/NULL, missing tag, extra tag, disabled event trigger and wrong function binding. Each asserts no new chat_turns DDL, original enabled/tag binding, earlier row-trigger EXECUTE ACL rollback and unchanged semantic catalog. Existing same-count catalog drift rejection before DDL, account/catalog mutation rollback twice, actual signup/recreated row trigger, administrative event-trigger RLS/effective ACLs across six roles, local absence and disabled Auth binding all remain GREEN. These are isolated synthetic PG tests, not hosted/JWT acceptance. Project suite prints expected simulated error logs (including missing test Supabase URL fire-and-forget branches); no failed test is omitted.

Pinned Supabase/Postgres skills at c9be0e931b7930f7d02126d04774d904c381e7d7 read and SHA verified against provenance; systematic-debugging/TDD used. Current [Supabase changelog](https://supabase.com/changelog), [monitoring/debugging redirect](https://supabase.com/docs/guides/observability), [official auto-enable example](https://supabase.com/docs/guides/database/postgres/row-level-security), and [PostgreSQL17 event trigger filter syntax](https://www.postgresql.org/docs/17/sql-createeventtrigger.html) consulted. Markdown web fetch unsupported; official HTML fallback used. No applicable SQL tag-breaking change identified. No Next code/API or dependency changes, so no unrelated Task1–10 gates/build/runtime proof replayed.

## Coordination checkpoint

New packet and forward remain **PREPARED_NOT_APPLIED**; source commit identity recorded in Git. Stop before remote checkpoint. Root must review exact revised packet, rehash and refresh intended target/history/catalog/counts immediately before any official call. Root retains all hosted mapping/preservation/advisors/types/realJWT/generated-runtime/browser/cleanup and production gates. No history replay/repair, reset, extra account read or connector retry by this owner.
