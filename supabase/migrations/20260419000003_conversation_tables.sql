-- supabase/migrations/20260419000003_conversation_tables.sql

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text,
  status          conversation_status not null default 'active',
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  latest_session_summary_id uuid,
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
  summary_id      uuid,
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

create index idx_messages_conversation_id on messages(conversation_id);
create index idx_messages_created_at on messages(created_at);
create index idx_clinical_sessions_conversation_id on clinical_sessions(conversation_id);
