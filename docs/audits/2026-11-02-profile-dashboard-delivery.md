# Prepared Dashboard delivery for progressive profile

**Status: PREPARED_NOT_APPLIED.** This is a separately labelled, custom SQL Editor delivery. It does not change the reviewed MCP packet, its manifest, the four source migrations, any existing history row, or the local CLI policy. It is not a claim of Supabase CLI/MCP migration acceptance or hosted application success.

**Delivery hold:** independent review found pre-existing local/hosted migration-history and content divergence. The custom registration adds another hosted-only version and its later CLI/Branching replay is unverified. Do not run this artifact until a safe continuity and readback procedure has been reviewed and tested. See [migration history review](2026-11-02-migration-history-reconciliation.md). No history repair or renaming may be used to force agreement.

## Fixed artifact

- Destination: Supabase project `brpozobkoatabctjjadc`, database role `postgres` in its Dashboard SQL Editor.
- Original reviewed packet: `supabase/hosted/profile-atomic.sql`, 81,693 bytes, SHA-256 `313b31b1c06bbe461313a81af9ff0f18fe0cd0a1882ee66ac8013c2ffc05e04a`.
- Custom wrapper: `supabase/hosted/profile-dashboard-20261102.sql`, 165,992 bytes, SHA-256 `b7abdf8c18ea1a8ab94d8349d7e2d25a9780ff0f16ec1cebdb73be3aa024cec0`.
- Frozen new history version `20261102122007`, name `serenia_progressive_profile_review`. This is the wrapper's hosted registration version, not a rename of a source migration. It is later than every current local migration filename and every entry in the 43-row hosted baseline; the generator checks both.
- The matching `supabase/hosted/profile-dashboard-20261102.json` is the prepared manifest. Only after an observed hosted commit should a separate application record map this version to the packet and wrapper hashes.

The wrapper begins an explicit transaction, sets a 50-second PostgreSQL 17 transaction timeout, stores an exact second copy of the packet in a private temporary table, and checks its SHA-256 and byte length before DDL. The executable packet appears byte for byte at top level. Its existing pre/post guards first require exactly the reviewed 43-row history and preserve all old Auth/profile/catalog rows, old metadata, platform bindings, and empty clinical state. The wrapper then inserts **one** new row into `supabase_migrations.schema_migrations` with `statements = ARRAY[exact_packet]`, verifies the original 43 fingerprints and the new row's version/name/array cardinality/bytes/SHA-256, and commits. Any SQL error before `COMMIT` aborts the transaction; there is no `ON CONFLICT`, history rewrite, post hoc repair, or alternative target.

## Before any hosted Run

1. Log in through the Supabase Dashboard without copying tokens, passwords, or service keys into chat, shell arguments, or artifacts. Confirm the project ref and primary database in the UI.
2. Run a **rollback-only connection probe** in SQL Editor before loading the wrapper. Use a fresh harmless marker, for example:

   ```sql
   BEGIN;
   SET LOCAL transaction_timeout = '5s';
   SET LOCAL application_name = 'serenia_profile_dashboard_probe';
   DO $probe$ BEGIN
     IF current_setting('application_name') <> 'serenia_profile_dashboard_probe'
       THEN RAISE EXCEPTION 'Dashboard connection changed'; END IF;
   END $probe$;
   ROLLBACK;
   ```

   A successful request establishes same-transaction execution for this probe, not a permanent guarantee for later requests. A probe error leaves delivery pending.
3. Capture a fresh official read-only result of `supabase/hosted/profile-baseline-query.sql` and compare **every** JSON key with `profile-baseline-20261101.json`. Confirm 43 unchanged history entries, absent profile objects, three Auth users and profiles, five questionnaire definitions, 65 items, and zero clinical rows. Any drift stops delivery and requires review; do not update the expected baseline to force a match.
4. Review exact wrapper/manifest SHA and length from the file to be pasted. Ensure the complete wrapper is selected for one SQL Editor Run, with no current-statement selection or truncation. The 165,992-byte script is below the roughly 1 MB Studio request limit observed in source, but the actual UI request must still be checked. Retain normal Dashboard confirmation behavior. Do not use `skip_elicitations` or repeat the expired MCP request.

