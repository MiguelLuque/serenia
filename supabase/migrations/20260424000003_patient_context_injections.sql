-- supabase/migrations/20260424000003_patient_context_injections.sql
--
-- Plan 6 T10: audit trail of every patient-context injection into /api/chat.
--
-- Each row records the decision the aggregator produced when building the
-- system prompt for a turn: tier selection, risk derivation, pending-task
-- count, block size after truncation, and the id of the validated assessment
-- (if any) that drove tierA/historic context. Writes are service-role-only
-- (there is no INSERT RLS policy); reads are clinician-only.

create table patient_context_injections (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references auth.users(id) on delete cascade,
  session_id                      uuid not null references clinical_sessions(id) on delete cascade,
  created_at                      timestamptz not null default now(),
  tier                            text not null check (tier in ('none','historic','tierB','tierA')),
  risk_state                      text not null check (risk_state in ('none','watch','active','acute')),
  block_char_count                integer not null,
  pending_tasks_count             integer not null,
  risk_triggered                  boolean not null,
  last_validated_assessment_id    uuid references assessments(id) on delete set null,
  truncated_sections              text[] not null default '{}'
);

create index idx_pci_user
  on patient_context_injections(user_id, created_at desc);

alter table patient_context_injections enable row level security;

-- Clinicians may read all injection logs (audit trail).
create policy pci_select_clinician on patient_context_injections
  for select using (is_clinician());

-- No INSERT policy → writes only via service role (lib/patient-context/telemetry.ts).
