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
