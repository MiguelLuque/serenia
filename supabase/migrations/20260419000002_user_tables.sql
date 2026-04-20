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
  active_care_plan_id    uuid,
  last_reviewed_assessment_id uuid,
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
