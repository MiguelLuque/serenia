-- Función helper: ¿el usuario actual es clínico?
create or replace function is_clinician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_profiles
    where user_id = auth.uid() and role = 'clinician'
  );
$$;

-- Política adicional: clínicos leen todos los user_profiles.
create policy "user_profiles_select_clinician"
  on user_profiles for select
  using (is_clinician());
