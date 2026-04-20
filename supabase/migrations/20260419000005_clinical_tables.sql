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
