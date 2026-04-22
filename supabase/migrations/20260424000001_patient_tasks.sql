-- supabase/migrations/20260424000001_patient_tasks.sql
--
-- Plan 6 T1: patient_tasks table
--
-- Stores therapeutic task agreements made during clinician-reviewed sessions.
-- Lifecycle-tracked via `estado` (patient_task_status enum); logical deletion
-- uses estado='no_abordada' — no hard-delete policy is intentional.
-- Related to clinical_sessions and assessments (acordada_en / closed_by).
--

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

create type patient_task_status as enum
  ('pendiente','cumplida','parcial','no_realizada','no_abordada');

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table patient_tasks (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  acordada_en_session_id    uuid not null references clinical_sessions(id) on delete cascade,
  acordada_en_assessment_id uuid not null references assessments(id) on delete cascade,
  descripcion               text not null check (char_length(descripcion) between 3 and 500),
  nota                      text check (nota is null or char_length(nota) <= 300),
  estado                    patient_task_status not null default 'pendiente',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  closed_at                 timestamptz,
  closed_by_assessment_id   uuid references assessments(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_patient_tasks_user_open
  on patient_tasks(user_id, created_at desc)
  where estado in ('pendiente','parcial');

create index idx_patient_tasks_session
  on patient_tasks(acordada_en_session_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses existing set_updated_at() function)
-- ---------------------------------------------------------------------------

create trigger trg_patient_tasks_updated_at
  before update on patient_tasks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table patient_tasks enable row level security;

create policy patient_tasks_select_own on patient_tasks
  for select using (user_id = auth.uid());

create policy patient_tasks_select_clinician on patient_tasks
  for select using (is_clinician());

create policy patient_tasks_insert_clinician on patient_tasks
  for insert with check (is_clinician());

create policy patient_tasks_update_clinician on patient_tasks
  for update using (is_clinician()) with check (is_clinician());

-- No delete policy: estado 'no_abordada' covers logical deletion.
