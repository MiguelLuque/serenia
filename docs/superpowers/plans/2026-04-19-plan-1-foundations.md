# Serenia — Plan 1: Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the complete Serenia project: Next.js app, Supabase schema with RLS, clinical scoring modules (unit-tested), and LLM portability layer — everything Plans 2–6 build on top of.

**Architecture:** Next.js 16 App Router + TypeScript, Supabase (Postgres + Auth + RLS), clinical logic as pure TS modules in `lib/clinical/`, LLM provider abstraction in `lib/llm/` using Vercel AI SDK roles.

**Tech Stack:** Next.js 16, TypeScript, Tailwind, shadcn/ui, Supabase CLI, Vitest, Vercel AI SDK v6+ (routes `provider/model` strings through Vercel AI Gateway automatically — no provider-specific packages needed)

---

## File Map

```
serenia/
├─ app/
│  ├─ layout.tsx                    # root layout with providers
│  └─ page.tsx                      # placeholder home
├─ components/
│  └─ providers.tsx                 # client providers wrapper
├─ lib/
│  ├─ clinical/
│  │  ├─ scoring/
│  │  │  ├─ phq9.ts                 # PHQ-9 scorer
│  │  │  ├─ gad7.ts                 # GAD-7 scorer
│  │  │  └─ asq.ts                  # ASQ scorer
│  │  ├─ severity.ts                # shared severity band types + helpers
│  │  └─ risk-rules.ts              # when to trigger protocol / re-administer
│  ├─ llm/
│  │  ├─ config.ts                  # env → provider+model resolution
│  │  ├─ models.ts                  # role exports: conversational, fast, structured
│  │  └─ prompts/
│  │     └─ index.ts                # system prompt builders
│  ├─ supabase/
│  │  ├─ client.ts                  # browser authenticated client
│  │  └─ server.ts                  # server authenticated + service-role clients
│  └─ types/
│     └─ messages.ts                # MessagePart discriminated union (Zod)
├─ supabase/
│  ├─ migrations/
│  │  ├─ 20260419000001_enums.sql
│  │  ├─ 20260419000002_user_tables.sql
│  │  ├─ 20260419000003_conversation_tables.sql
│  │  ├─ 20260419000004_questionnaire_tables.sql
│  │  ├─ 20260419000005_clinical_tables.sql
│  │  ├─ 20260419000006_v15_stubs.sql
│  │  ├─ 20260419000007_updated_at_trigger.sql
│  │  ├─ 20260419000008_rls_owner_only.sql
│  │  ├─ 20260419000009_rls_public_and_restricted.sql
│  │  └─ 20260419000010_gdpr_erase.sql
│  └─ seed/
│     ├─ phq9.sql
│     ├─ gad7.sql
│     └─ asq.sql
└─ tests/
   └─ clinical/
      ├─ phq9.test.ts
      ├─ gad7.test.ts
      ├─ asq.test.ts
      └─ risk-rules.test.ts
```

---

## Task 1: Bootstrap Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Create the Next.js app**

```bash
cd /Users/miguelluque/git
npx create-next-app@latest serenia \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-turbopack
cd serenia
```

Expected: directory created, `npm run dev` starts on port 3000.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr \
  ai \
  zod \
  --save

npm install vitest @vitejs/plugin-react vite-tsconfig-paths \
  @testing-library/react @testing-library/user-event \
  --save-dev
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

When prompted: style=default, base color=slate, CSS variables=yes.

- [ ] **Step 4: Add core shadcn components**

```bash
npx shadcn@latest add button card input label textarea badge separator toast
```

- [ ] **Step 5: Configure Vitest**

Replace the contents of `vitest.config.ts` (create if absent) with:

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
})
```

- [ ] **Step 6: Add test script to package.json**

In `package.json`, inside `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Verify bootstrap**

```bash
npm run build
npm test
```

Expected: build succeeds (no errors), test suite runs (0 tests, no failures).

- [ ] **Step 8: Restore docs and commit**

```bash
mkdir -p docs/superpowers/specs docs/superpowers/plans
git add -A
git commit -m "feat: bootstrap Next.js 16 project with shadcn, vitest"
```

---

## Task 2: Supabase local development setup

**Files:**
- Create: `supabase/config.toml`, `.env.local`

- [ ] **Step 1: Install Supabase CLI (if not present)**

```bash
npm install supabase --save-dev
```

- [ ] **Step 2: Initialise Supabase project**

```bash
npx supabase init
```

Expected: `supabase/config.toml` created.

- [ ] **Step 3: Start local Supabase**

```bash
npx supabase start
```

Expected: output includes local API URL (default `http://127.0.0.1:54321`) and `anon key` / `service_role key`. Save these for `.env.local`.

- [ ] **Step 4: Create `.env.local`**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>

LLM_CONVERSATIONAL_PROVIDER=anthropic
LLM_CONVERSATIONAL_MODEL=claude-sonnet-4.6
LLM_FAST_PROVIDER=anthropic
LLM_FAST_MODEL=claude-haiku-4.5
LLM_STRUCTURED_PROVIDER=anthropic
LLM_STRUCTURED_MODEL=claude-sonnet-4.6
EOF
```

AI calls route through Vercel AI Gateway using OIDC — no provider API key needed.
Connect to your Vercel project and pull the OIDC token:

```bash
vercel link
vercel env pull .env.local --yes
```

This writes `VERCEL_OIDC_TOKEN` to `.env.local` (valid ~24h). Refresh with `vercel env pull` when it expires.

- [ ] **Step 5: Add `.env.local` to `.gitignore`**

Verify `.gitignore` contains `.env.local`. If not:
```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
git add supabase/ .gitignore
git commit -m "feat: add supabase local dev setup"
```

---

## Task 3: Migration — Enums

**Files:**
- Create: `supabase/migrations/20260419000001_enums.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000001_enums.sql

