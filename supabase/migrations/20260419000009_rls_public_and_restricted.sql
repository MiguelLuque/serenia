-- supabase/migrations/20260419000009_rls_public_and_restricted.sql

-- Questionnaire definitions + items: read to all authenticated users
alter table questionnaire_definitions enable row level security;
alter table questionnaire_items enable row level security;

create policy "questionnaire_definitions_read_authenticated"
  on questionnaire_definitions for select
  to authenticated
  using (is_active = true);

create policy "questionnaire_items_read_authenticated"
  on questionnaire_items for select
  to authenticated
  using (true);

-- v1.5 tables: deny all (no authenticated client access in MVP)
alter table clinicians enable row level security;
alter table user_clinician_assignments enable row level security;
alter table clinician_reviews enable row level security;
alter table care_plans enable row level security;

create policy "clinicians_deny_all" on clinicians for all using (false);
create policy "assignments_deny_all" on user_clinician_assignments for all using (false);
create policy "reviews_deny_all" on clinician_reviews for all using (false);
create policy "care_plans_deny_all" on care_plans for all using (false);