## Run and classification

Run the fixed wrapper once only. Its 50-second database transaction bound is below the [documented 60-second SQL Editor limit](https://supabase.com/docs/guides/database/postgres/timeouts); `SET LOCAL statement_timeout = '120s'` inside the unchanged packet cannot extend the 50-second transaction. [PostgreSQL 17 documents transaction timeout and failure behavior](https://www.postgresql.org/docs/17/runtime-config-client.html). The Dashboard client sends one SQL query field in the inspected Studio implementation, but Supabase does not document a no-retry or lost-response guarantee for this hosted UI. This is a custom path, outside the [recommended migration-file deployment workflow](https://supabase.com/docs/guides/deployment/database-migrations).

After a response, read back on a fresh official connection: the exact 44-row history with original 43 fingerprints unchanged; one new version/name with `cardinality(statements)=1`, `octet_length(statements[1])=81693` and SHA-256 `313b31b1...c05e04a`; exact new-object metadata from `profile-new-objects-query.sql`; preserved original catalog/counts/platform metadata and all profile tables empty. Use the full SHA from the manifest in the actual check. Record the observed version and wrapper hash only after this readback. Hosted advisors, types, RPC/Auth/browser acceptance and deployment are separate gates.

A prepared read-only query is `supabase/hosted/profile-dashboard-readback-20261102.sql`, generated and checked by `node scripts/profile-hosted-readback.mjs query`. Save its single JSON result privately and verify it with `node scripts/profile-hosted-readback.mjs verify <single-json-value-file>`. The verifier requires a reader able to see rows, checks role attributes, rejects public views/materialized/foreign relations absent from the baseline, and fails on incomplete receipts. The 43 historical MD5s fingerprint concatenated statement arrays, not individual bytes; role memberships, JWT/Data API enforcement and preservation of old rows before commit remain separate evidence. The changed query and verifier passed synthetic PostgreSQL 17.6 and negative tests; neither was executed against hosted. The delivery hold above remains in force.

The verifier pins both reviewed manifest hashes and exact input paths before reading referenced files; it rejects symlinked inputs and unexpected or coordinated manifest/baseline changes. Query generation uses the same input bytes whose hashes were checked, rather than reading them a second time. The symlink checks assume a trusted local checkout: checking and opening a file are separate operations and do not defend against a hostile local process racing those operations. A deliberate update to the prepared packet requires reviewing and updating the pins and tests, rather than silently accepting a new baseline.

If the UI response is missing or ambiguous, **do not retry**. Read history, schema and relevant backend activity on a new official connection. An absent new row while the earlier backend may still be active is inconclusive. After that backend is gone, a matching 44-row history and profile metadata establish commit; the unchanged 43-row baseline with absent profile objects establishes no commit. Any mixed or drifting state requires investigation before another write. The 43-row preguard makes a repeat after successful commit reject, but that is not a reason to send the script again.

## Local evidence and limits

`rtk proxy python3 scripts/test-profile-dashboard-packet.py` passed on installed `postgres:17.6-bookworm` with `--pull never`, `--network none`, tmpfs storage and synthetic users. It verified exact wrapper generation, rollback after a forced history insert collision, rollback after a post-insert failure, a 44-row commit with one exact packet in `statements`, original row/catalog preservation, exact new metadata, and repeat rejection. The existing 39 packet drift/rollback probes remain separate. Fixture platform/Auth implementations and historical SQL are synthetic; hosted SQL Editor execution, the Dashboard's server retry behavior, and future Supabase Branching replay of a single multi-statement `statements` element are **NOT_VERIFIED**.