create type conversation_status as enum ('active', 'closed', 'archived');
create type session_status as enum ('open', 'paused', 'closed');
create type questionnaire_instance_status as enum (
  'proposed', 'in_progress', 'submitted', 'scored', 'cancelled'
);
create type assessment_status as enum (
  'draft_ai',
  'pending_clinician_review',
  'reviewed_confirmed',
  'reviewed_modified',
  'rejected',
  'superseded'
);
create type review_status as enum ('pending', 'in_review', 'reviewed', 'rejected', 'needs_followup');
create type risk_severity as enum ('low', 'moderate', 'high', 'critical');
create type risk_status as enum ('open', 'acknowledged', 'escalated', 'closed');
create type risk_type as enum (
  'suicidal_ideation', 'self_harm', 'severe_distress', 'crisis_other'
);
create type generated_by_source as enum ('ai', 'clinician', 'system');
create type assessment_type as enum ('intake', 'follow_up', 'closure', 'review');
create type trigger_source as enum ('ai', 'clinician', 'schedule', 'user');
create type onboarding_status as enum ('pending', 'consent', 'age_gate', 'baseline', 'complete');
create type risk_profile_status as enum ('unknown', 'low', 'elevated', 'active_protocol');
create type message_role as enum ('user', 'assistant', 'tool', 'system');
create type actor_type as enum ('user', 'service', 'system');
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db reset
```

Expected: `Applying migration 20260419000001_enums.sql... done`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000001_enums.sql
git commit -m "feat: add postgres enums for all domain types"
```

---

## Task 4: Migration — User tables

**Files:**
- Create: `supabase/migrations/20260419000002_user_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000002_user_tables.sql

create table user_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade unique,
  display_name   text,
  locale         text not null default 'es-ES',
  timezone       text not null default 'Europe/Madrid',
  current_focus  text[],
  last_known_risk_level  risk_profile_status not null default 'unknown',
  consent_version        text,
  consent_given_at       timestamptz,
  onboarding_status      onboarding_status not null default 'pending',
  risk_profile_status    risk_profile_status not null default 'unknown',
  baseline_summary       text,
  active_care_plan_id    uuid,          -- FK added after care_plans table exists (task 6)
  last_reviewed_assessment_id uuid,     -- FK added after assessments table exists (task 5)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  consent_version text not null,
  accepted_at     timestamptz not null default now(),
  payload_json    jsonb not null default '{}'
);
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000002_user_tables.sql
git commit -m "feat: add user_profiles and consents tables"
```

---

## Task 5: Migration — Conversation and message tables

**Files:**
- Create: `supabase/migrations/20260419000003_conversation_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000003_conversation_tables.sql

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text,
  status          conversation_status not null default 'active',
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  latest_session_summary_id uuid,       -- FK added after session_summaries exists below
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table clinical_sessions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          session_status not null default 'open',
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  closure_reason  text,
  summary_id      uuid,                 -- FK added after session_summaries exists below
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  session_id      uuid references clinical_sessions(id) on delete set null,
  role            message_role not null,
  parts           jsonb not null default '[]',
  visible_to_user boolean not null default true,
  created_at      timestamptz not null default now()
);

create table session_summaries (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references clinical_sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  summary_json jsonb not null,
  generated_by generated_by_source not null default 'ai',
  created_at   timestamptz not null default now()
);

-- Now add deferred FKs
alter table conversations
  add constraint fk_conversations_latest_summary
  foreign key (latest_session_summary_id)
  references session_summaries(id) on delete set null;

alter table clinical_sessions
  add constraint fk_sessions_summary
  foreign key (summary_id)
  references session_summaries(id) on delete set null;

-- Indexes for common queries
create index idx_messages_conversation_id on messages(conversation_id);
create index idx_messages_created_at on messages(created_at);
create index idx_clinical_sessions_conversation_id on clinical_sessions(conversation_id);
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000003_conversation_tables.sql
git commit -m "feat: add conversations, clinical_sessions, messages, session_summaries"
```

---

## Task 6: Migration — Questionnaire tables

**Files:**
- Create: `supabase/migrations/20260419000004_questionnaire_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000004_questionnaire_tables.sql

create table questionnaire_definitions (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,   -- PHQ9, GAD7, ASQ
  name              text not null,
  domain            text not null,          -- depression, anxiety, risk
  version           text not null default '1.0',
  language          text not null default 'es-ES',
  is_active         boolean not null default true,
  scoring_strategy  text not null,          -- sum, conditional
  source_reference  text,
  instructions_json jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

create table questionnaire_items (
  id                   uuid primary key default gen_random_uuid(),
  questionnaire_id     uuid not null references questionnaire_definitions(id) on delete cascade,
  order_index          int not null,
  prompt               text not null,
  response_type        text not null default 'single_choice',
  options_json         jsonb not null default '[]',
  numeric_value_map_json jsonb not null default '{}',
  is_required          boolean not null default true,
  risk_flag_rule       jsonb,               -- e.g. {"gte": 1} for PHQ9 item 9
  created_at           timestamptz not null default now(),
  unique (questionnaire_id, order_index)
);

create table questionnaire_instances (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  conversation_id  uuid references conversations(id) on delete set null,
  session_id       uuid references clinical_sessions(id) on delete set null,
  questionnaire_id uuid not null references questionnaire_definitions(id),
  triggered_by     trigger_source not null default 'ai',
  trigger_reason   text,
  status           questionnaire_instance_status not null default 'proposed',
  started_at       timestamptz,
  submitted_at     timestamptz,
  scored_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table questionnaire_answers (
  id           uuid primary key default gen_random_uuid(),
  instance_id  uuid not null references questionnaire_instances(id) on delete cascade,
  item_id      uuid not null references questionnaire_items(id),
  answer_raw   text not null,
  answer_numeric integer,
  answered_at  timestamptz not null default now(),
  unique (instance_id, item_id)
);

create table questionnaire_results (
  id               uuid primary key default gen_random_uuid(),
  instance_id      uuid not null references questionnaire_instances(id) on delete cascade unique,
  total_score      integer not null,
  severity_band    text not null,
  subscores_json   jsonb not null default '{}',
  flags_json       jsonb not null default '[]',
  interpretation_json jsonb not null default '{}',
  requires_review  boolean not null default false,
  created_at       timestamptz not null default now()
);

create index idx_instances_user_id on questionnaire_instances(user_id);
create index idx_instances_questionnaire_id on questionnaire_instances(questionnaire_id);
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000004_questionnaire_tables.sql
git commit -m "feat: add questionnaire definition, instance, answers, results tables"
```

---

## Task 7: Migration — Clinical and risk tables

