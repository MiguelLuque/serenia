-- Plan 6 T7: Partial indexes for buildPatientContext aggregator queries.
-- Each matches a specific query in lib/patient-context/builder.ts.

-- Query 1/2: assessments por paciente ordenados por reviewed_at, filtrados por status
create index if not exists idx_assessments_user_reviewed
  on assessments(user_id, reviewed_at desc)
  where status in ('reviewed_confirmed','reviewed_modified');

-- Query 2: draft más reciente por paciente
create index if not exists idx_assessments_user_session_status
  on assessments(user_id, session_id)
  where status in ('draft_ai','rejected');

-- Query 5: última sesión cerrada por paciente
create index if not exists idx_clinical_sessions_user_closed
  on clinical_sessions(user_id, closed_at desc)
  where status = 'closed';

-- Query 4: risk events abiertos por paciente
create index if not exists idx_risk_events_user_open
  on risk_events(user_id, created_at desc)
  where status = 'open';
