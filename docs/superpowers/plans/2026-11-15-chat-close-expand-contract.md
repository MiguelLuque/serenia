# Chat Closure Expand/Contract Implementation Plan

> **For agentic workers:** implement this plan task by task and preserve each verification result.

**Goal:** Keep session closure working while the app moves from the legacy closure RPC to the serialized chat-view RPC, then retire direct patient access only after the new app path is verified.

**Architecture:** The first migration expands the API by adding the view RPC while retaining the authenticated grant on `close_session_atomic`. A later contract migration revokes direct patient execution but keeps `service_role` access. The local SQL harness proves both intermediate and final ACL states; no hosted DDL is part of this change.

**Tech Stack:** Supabase PostgreSQL migrations, SQL regression fixtures, Python disposable-Postgres harness.

**Spec:** `docs/audits/2026-11-02-migration-history-reconciliation.md` and the fresh hosted RPC readbacks recorded in the active task history.

## Global Constraints

- Do not use ordinary remote `db push`, migration repair, or replay the diverged local lineage against hosted Supabase.
- The existing `main` build must retain its authenticated closure RPC throughout the expand phase.
- The new patient-facing `SECURITY DEFINER` RPC must validate `auth.uid()`, keep a fixed `search_path`, and grant `EXECUTE` only to `authenticated`.
- Revoke legacy patient execution only in the contract phase after the new app path has been deployed and runtime-verified.
- Keep hosted migration application and clinical acceptance as separate release gates.

## Review Focus

- The expand migration preserves the current authenticated grant on `close_session_atomic`.
- The new view RPC remains denied to `anon`, `service_role`, and `PUBLIC` while callable by `authenticated`.
- The contract phase revokes authenticated and public execution but preserves `service_role`.
- A failed stage assertion aborts before further migrations are applied.
- The hosted packet workflow can apply expansion and contraction at separate times.

## Tasks

- [ ] Add a SQL assertion fixture for the intermediate expand state and wire it to run immediately after the expansion migration; verify it fails against today's migration.
- [ ] Split the current migration into compatible expansion and a separately named contract migration; remove the unused conditional drop of an unobserved overload.
- [ ] Keep the final authorization regression asserting that patient roles cannot call `close_session_atomic` after contract while `service_role` can.
- [ ] Document the hosted order: reviewed expansion packet, app deployment and runtime verification, then separately reviewed contract packet. Do not apply either remotely here.
- [ ] Run `npm run db:test`, inspect the final diff, and report hosted application/runtime/clinical gates as pending.