**Files:**
- Create: `supabase/migrations/20260419000005_clinical_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000005_clinical_tables.sql

create table assessments (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  session_id                uuid references clinical_sessions(id) on delete set null,
  generated_by              generated_by_source not null default 'ai',
  assessment_type           assessment_type not null default 'follow_up',
  summary_json              jsonb not null,
  status                    assessment_status not null default 'draft_ai',
  review_status             review_status,
  reviewed_by               uuid,             -- FK to clinicians added in v1.5 migration
  reviewed_at               timestamptz,
  supersedes_assessment_id  uuid references assessments(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Add deferred FK on user_profiles
alter table user_profiles
  add constraint fk_user_profiles_last_assessment
  foreign key (last_reviewed_assessment_id)
  references assessments(id) on delete set null;

create table risk_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  session_id      uuid references clinical_sessions(id) on delete set null,
  source_type     text not null,              -- 'message' | 'questionnaire' | 'manual_review'
  risk_type       risk_type not null,
  severity        risk_severity not null,
  payload_json    jsonb not null default '{}',
  status          risk_status not null default 'open',
  acknowledged_at timestamptz,
  closed_at       timestamptz,
  created_at      timestamptz not null default now()
);

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_type  actor_type not null,
  actor_id    uuid,
  entity_type text not null,
  entity_id   uuid,
  action      text not null,
  diff_json   jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index idx_risk_events_user_id on risk_events(user_id);
create index idx_risk_events_status on risk_events(status);
create index idx_audit_log_entity on audit_log(entity_type, entity_id);
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000005_clinical_tables.sql
git commit -m "feat: add assessments, risk_events, audit_log tables"
```

---

## Task 8: Migration — v1.5 stubs

**Files:**
- Create: `supabase/migrations/20260419000006_v15_stubs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000006_v15_stubs.sql
-- These tables are empty in MVP v1. RLS denies all access.
-- They exist so FKs (reviewed_by, active_care_plan_id) are valid.

create table clinicians (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table user_clinician_assignments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  clinician_id uuid not null references clinicians(id) on delete cascade,
  is_primary   boolean not null default false,
  assigned_at  timestamptz not null default now(),
  ended_at     timestamptz
);

create table clinician_reviews (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  clinician_id  uuid not null references clinicians(id),
  status        review_status not null default 'pending',
  notes         text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table care_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  created_by        uuid,
  source_type       generated_by_source not null default 'ai',
  status            text not null default 'active',
  goals_json        jsonb not null default '[]',
  recommendations_json jsonb not null default '[]',
  next_check_in_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Now add FK from user_profiles to care_plans
alter table user_profiles
  add constraint fk_user_profiles_care_plan
  foreign key (active_care_plan_id)
  references care_plans(id) on delete set null;

-- FK from assessments.reviewed_by to clinicians
alter table assessments
  add constraint fk_assessments_reviewed_by
  foreign key (reviewed_by)
  references clinicians(id) on delete set null;
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000006_v15_stubs.sql
git commit -m "feat: add v1.5 stub tables (clinicians, care_plans, reviews)"
```

---

## Task 9: Migration — `updated_at` trigger

**Files:**
- Create: `supabase/migrations/20260419000007_updated_at_trigger.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000007_updated_at_trigger.sql

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

create trigger trg_conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

create trigger trg_clinical_sessions_updated_at
  before update on clinical_sessions
  for each row execute function set_updated_at();

create trigger trg_questionnaire_instances_updated_at
  before update on questionnaire_instances
  for each row execute function set_updated_at();

create trigger trg_assessments_updated_at
  before update on assessments
  for each row execute function set_updated_at();

create trigger trg_care_plans_updated_at
  before update on care_plans
  for each row execute function set_updated_at();
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000007_updated_at_trigger.sql
git commit -m "feat: add updated_at trigger to all mutable tables"
```

---

## Task 10: Migration — RLS owner-only policies

**Files:**
- Create: `supabase/migrations/20260419000008_rls_owner_only.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000008_rls_owner_only.sql

-- Enable RLS on all user-owned tables
alter table user_profiles enable row level security;
alter table consents enable row level security;
alter table conversations enable row level security;
alter table clinical_sessions enable row level security;
alter table messages enable row level security;
alter table session_summaries enable row level security;
alter table questionnaire_instances enable row level security;
alter table questionnaire_answers enable row level security;
alter table questionnaire_results enable row level security;
alter table assessments enable row level security;
alter table risk_events enable row level security;
alter table audit_log enable row level security;

-- user_profiles: owner read/update (cannot delete own profile directly)
create policy "user_profiles_select_own"
  on user_profiles for select
  using (user_id = auth.uid());

create policy "user_profiles_update_own"
  on user_profiles for update
  using (user_id = auth.uid());

-- consents: owner read, append-only insert
create policy "consents_select_own"
  on consents for select
  using (user_id = auth.uid());

create policy "consents_insert_own"
  on consents for insert
  with check (user_id = auth.uid());

-- conversations
create policy "conversations_all_own"
  on conversations for all
  using (user_id = auth.uid());

-- clinical_sessions
create policy "clinical_sessions_all_own"
  on clinical_sessions for all
  using (user_id = auth.uid());

-- messages: select own, insert via service role only (no direct client insert)
create policy "messages_select_own"
  on messages for select
  using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

-- session_summaries
create policy "session_summaries_select_own"
  on session_summaries for select
  using (user_id = auth.uid());

-- questionnaire_instances
create policy "qi_all_own"
  on questionnaire_instances for all
  using (user_id = auth.uid());

-- questionnaire_answers: select own; insert via service role
create policy "qa_select_own"
  on questionnaire_answers for select
  using (
    instance_id in (
      select id from questionnaire_instances where user_id = auth.uid()
    )
  );

-- questionnaire_results: select own
create policy "qr_select_own"
  on questionnaire_results for select
  using (
    instance_id in (
      select id from questionnaire_instances where user_id = auth.uid()
    )
  );

-- assessments: select own
create policy "assessments_select_own"
  on assessments for select
  using (user_id = auth.uid());

-- risk_events: select own (write is service-role only)
create policy "risk_events_select_own"
  on risk_events for select
  using (user_id = auth.uid());

-- audit_log: no access for authenticated users (service-role only)
create policy "audit_log_deny_all"
  on audit_log for all
  using (false);
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000008_rls_owner_only.sql
git commit -m "feat: add RLS owner-only policies"
```

---

## Task 11: Migration — Public-read and v1.5-deny policies

**Files:**
- Create: `supabase/migrations/20260419000009_rls_public_and_restricted.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000009_rls_public_and_restricted.sql

-- Questionnaire definitions + items: read to all authenticated users
alter table questionnaire_definitions enable row level security;
alter table questionnaire_items enable row level security;

create policy "questionnaire_definitions_read_authenticated"
  on questionnaire_definitions for select
  to authenticated
  using (is_active = true);

create policy "questionnaire_items_read_authenticated"
  on questionnaire_items for select
  to authenticated
  using (true);

-- v1.5 tables: deny all (no authenticated client access in MVP)
alter table clinicians enable row level security;
alter table user_clinician_assignments enable row level security;
alter table clinician_reviews enable row level security;
alter table care_plans enable row level security;

create policy "clinicians_deny_all" on clinicians for all using (false);
create policy "assignments_deny_all" on user_clinician_assignments for all using (false);
create policy "reviews_deny_all" on clinician_reviews for all using (false);
create policy "care_plans_deny_all" on care_plans for all using (false);
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000009_rls_public_and_restricted.sql
git commit -m "feat: add RLS policies for questionnaire public-read and v1.5 deny"
```

