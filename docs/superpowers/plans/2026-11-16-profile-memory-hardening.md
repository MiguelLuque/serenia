# Progressive Profile Safety Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent safety turns from entering deferred profile extraction and prevent workers from calling the profile model after consent was revoked before final authorization.

**Architecture:** Persist a fail-closed eligibility bit on each message and enqueue its extraction job atomically inside the server-only chat admission RPC. Add a separate service-only preflight RPC immediately before model invocation; preserve current token/epoch fencing for result persistence.

**Tech Stack:** Next.js Route Handler, TypeScript, Supabase/Postgres migrations, Vitest, isolated SQL migration tests.

**Spec:** `docs/audits/2026-11-16-profile-memory-hardening-decision.md`.

## Global Constraints

- Do not enable progressive-profile or cross-session flags.
- Do not read local secrets or access hosted Supabase/Vercel state.
- Preserve owner/RLS boundaries, service-only worker RPCs, bounded retries, and sanitized workflow errors.
- Use the repository Supabase wrapper and pinned CLI; migration tests use the isolated `db:test` harness.
- Keep uncommitted user-owned documentation changes untouched; do not deploy, push, merge, or apply hosted migrations.

## Review Focus

1. Ordinary opted-in messages still create exactly one durable job in the same admission transaction.
2. Direct risk messages cannot create jobs even if the server boolean is accidentally true.
3. Ambiguous messages and all safety clarification answers are passed as ineligible and never reappear through cron or the next ordinary dispatch.
4. Consent withdrawal while source or target queries are pending prevents the model call; withdrawal after preflight still blocks persistence.
5. Legacy jobs without provable eligibility are canceled with token rotation while observations and chat history remain intact.

### Task 1: Persist source eligibility and exclude safety turns

**Files:**
- Modify: `supabase/migrations/20261116195737_profile_memory_safety_and_revocation_hardening.sql`, `app/api/chat/route.ts`, `lib/shared/supabase/types.ts`.
- Test: `tests/api/chat-safety-routing.test.ts`, `tests/profile/integration.test.ts`, `supabase/tests/progressive-profile.sql`.

**Interfaces:**
- `begin_chat_turn` gains optional server-only `p_profile_memory_eligible boolean default false`.
- `messages.profile_memory_eligible` is `NOT NULL DEFAULT false`.
- The admission RPC marks a source eligible and creates its job atomically only for an eligible ordinary turn with current consent. Direct signals and any safety answer are forced ineligible in SQL; TypeScript passes false for the complete `isSafetyTurn` set.

- [x] Add the route regression: ordinary turn passes true; direct, ambiguous, and negative/affirmative/unclear/skip safety answers pass false. The earlier focused run observed the missing-argument RED.
- [x] Add SQL regression coverage: ordinary opted-in admission creates one job; direct admission with the boolean true, ambiguous admission with false, and default false create none. The pre-migration RED could not run until Docker access became available; the complete migrated replay later passed.
- [x] In the CLI-generated migration, add the fail-closed column, update source immutability and enqueue validation, rotate/cancel legacy nonterminal jobs, and replace only the public wrapper without leaving overloads.
- [x] Update `app/api/chat/route.ts` and database type definitions to send/use the server-computed eligibility value.
- [x] Run the focused route and SQL regressions; all safety cases create no durable job and ordinary eligible admission creates exactly one.

### Task 2: Revalidate consent immediately before provider call

**Files:**
- Modify: `supabase/migrations/20261116195737_profile_memory_safety_and_revocation_hardening.sql`, `lib/server/workflows/extract-profile.ts`, `lib/shared/supabase/types.ts`, `components/profile/profile-memory.tsx`.
- Test: `tests/profile/workflow.test.ts`, `supabase/tests/progressive-profile.sql`, `tests/profile/view.test.tsx`.

**Interfaces:**
- Add service-only `authorize_profile_model_call(uuid, uuid) -> boolean`; it reuses the fenced job lock and requires `status='running'`, active consent, matching epoch/token, live lease, and an eligible source.
- `extractProfileStep` calls it after loading/validating the source, targets, and policy, immediately before `extractProfileObservations`.

- [x] Add the worker regression for final authorization denial after source/target reads; prove `extractProfileObservations` is never called. The earlier run observed the missing-preflight RED.
- [x] Add SQL regression that starts a job, revokes consent, rejects final authorization and finish, and preserves the old token fence.
- [x] Add the final authorization RPC and worker preflight immediately before invoking the extractor; no intervening async operation remains.
- [x] Clarify UI copy: an authorized provider request cannot be recalled, and its result is not saved after revocation.
- [x] Run focused tests, the complete Vitest suite, `typecheck`, lint, and isolated `db:test`.

## Verification record

- `npm run db:test`: passed full replay on isolated PostgreSQL 17.6, including the legacy-job upgrade fixture, chat lease races, profile admission, revocation fencing, concurrent claims, and history controls.
- Vitest: 1477 tests across 101 files passed with the loopback-only dependency integration file excluded; that file's 6 tests passed separately with local socket access, for 1483 passing tests total.
- `npm run typecheck`, `npm run lint`, Python AST syntax checks, and `git diff --check`: passed.
- `npm run db:types:check` returned a schema mismatch on one attempt. A subsequent `migration list --local` found no local database listening on port 54322, so the generated-schema comparison remains unverified. No types were regenerated from an unknown/shared worktree schema.
- No hosted migration, feature-flag activation, model call, push, merge, or deploy was performed.

## Deferred

- Pending-memory injection, semantic negation/attribution evaluation, corrections beyond the newest 20 references, and filtering before the 100-row context window. These require a separate product/evaluation decision and are not silently changed by this safety patch.
