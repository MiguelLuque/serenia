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