---

## Task 12: Migration — GDPR erase RPC

**Files:**
- Create: `supabase/migrations/20260419000010_gdpr_erase.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419000010_gdpr_erase.sql
-- Service-role only. Cascades hard-delete for right-to-erasure.
-- auth.users delete cascades to all child tables via ON DELETE CASCADE.
-- We replace audit_log.actor_id with a tombstone for tamper-evidence.

create or replace function gdpr_erase_user(target_user_id uuid)
returns void
language plpgsql
security definer   -- runs as owner (service role), bypasses RLS
set search_path = public
as $$
declare
  tombstone_id uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- Replace actor_id in audit_log to preserve tamper-evidence without PII
  update audit_log
    set actor_id = tombstone_id
    where actor_id = target_user_id;

  -- Hard-delete the auth user; all child tables cascade
  delete from auth.users where id = target_user_id;
end;
$$;

-- Only callable by service role (no grant to authenticated or anon)
revoke all on function gdpr_erase_user(uuid) from public, authenticated, anon;
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db lint
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419000010_gdpr_erase.sql
git commit -m "feat: add gdpr_erase_user RPC (service-role only)"
```

---

## Task 13: Seeds — PHQ-9

**Files:**
- Create: `supabase/seed/phq9.sql`

- [ ] **Step 1: Write the seed**

```sql
-- supabase/seed/phq9.sql

insert into questionnaire_definitions
  (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
values (
  'PHQ9',
  'Cuestionario de Salud del Paciente-9',
  'depression',
  '1.0',
  'es-ES',
  'sum',
  'Kroenke K, Spitzer RL, Williams JB. The PHQ-9: validity of a brief depression severity measure.',
  '{"preamble": "Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?"}'
);

-- PHQ-9 options are identical for items 1-9
-- severity: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe

with def as (select id from questionnaire_definitions where code = 'PHQ9')
insert into questionnaire_items
  (questionnaire_id, order_index, prompt, response_type, options_json, numeric_value_map_json, is_required, risk_flag_rule)
select
  def.id,
  item.order_index,
  item.prompt,
  'single_choice',
  '[
    {"label": "Ningún día", "value": "0"},
    {"label": "Varios días", "value": "1"},
    {"label": "Más de la mitad de los días", "value": "2"},
    {"label": "Casi todos los días", "value": "3"}
  ]'::jsonb,
  '{"0": 0, "1": 1, "2": 2, "3": 3}'::jsonb,
  true,
  item.risk_flag_rule
from def, (values
  (1, 'Poco interés o placer en hacer las cosas', null::jsonb),
  (2, 'Sentirse desanimado/a, deprimido/a, o sin esperanza', null),
  (3, 'Con problemas para dormir o para mantenerse dormido/a, o durmiendo demasiado', null),
  (4, 'Sintiéndose cansado/a o con poca energía', null),
  (5, 'Con poco apetito o comiendo en exceso', null),
  (6, 'Sintiéndose mal consigo mismo/a, o que es un fracaso, o que ha fallado a sí mismo/a o a su familia', null),
  (7, 'Con dificultad para concentrarse en cosas como leer el periódico o ver la televisión', null),
  (8, 'Moviéndose o hablando tan lento que otras personas lo han notado, o lo contrario: tan inquieto/a que se ha estado moviendo mucho más de lo normal', null),
  (9, 'Pensamientos de que estaría mejor muerto/a o de hacerse daño de alguna manera', '{"gte": 1}'::jsonb)
) as item(order_index, prompt, risk_flag_rule);
```

- [ ] **Step 2: Add seed reference to supabase/config.toml**

In `supabase/config.toml`, ensure `[db]` section has:
```toml
[db]
...
# Seeds are applied after migrations on db reset
```

Actually, Supabase applies `supabase/seed.sql` automatically. Create `supabase/seed.sql`:

```sql
-- supabase/seed.sql
\i seed/phq9.sql
\i seed/gad7.sql
\i seed/asq.sql
```

- [ ] **Step 3: Verify PHQ-9 seed**

```bash
npx supabase db reset
npx supabase db -- psql -c "select code, count(*) from questionnaire_definitions d join questionnaire_items i on i.questionnaire_id = d.id group by code;"
```

Expected: `PHQ9 | 9`

- [ ] **Step 4: Commit**

```bash
git add supabase/seed/
git commit -m "feat: seed PHQ-9 questionnaire (ES-ES)"
```

---

## Task 14: Seeds — GAD-7 and ASQ

**Files:**
- Create: `supabase/seed/gad7.sql`, `supabase/seed/asq.sql`

- [ ] **Step 1: Write GAD-7 seed**

```sql
-- supabase/seed/gad7.sql

insert into questionnaire_definitions
  (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
values (
  'GAD7',
  'Trastorno de Ansiedad Generalizada-7',
  'anxiety',
  '1.0',
  'es-ES',
  'sum',
  'Spitzer RL, Kroenke K, Williams JB, Löwe B. A brief measure for assessing generalized anxiety disorder.',
  '{"preamble": "Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?"}'
);

-- GAD-7 severity: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe

with def as (select id from questionnaire_definitions where code = 'GAD7')
insert into questionnaire_items
  (questionnaire_id, order_index, prompt, response_type, options_json, numeric_value_map_json, is_required, risk_flag_rule)
select
  def.id,
  item.order_index,
  item.prompt,
  'single_choice',
  '[
    {"label": "Ningún día", "value": "0"},
    {"label": "Varios días", "value": "1"},
    {"label": "Más de la mitad de los días", "value": "2"},
    {"label": "Casi todos los días", "value": "3"}
  ]'::jsonb,
  '{"0": 0, "1": 1, "2": 2, "3": 3}'::jsonb,
  true,
  null
from def, (values
  (1, 'Sentirse nervioso/a, ansioso/a o muy alterado/a'),
  (2, 'No poder dejar de preocuparse o no poder controlar la preocupación'),
  (3, 'Preocuparse demasiado por distintas cosas'),
  (4, 'Dificultad para relajarse'),
  (5, 'Estar tan intranquilo/a que es difícil quedarse quieto/a'),
  (6, 'Molestarse o ponerse irritable con facilidad'),
  (7, 'Sentir miedo, como si fuera a pasar algo terrible')
) as item(order_index, prompt);
```

