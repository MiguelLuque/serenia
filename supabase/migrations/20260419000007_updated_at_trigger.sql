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
