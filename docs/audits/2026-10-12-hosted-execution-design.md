# Hosted execution design — Task 7 preparation

Prepared 2026-10-12 17:02 UTC. **Design only: no hosted DDL/DML/config writes, credentials retrieval, .env.local read, deployment or Git mutations.** Target is existing Serenia `brpozobkoatabctjjadc`, organization `jhmhzzaqbzvvppwtwfhz`, eu-west-1. Live get_project reconfirmed ACTIVE_HEALTHY and PostgreSQL17.6.1.104; get_organization reconfirmed Free. The human's hosted-testing authorization covers reversible integration on this target; it does not authorize fees, account deletion, reset, historical data replay, or public Next.js deployment. Main Next.js/Workflow stays on loopback with synthetic LLM providers.

Read [preflight](2026-10-12-hosted-supabase-preflight.md) first for the 40 hosted / 45 local inventory, six historical differences, exact aggregate counts, migration hashes and advisor findings. Its 2 Auth users / 2 profiles / 5 definitions / 65 items are preservation targets, not disposable fixtures. This document does not upgrade preflight into complete schema equivalence or production approval.

## Execution mechanism and immutable manifest

Recommended available mechanism: official MCP apply_migration, explicitly accepting server-generated hosted versions as canonical **for this target**. Its exposed input is only project_id/name/query. The official source forwards only name/query; a current upstream issue documents the timestamp mismatch. Do not assume a filename timestamp is honored by embedding it in name. [Official MCP implementation](https://github.com/supabase/mcp/blob/main/packages/mcp-server-supabase/src/tools/database-operation-tools.ts), [version support issue](https://github.com/supabase/mcp/issues/241).

Before execution, freeze the Task6 verified source commit and write a target-bound manifest with project/organization, that commit, all 40 existing hosted version/name/content fingerprints, the six accepted historical differences, and these five files in preflight order. All five SHA-256 hashes were rechecked on disk at preparation time and still match preflight. Do not copy historical SQL with personal literals into this artifact.

For each file record: local version, filename, exact SHA-256, ordered packet position, MCP name, pending/applied state, and after-success hosted version/name/joined-statement fingerprint. Apply exact reviewed file text sequentially, one call at a time. Immediately list history and verify exactly one corresponding new record and the intended catalog delta. Record the returned/discovered version; do not rename source migrations. If a call times out or its result is ambiguous, inspect history/schema before retrying; non-idempotent CREATE/RENAME packets cannot be blindly repeated. Stop on unexpected history/schema/ACL/preservation changes. A failed later packet leaves earlier committed migrations in place.

This preserves every historical hosted record, adds only reviewed forward work, and makes new version drift explicit. It does **not** make ordinary db push against the generic local migration directory safe. Future CLI deployment must consume a reviewed target artifact/manifest or a properly reconciled history representation; no post-hoc migration repair, hand-written schema_migrations INSERT/UPDATE, reset, include-all push, seed replay, or destructive squash.

Alternative if retaining the original five versions is required: a separately reviewed isolated CLI2.120.0 launcher and explicit target database credentials, with installed-command help and dry-run first. It must reconcile the existing 40 hosted timestamps in its target artifact without replaying historical bodies; show exactly the five intended pending files before applying. Generic db push currently sees historical mismatches and is blocked. The local-only wrapper intentionally disallows remote targets, so it must not be bypassed or relaxed implicitly. No such launcher or connection was created here. Prefer the MCP manifest unless original-version identity is a concrete requirement.

## Additional live metadata and minimal forward ACL packet

Read-only catalog queries inspected only necessary definitions, ACLs, constraints, trigger metadata, defaults, indexes and policy expressions. No existing user/profile/catalog row values or historical SQL were returned.

* handle_new_auth_user(): postgres-owned SECURITY DEFINER, return trigger, search_path=public. Body only inserts new.id into public.user_profiles with role patient/onboarding pending and returns NEW. on_auth_user_created is AFTER INSERT on auth.users, enabled; relation owner is supabase_auth_admin from preflight.
* rls_auto_enable(): postgres-owned SECURITY DEFINER, return event_trigger, search_path=pg_catalog. ensure_rls is enabled ddl_command_end, owned by postgres. Body handles public CREATE TABLE/CREATE TABLE AS/SELECT INTO, enables RLS and catches/logs failures. It is hosted-only; automatic RLS must still be verified rather than inferred from this trigger.
* Both ACLs are `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. Effective EXECUTE was true for anon, authenticated, service_role, postgres, supabase_admin and supabase_auth_admin. Revoking only explicit anon would leave inherited PUBLIC access.
* Live public defaults for postgres/supabase_admin explicitly grant broad table/sequence/function privileges to anon/authenticated/service_role. Preserve these defaults in this minimal packet; every new app object needs its explicit grants/revokes. A global default-privilege redesign is separate scope.
* Selected ownership/conversation/session FKs, existing checks/indexes and current owner/clinician policy baselines match the expected pre-October shape. Compound ownership FKs/new operational tables/October columns are absent. Existing owner ALL policies become SELECT policies in packet1 before packet5's guarded merges. This subset does not prove catalog or full-schema parity.

Create a new forward migration through the repository's `migration new` workflow; do not invent its timestamp or change either function body/owner/trigger. Proposed exact ACL delta after the five packets:

```sql
grant execute on function public.handle_new_auth_user()
  to postgres, supabase_admin, supabase_auth_admin;
revoke execute on function public.handle_new_auth_user()
  from public, anon, authenticated;

grant execute on function public.rls_auto_enable()
  to postgres, supabase_admin;
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
```

Keep the existing service_role grants unchanged. Preserve signup through explicit supabase_auth_admin and administrative DDL through postgres/supabase_admin; do not disable the event trigger or move platform objects. A generic migration must guard hosted-only rls_auto_enable absence on fresh local installs, while the hosted precondition must require its exact signature/owner/body hash and enabled ensure_rls binding. Fail on unexpected overloads/roles/definitions; do not dynamically grant to every role.

Before hosted application, test this delta on an isolated local fixture reproducing the live functions, trigger/event-trigger and roles: synthetic Auth insertion creates exactly one patient/pending profile; creating an ordinary public scratch table as administrative roles still enables RLS; anon/authenticated lose effective EXECUTE; service_role and intended administrative roles retain it. Existing Auth trigger creation/replacement requires EXECUTE, which is why Auth's explicit grant precedes PUBLIC revocation. [PostgreSQL trigger privileges](https://www.postgresql.org/docs/17/sql-createtrigger.html), [event-trigger behavior](https://www.postgresql.org/docs/17/event-trigger-definition.html). No real signup/admin DDL verification was run here.

## Auth/configuration and recoverability

The exposed official MCP tool inventory has no read Auth-config, read PostgREST-config or list-backups tool. get_project/get_organization omit those settings. Do not query private platform tables or retrieve global tokens to work around this. A later scoped Management API/UI read can obtain only Site URL, redirect allowlist, signup/email/anonymous-signin settings, JWT expiry, password policy, exposed schemas and backup metadata, filtering out provider/SMTP secrets before any output. Official read endpoints are GET /v1/projects/{ref}/config/auth and GET /v1/projects/{ref}/database/backups; the actual entitlement/available backups remain unverified.

Current docs provide daily-backup access for Pro/Team/Enterprise and recommend Free users maintain exports. Free is not evidence of usable backup/PITR; the earlier resume of a paused project is not a pre-migration restore point. Before DDL, establish an actual private recoverable backup of the baseline database (including auth and migration history), record encryption/location/hash/retention, and restore-test it into an isolated local environment without printing row values. Configuration and Storage objects need separate handling; a DB dump alone does not restore them. Export contains personal data and Auth secrets, so exact handling/retention belongs to the owner's execution scope; none was exported here. [Official backups](https://supabase.com/docs/guides/platform/backups), [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Before DDL, capture **aggregate salted SHA-256 fingerprints**, computed inside PostgreSQL, for complete auth.users and user_profiles row sets and questionnaire definitions/items, plus exact counts. Use a cryptographically random run nonce retained only in the private run directory; sort stable per-row hashes before the aggregate. Return only count/aggregate fingerprint, never IDs/emails/profile fields/password hashes or per-row hashes. After DDL compare with the same nonce. After fixture tests exclude only the run's newly generated user IDs before the same comparison. A matching count alone cannot detect a changed profile. Any mismatch is investigation/stop, never permission to overwrite accounts or restore rows automatically. This is a future verifier design, not a performed privacy/preservation check or backup substitute.

Leaked-password protection requires Pro or above, while this organization is confirmed Free. Keep its hosted advisor warning as an explicit external production gate. Do not enable a paid plan or claim the warning fixed by a free config change. [Official password security](https://supabase.com/docs/guides/auth/password-security).

## Local app against hosted DB/Auth

Filename-only discovery found .env.example and .env.local. Only .env.example key names were enumerated; .env.local was never opened. Allowed future connection names: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (legacy NEXT_PUBLIC_SUPABASE_ANON_KEY fallback), SUPABASE_SECRET_KEY (legacy SUPABASE_SERVICE_ROLE_KEY fallback), NEXT_PUBLIC_SITE_URL. Do not import LLM/provider/global tokens or copy the whole dotenv environment.

Current acceptance-local/start/run/scenarios explicitly require Supabase loopback port54321 and are unsuitable for this target without a separate reviewed hosted launcher. That launcher must assert the exact `https://brpozobkoatabctjjadc.supabase.co` API origin, local app origin127.0.0.1:3000, private0700 state/0600 logs, no symlinks, exact immutable build/source/lock identity and sanitized child environment. Build-time public URL/key and runtime public URL/key must refer to the same target; do not reuse a local-Supabase build. Keep WORKFLOW_TARGET_WORLD=local, isolated workflow storage, synthetic providers and telemetry disabled; no Vercel/public deployment. Secrets only enter server child memory/private run files, never NEXT_PUBLIC/logs/source/artifacts. Credential retrieval/reading the selected approved config is subsequent work, not done by this design worker.

Hosted fixtures must be a distinct adapted packet: cryptographically random per-run passwords; create only new synthetic actors through Auth admin; persist only those generated IDs in a private manifest; all privileged reads/writes and clinician role assignments must filter that manifest. The current scenarios' public constant password and global clinician inbox RPC cannot simply be reused. For the inbox contract, a test clinician can see the two pre-existing profiles: use an actor-filtered approved test path or verify the function via catalog/local evidence and leave unrestricted hosted inbox acceptance unverified. Do not fetch full inbox rows and redact afterward.

Cleanup/revocation must target only new run actors after Workflow completes/stops. Deleting any existing account is outside scope. Synthetic cleanup involving Auth deletion must be separately explicit in the execution packet; deletion does not invalidate already-issued JWTs, so sign out/revoke run sessions first. Preserve baseline hashes/counts and catalog after cleanup. No paid LLM calls or email to existing accounts.

## Owner execution gates and remaining dependencies

1. Task6 exact-commit mandatory app/dependency/DB checks and immutable local build/runtime/restart evidence. This design worker did not rerun them or modify app code.
2. Baseline recoverability and privacy-safe preservation verifier; selected configuration/credential handling; scoped Auth/redirect/exposed-schema metadata read. Do not presume Free backup entitlement or mutate Auth settings broadly.
3. Freeze the MCP canonical manifest, exact five-file packet and separately created/tested ACL forward migration. Confirm the queried schema baseline, zero clinical counts, source hashes and history immediately before execution. Use serialized migration execution while the application is stopped.
4. Post-packet history/catalog/ACL/RLS checks, strict lint/types where the approved toolchain supports the target, and hosted security/performance advisors. Report intentional authenticated definer contracts with ownership checks and Free password warning explicitly; unresolved mandatory warnings remain gates. Do not suppress advisors or drop unused indexes to manufacture a pass.
5. Target-bound hosted Auth/JWT/PostgREST owner/other-user/anon/clinician/consent tests with synthetic actors; then local Next.js browser/HTTP and generated Workflow restart against hosted DB. Preserve original accounts/catalog and record cleanup. Any missing dimension remains unverified.

Failure handling: stop app/tests on ambiguity or migration failure; retain private full failure evidence and the manifest's committed prefix. Prefer tested forward corrections with narrow grants/compatibility, not reverse access broadening. Full restoration is a separately authorized downtime/data-loss operation; no automatic remote reset/restore, history repair, account removal or catalog replay.

Pinned official Supabase/Postgres entrypoints and privilege reference were read at commit c9be0e931b7930f7d02126d04774d904c381e7d7. The preflight's cached changelog was reviewed for current grant and PostgreSQL breaking notices. No memory-derived fact is used.