- [ ] **Step 2: Write ASQ seed**

```sql
-- supabase/seed/asq.sql
-- ASQ: 4 yes/no items + 1 acuity question if any positive.
-- Based on NIMH ASQ structure (adapted for ES use).

insert into questionnaire_definitions
  (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
values (
  'ASQ',
  'Cuestionario de Evaluación de la Conducta Suicida',
  'risk',
  '1.0',
  'es-ES',
  'conditional',
  'Horowitz LM et al. Ask Suicide-Screening Questions (ASQ). NIMH.',
  '{"preamble": "En las últimas semanas, ¿ha tenido alguno de los siguientes pensamientos?"}'
);

with def as (select id from questionnaire_definitions where code = 'ASQ')
insert into questionnaire_items
  (questionnaire_id, order_index, prompt, response_type, options_json, numeric_value_map_json, is_required, risk_flag_rule)
select
  def.id,
  item.order_index,
  item.prompt,
  item.response_type,
  item.options_json::jsonb,
  item.value_map::jsonb,
  true,
  item.risk_flag_rule::jsonb
from def, (values
  (1,
   '¿Ha deseado estar muerto/a o dormido/a y no volver a despertar?',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}'),
  (2,
   '¿Ha tenido algún pensamiento de hacerse daño o quitarse la vida?',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}'),
  (3,
   '¿Ha pensado en cómo podría hacerlo?',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}'),
  (4,
   '¿Ha tenido alguna intención de actuar según esos pensamientos?',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}'),
  (5,
   '¿Tiene pensado hacerse daño en el próximo mes? (Responda solo si ha respondido Sí a alguna pregunta anterior)',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}')
) as item(order_index, prompt, response_type, options_json, value_map, risk_flag_rule);
```

- [ ] **Step 3: Apply and verify**

```bash
npx supabase db reset
npx supabase db -- psql -c "select code, count(*) as items from questionnaire_definitions d join questionnaire_items i on i.questionnaire_id = d.id group by code order by code;"
```

Expected:
```
 code | items
------+-------
 ASQ  |     5
 GAD7 |     7
 PHQ9 |     9
```

- [ ] **Step 4: Commit**

```bash
git add supabase/seed/gad7.sql supabase/seed/asq.sql supabase/seed.sql
git commit -m "feat: seed GAD-7 and ASQ questionnaires (ES-ES)"
```

---

## Task 15: Generate Supabase TypeScript types

**Files:**
- Create: `lib/supabase/types.ts`

- [ ] **Step 1: Generate types**

```bash
npx supabase gen types typescript --local > lib/supabase/types.ts
```

- [ ] **Step 2: Verify the file contains the tables**

```bash
grep -c "questionnaire_definitions\|user_profiles\|risk_events" lib/supabase/types.ts
```

Expected: 3 or more matches.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: generate supabase typescript types"
```

---

## Task 16: Clinical — Severity types and helpers

**Files:**
- Create: `lib/clinical/severity.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/clinical/severity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  phq9SeverityBand,
  gad7SeverityBand,
  asqRiskLevel,
} from '@/lib/clinical/severity'

describe('phq9SeverityBand', () => {
  it('returns minimal for 0-4', () => {
    expect(phq9SeverityBand(0)).toBe('minimal')
    expect(phq9SeverityBand(4)).toBe('minimal')
  })
  it('returns mild for 5-9', () => {
    expect(phq9SeverityBand(5)).toBe('mild')
    expect(phq9SeverityBand(9)).toBe('mild')
  })
  it('returns moderate for 10-14', () => {
    expect(phq9SeverityBand(10)).toBe('moderate')
    expect(phq9SeverityBand(14)).toBe('moderate')
  })
  it('returns moderately_severe for 15-19', () => {
    expect(phq9SeverityBand(15)).toBe('moderately_severe')
    expect(phq9SeverityBand(19)).toBe('moderately_severe')
  })
  it('returns severe for 20-27', () => {
    expect(phq9SeverityBand(20)).toBe('severe')
    expect(phq9SeverityBand(27)).toBe('severe')
  })
})

describe('gad7SeverityBand', () => {
  it('returns minimal for 0-4', () => expect(gad7SeverityBand(0)).toBe('minimal'))
  it('returns mild for 5-9', () => expect(gad7SeverityBand(5)).toBe('mild'))
  it('returns moderate for 10-14', () => expect(gad7SeverityBand(10)).toBe('moderate'))
  it('returns severe for 15-21', () => expect(gad7SeverityBand(15)).toBe('severe'))
})

