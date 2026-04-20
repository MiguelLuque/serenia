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