describe('asqRiskLevel', () => {
  it('returns negative for all zeros', () => expect(asqRiskLevel([0,0,0,0,0])).toBe('negative'))
  it('returns positive_non_acute for item 1-4 positive but item 5 negative', () => {
    expect(asqRiskLevel([1,0,0,0,0])).toBe('positive_non_acute')
  })
  it('returns positive_acute for item 5 positive', () => {
    expect(asqRiskLevel([1,1,0,0,1])).toBe('positive_acute')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/clinical/severity.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/clinical/severity'`

- [ ] **Step 3: Write implementation**

Create `lib/clinical/severity.ts`:

```ts
export type PHQ9SeverityBand = 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe'
export type GAD7SeverityBand = 'minimal' | 'mild' | 'moderate' | 'severe'
export type ASQRiskLevel = 'negative' | 'positive_non_acute' | 'positive_acute'

export function phq9SeverityBand(score: number): PHQ9SeverityBand {
  if (score <= 4) return 'minimal'
  if (score <= 9) return 'mild'
  if (score <= 14) return 'moderate'
  if (score <= 19) return 'moderately_severe'
  return 'severe'
}

export function gad7SeverityBand(score: number): GAD7SeverityBand {
  if (score <= 4) return 'minimal'
  if (score <= 9) return 'mild'
  if (score <= 14) return 'moderate'
  return 'severe'
}

// answers: array of numeric values for items 1-5 (0 or 1)
export function asqRiskLevel(answers: number[]): ASQRiskLevel {
  const [a1, a2, a3, a4, a5] = answers
  if (a5 === 1) return 'positive_acute'
  if (a1 || a2 || a3 || a4) return 'positive_non_acute'
  return 'negative'
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/clinical/severity.test.ts
```

Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/clinical/severity.ts tests/clinical/severity.test.ts
git commit -m "feat: add clinical severity band helpers with tests"
```

---

## Task 17: Clinical — PHQ-9 scorer (TDD)

**Files:**
- Create: `lib/clinical/scoring/phq9.ts`
- Create: `tests/clinical/phq9.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/clinical/phq9.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scorePHQ9 } from '@/lib/clinical/scoring/phq9'

describe('scorePHQ9', () => {
  it('scores all zeros correctly', () => {
    const result = scorePHQ9([0,0,0,0,0,0,0,0,0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toEqual([])
    expect(result.requiresReview).toBe(false)
  })

  it('scores moderate severity', () => {
    const result = scorePHQ9([2,2,2,2,1,1,0,0,0])
    expect(result.totalScore).toBe(10)
    expect(result.severityBand).toBe('moderate')
    expect(result.requiresReview).toBe(true)
  })

  it('flags item 9 when answered >= 1', () => {
    const result = scorePHQ9([0,0,0,0,0,0,0,0,1])
    expect(result.flags).toContain('suicidal_ideation')
    expect(result.requiresReview).toBe(true)
  })

  it('does not flag item 9 when answered 0', () => {
    const result = scorePHQ9([0,0,0,0,0,0,0,0,0])
    expect(result.flags).not.toContain('suicidal_ideation')
  })

  it('throws if answers array is not length 9', () => {
    expect(() => scorePHQ9([1,2,3])).toThrow('PHQ-9 requires exactly 9 answers')
  })

  it('throws if any answer is out of range 0-3', () => {
    expect(() => scorePHQ9([0,0,0,0,0,0,0,0,4])).toThrow('PHQ-9 answers must be 0-3')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/clinical/phq9.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write implementation**

Create `lib/clinical/scoring/phq9.ts`:

```ts
import { phq9SeverityBand, type PHQ9SeverityBand } from '@/lib/clinical/severity'

export interface PHQ9Result {
  totalScore: number
  severityBand: PHQ9SeverityBand
  flags: string[]
  requiresReview: boolean
}

export function scorePHQ9(answers: number[]): PHQ9Result {
  if (answers.length !== 9) throw new Error('PHQ-9 requires exactly 9 answers')
  if (answers.some(a => a < 0 || a > 3)) throw new Error('PHQ-9 answers must be 0-3')

  const totalScore = answers.reduce((sum, a) => sum + a, 0)
  const severityBand = phq9SeverityBand(totalScore)
  const flags: string[] = []

  if (answers[8] >= 1) flags.push('suicidal_ideation')

  const requiresReview = totalScore >= 10 || flags.length > 0

  return { totalScore, severityBand, flags, requiresReview }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/clinical/phq9.test.ts
```

Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/clinical/scoring/phq9.ts tests/clinical/phq9.test.ts
git commit -m "feat: PHQ-9 scorer with suicidal ideation flag"
```

---

## Task 18: Clinical — GAD-7 scorer (TDD)

**Files:**
- Create: `lib/clinical/scoring/gad7.ts`
- Create: `tests/clinical/gad7.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/clinical/gad7.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreGAD7 } from '@/lib/clinical/scoring/gad7'

describe('scoreGAD7', () => {
  it('scores all zeros', () => {
    const result = scoreGAD7([0,0,0,0,0,0,0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.requiresReview).toBe(false)
  })

  it('scores moderate severity', () => {
    const result = scoreGAD7([2,2,2,2,1,1,0])
    expect(result.totalScore).toBe(10)
    expect(result.severityBand).toBe('moderate')
    expect(result.requiresReview).toBe(true)
  })

  it('requires review for severe', () => {
    const result = scoreGAD7([3,3,3,3,2,1,0])
    expect(result.severityBand).toBe('severe')
    expect(result.requiresReview).toBe(true)
  })

  it('throws if answers array is not length 7', () => {
    expect(() => scoreGAD7([1,2,3])).toThrow('GAD-7 requires exactly 7 answers')
  })

  it('throws if any answer is out of range 0-3', () => {
    expect(() => scoreGAD7([0,0,0,0,0,0,4])).toThrow('GAD-7 answers must be 0-3')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/clinical/gad7.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write implementation**

Create `lib/clinical/scoring/gad7.ts`:

```ts
import { gad7SeverityBand, type GAD7SeverityBand } from '@/lib/clinical/severity'

export interface GAD7Result {
  totalScore: number
  severityBand: GAD7SeverityBand
  flags: string[]
  requiresReview: boolean
}

export function scoreGAD7(answers: number[]): GAD7Result {
  if (answers.length !== 7) throw new Error('GAD-7 requires exactly 7 answers')
  if (answers.some(a => a < 0 || a > 3)) throw new Error('GAD-7 answers must be 0-3')

  const totalScore = answers.reduce((sum, a) => sum + a, 0)
  const severityBand = gad7SeverityBand(totalScore)
  const flags: string[] = []

  const requiresReview = totalScore >= 10

  return { totalScore, severityBand, flags, requiresReview }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/clinical/gad7.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/clinical/scoring/gad7.ts tests/clinical/gad7.test.ts
git commit -m "feat: GAD-7 scorer"
```

---

## Task 19: Clinical — ASQ scorer (TDD)

**Files:**
- Create: `lib/clinical/scoring/asq.ts`
- Create: `tests/clinical/asq.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/clinical/asq.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreASQ } from '@/lib/clinical/scoring/asq'

describe('scoreASQ', () => {
  it('returns negative for all zeros', () => {
    const result = scoreASQ([0,0,0,0,0])
    expect(result.riskLevel).toBe('negative')
    expect(result.requiresReview).toBe(false)
    expect(result.flags).toEqual([])
  })

  it('returns positive_non_acute when item 1 is 1 but item 5 is 0', () => {
    const result = scoreASQ([1,0,0,0,0])
    expect(result.riskLevel).toBe('positive_non_acute')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toContain('suicidal_ideation')
  })

  it('returns positive_acute when item 5 is 1', () => {
    const result = scoreASQ([1,1,0,0,1])
    expect(result.riskLevel).toBe('positive_acute')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toContain('imminent_risk')
  })

  it('throws if answers array is not length 5', () => {
    expect(() => scoreASQ([1,0])).toThrow('ASQ requires exactly 5 answers')
  })

  it('throws if answers are not 0 or 1', () => {
    expect(() => scoreASQ([0,0,0,0,2])).toThrow('ASQ answers must be 0 or 1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/clinical/asq.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write implementation**

Create `lib/clinical/scoring/asq.ts`:

```ts
import { asqRiskLevel, type ASQRiskLevel } from '@/lib/clinical/severity'

export interface ASQResult {
  riskLevel: ASQRiskLevel
  flags: string[]
  requiresReview: boolean
}

export function scoreASQ(answers: number[]): ASQResult {
  if (answers.length !== 5) throw new Error('ASQ requires exactly 5 answers')
  if (answers.some(a => a !== 0 && a !== 1)) throw new Error('ASQ answers must be 0 or 1')

  const riskLevel = asqRiskLevel(answers)
  const flags: string[] = []

  if (riskLevel !== 'negative') flags.push('suicidal_ideation')
  if (riskLevel === 'positive_acute') flags.push('imminent_risk')

  const requiresReview = riskLevel !== 'negative'

  return { riskLevel, flags, requiresReview }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/clinical/asq.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/clinical/scoring/asq.ts tests/clinical/asq.test.ts
git commit -m "feat: ASQ scorer with imminent risk flag"
```

---

## Task 20: Clinical — Risk rules (TDD)

**Files:**
- Create: `lib/clinical/risk-rules.ts`
- Create: `tests/clinical/risk-rules.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/clinical/risk-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  shouldAdministerPHQ9,
  shouldAdministerGAD7,
  shouldAdministerASQ,
  QUESTIONNAIRE_COOLDOWN_DAYS,
} from '@/lib/clinical/risk-rules'

const DAYS = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

describe('shouldAdministerPHQ9', () => {
  it('returns true when no recent result', () => {
    expect(shouldAdministerPHQ9(null)).toBe(true)
  })
  it('returns false when result is within cooldown period', () => {
    expect(shouldAdministerPHQ9(DAYS(5))).toBe(false)
  })
  it('returns true when result is outside cooldown period', () => {
    expect(shouldAdministerPHQ9(DAYS(15))).toBe(true)
  })
})

describe('shouldAdministerGAD7', () => {
  it('returns true when no recent result', () => {
    expect(shouldAdministerGAD7(null)).toBe(true)
  })
  it('returns false within cooldown', () => {
    expect(shouldAdministerGAD7(DAYS(5))).toBe(false)
  })
  it('returns true outside cooldown', () => {
    expect(shouldAdministerGAD7(DAYS(15))).toBe(true)
  })
})

describe('shouldAdministerASQ', () => {
  it('returns true when triggered by risk signal regardless of recency', () => {
    expect(shouldAdministerASQ({ triggeredByRiskSignal: true, lastAdministeredAt: DAYS(1) })).toBe(true)
  })
  it('returns false when no risk signal and administered today', () => {
    expect(shouldAdministerASQ({ triggeredByRiskSignal: false, lastAdministeredAt: DAYS(0) })).toBe(false)
  })
  it('returns false when no risk signal and never administered', () => {
    expect(shouldAdministerASQ({ triggeredByRiskSignal: false, lastAdministeredAt: null })).toBe(false)
  })
})

describe('QUESTIONNAIRE_COOLDOWN_DAYS', () => {
  it('is 14 days', () => {
    expect(QUESTIONNAIRE_COOLDOWN_DAYS).toBe(14)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/clinical/risk-rules.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write implementation**

Create `lib/clinical/risk-rules.ts`:

```ts
export const QUESTIONNAIRE_COOLDOWN_DAYS = 14

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
}

export function shouldAdministerPHQ9(lastAdministeredAt: Date | null): boolean {
  if (!lastAdministeredAt) return true
  return daysSince(lastAdministeredAt) >= QUESTIONNAIRE_COOLDOWN_DAYS
}

export function shouldAdministerGAD7(lastAdministeredAt: Date | null): boolean {
  if (!lastAdministeredAt) return true
  return daysSince(lastAdministeredAt) >= QUESTIONNAIRE_COOLDOWN_DAYS
}

export function shouldAdministerASQ(opts: {
  triggeredByRiskSignal: boolean
  lastAdministeredAt: Date | null
}): boolean {
  if (!opts.triggeredByRiskSignal) return false
  if (!opts.lastAdministeredAt) return false
  return daysSince(opts.lastAdministeredAt) >= 1
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/clinical/risk-rules.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 5: Run all clinical tests together**

```bash
npm test -- tests/clinical/
```

Expected: PASS — all tests in all 4 clinical test files green.

- [ ] **Step 6: Commit**

```bash
git add lib/clinical/risk-rules.ts tests/clinical/risk-rules.test.ts
git commit -m "feat: clinical risk rules (questionnaire cooldown + ASQ trigger)"
```

---

## Task 21: Message types — Zod discriminated union

**Files:**
- Create: `lib/types/messages.ts`

- [ ] **Step 1: Write the module**

Create `lib/types/messages.ts`:

```ts
import { z } from 'zod'

export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

export const QuestionnaireOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
})

export const QuestionnaireItemRenderSchema = z.object({
  itemId: z.string(),
  prompt: z.string(),
  responseType: z.enum(['single_choice', 'yes_no']),
  options: z.array(QuestionnaireOptionSchema),
})

export const QuestionnaireRenderPartSchema = z.object({
  type: z.literal('questionnaire_render'),
  instanceId: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  items: z.array(QuestionnaireItemRenderSchema),
  submitLabel: z.string(),
})

export const QuestionnaireResultPartSchema = z.object({
  type: z.literal('questionnaire_result'),
  instanceId: z.string(),
  code: z.string(),
  totalScore: z.number(),
  severityBand: z.string(),
  summary: z.string(),
  flags: z.array(z.string()),
})

export const CrisisResourceSchema = z.object({
  name: z.string(),
  number: z.string(),
  description: z.string(),
})

export const RiskAlertPartSchema = z.object({
  type: z.literal('risk_alert'),
  severity: z.enum(['low', 'moderate', 'high', 'critical']),
  resources: z.array(CrisisResourceSchema),
  protocolScript: z.string(),
  requiresAcknowledgement: z.literal(true),
})

export const ToolInvocationPartSchema = z.object({
  type: z.literal('tool_invocation'),
  toolName: z.string(),
  state: z.enum(['pending', 'result', 'error']),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
})

export const MessagePartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  QuestionnaireRenderPartSchema,
  QuestionnaireResultPartSchema,
  RiskAlertPartSchema,
  ToolInvocationPartSchema,
])

export type MessagePart = z.infer<typeof MessagePartSchema>
export type TextPart = z.infer<typeof TextPartSchema>
export type QuestionnaireRenderPart = z.infer<typeof QuestionnaireRenderPartSchema>
export type QuestionnaireResultPart = z.infer<typeof QuestionnaireResultPartSchema>
export type RiskAlertPart = z.infer<typeof RiskAlertPartSchema>
export type ToolInvocationPart = z.infer<typeof ToolInvocationPartSchema>
export type CrisisResource = z.infer<typeof CrisisResourceSchema>

export const ES_CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: 'Línea de Atención a la Conducta Suicida',
    number: '024',
    description: 'Servicio público gratuito, disponible 24h. Atiende situaciones de crisis suicida.',
  },
  {
    name: 'Emergencias',
    number: '112',
    description: 'Servicios de emergencia generales.',
  },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types/messages.ts
git commit -m "feat: MessagePart Zod discriminated union + ES crisis resources"
```

---

## Task 22: LLM portability layer

**Files:**
- Create: `lib/llm/config.ts`
- Create: `lib/llm/models.ts`
- Create: `lib/llm/prompts/index.ts`

- [ ] **Step 1: Write config module**

Create `lib/llm/config.ts`:

```ts
type LLMRole = 'conversational' | 'fast' | 'structured'

interface RoleConfig {
  provider: string
  model: string
}

function getRoleConfig(role: LLMRole): RoleConfig {
  const prefix = `LLM_${role.toUpperCase()}`
  const provider = process.env[`${prefix}_PROVIDER`] ?? 'anthropic'
  const model = process.env[`${prefix}_MODEL`]
  if (!model) {
    throw new Error(`Missing env var ${prefix}_MODEL for LLM role "${role}"`)
  }
  return { provider, model }
}

export { getRoleConfig, type RoleConfig, type LLMRole }
```

- [ ] **Step 2: Write models module**

Create `lib/llm/models.ts`:

```ts
import { getRoleConfig, type LLMRole } from './config'

// Returns a "provider/model" gateway string — Vercel AI SDK routes it through
// AI Gateway automatically. Auth via VERCEL_OIDC_TOKEN (vercel env pull).
function buildModel(role: LLMRole): string {
  const { provider, model } = getRoleConfig(role)
  return `${provider}/${model}`
}

export const llm = {
  conversational: (): string => buildModel('conversational'),
  fast: (): string => buildModel('fast'),
  structured: (): string => buildModel('structured'),
} as const
```

- [ ] **Step 3: Write prompts index**

Create `lib/llm/prompts/index.ts`:

```ts
export function buildClinicalSystemPrompt(): string {
  return `Eres Serenia, un asistente de apoyo emocional especializado en ansiedad y depresión.

## Tu rol
- Conversas con el usuario de forma empática y segura.
- Detectas cuándo es útil administrar un cuestionario clínico y lo solicitas mediante herramientas.
- Explicas los resultados como **cribado preliminar**, nunca como diagnóstico definitivo.
- Mantienes contexto gracias a los datos estructurados que recibes al inicio de cada sesión.

## Principios inamovibles
1. Nunca afirmes un diagnóstico definitivo sin revisión humana.
2. Nunca inventes puntuaciones de cuestionarios: usa siempre las herramientas.
3. Si detectas señales de riesgo, llama a evaluate_risk_signal de inmediato.
4. Usa siempre get_case_snapshot al inicio para recuperar el contexto del usuario.
5. Llama a list_eligible_questionnaires antes de proponer un cuestionario.
6. Los resultados son "cribado", "evaluación preliminar" o "resumen de síntomas". Nunca "diagnóstico".

## Tono
- Empático, cercano, no clínico en exceso.
- Claro y directo cuando hay riesgo.
- No minimices nunca la ideación suicida o autolesiva.`
}

export function buildRiskProtocolScript(): string {
  return `Entiendo que puede estar pasando por un momento muy difícil. Quiero asegurarme de que estás a salvo.

Si estás pensando en hacerte daño, por favor contacta ahora con:
- **024** — Línea de Atención a la Conducta Suicida (gratuita, 24h)
- **112** — Emergencias

No tienes que estar solo/a con esto. ¿Puedes contarme cómo te sientes en este momento?`
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/
git commit -m "feat: LLM portability layer (config, models, prompts)"
```

---

## Task 23: Supabase clients

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Write browser client**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Write server clients**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createAuthenticatedClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export function createServiceRoleClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat: supabase browser and server clients with type safety"
```

---

## Task 24: Base app layout and providers

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/providers.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write providers component**

Create `components/providers.tsx`:

```tsx
'use client'

import { Toaster } from '@/components/ui/toaster'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
```

- [ ] **Step 2: Update root layout**

Replace contents of `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Serenia',
  description: 'Apoyo conversacional para ansiedad y depresión',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Update home page placeholder**

Replace contents of `app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-slate-800">Serenia</h1>
        <p className="mt-2 text-slate-500">Plan 2: Auth &amp; onboarding coming next.</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```

Expected: build succeeds, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/ components/providers.tsx
git commit -m "feat: base app layout with providers and placeholder home"
```

---

## Task 25: Final verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all clinical tests pass (PHQ-9, GAD-7, ASQ, risk-rules, severity).

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: 0 errors, 0 TS errors.

- [ ] **Step 3: Check TypeScript strict**

```bash
npx tsc --noEmit --strict
```

Expected: 0 errors.

- [ ] **Step 4: Reset DB and verify seed**

```bash
npx supabase db reset
```

Expected: all 10 migrations applied, seed runs without errors, `PHQ9 9 items / GAD7 7 items / ASQ 5 items`.

- [ ] **Step 5: Verify Supabase types are up to date**

```bash
npx supabase gen types typescript --local > /tmp/types-check.ts
diff /tmp/types-check.ts lib/supabase/types.ts
```

Expected: no diff (types are current).

- [ ] **Step 6: Final commit**

```bash
git add -A
git status
git commit -m "feat: Plan 1 foundations complete — schema, clinical scoring, LLM layer"
```

---

## Deliverables

After Plan 1 is complete you have:
- ✅ Running Next.js 16 app with shadcn
- ✅ Supabase schema: 10 migrations, all tables, RLS, GDPR erase RPC
- ✅ Questionnaire seed data: PHQ-9 (9 items), GAD-7 (7 items), ASQ (5 items)
- ✅ Clinical scoring modules, unit-tested (PHQ-9, GAD-7, ASQ, severity, risk-rules)
- ✅ LLM portability layer: `lib/llm/` with roles, config, system prompt skeleton
- ✅ Supabase typed clients (browser + server + service-role)
- ✅ `MessagePart` Zod discriminated union

**Next:** Plan 2 — Auth & onboarding (login, register, consent, age gate).
