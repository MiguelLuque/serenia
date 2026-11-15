-- Single atomic Management query only. No target mutation or transaction split.
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, pg_temp;
lock table auth.users, supabase_migrations.schema_migrations in share row exclusive mode;
create temporary table profile_baseline(expected jsonb not null, expected_new jsonb not null) on commit drop;
revoke all on table pg_temp.profile_baseline from public, anon, authenticated, service_role;
insert into pg_temp.profile_baseline values ('@@BASELINE@@'::jsonb, '@@NEW_OBJECTS@@'::jsonb);
create function pg_temp.profile_snapshot(p_old_only boolean) returns jsonb language sql as $snapshot$
@@SNAPSHOT_QUERY@@
$snapshot$;
revoke all on function pg_temp.profile_snapshot(boolean) from public, anon, authenticated, service_role;
create function pg_temp.profile_new_metadata() returns jsonb language sql as $new_metadata$
@@NEW_OBJECTS_QUERY@@
$new_metadata$;
revoke all on function pg_temp.profile_new_metadata() from public, anon, authenticated, service_role;
create temporary table profile_preservation(relation_name text primary key, expected_count bigint not null, aggregate_sha256 text not null, nonce text not null) on commit drop;
revoke all on table pg_temp.profile_preservation from public, anon, authenticated, service_role;
do $profile_before$
declare expected jsonb; actual jsonb; rel text; total bigint; digest text;
  secret_nonce text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  if current_setting('server_version_num')::integer not between 170000 and 179999 then raise exception 'Profile packet requires PostgreSQL 17'; end if;
  select b.expected into expected from pg_temp.profile_baseline b;
  -- Lock all old tables, including worker queues and every empty clinical table.
  for rel in select jsonb_array_elements_text(expected->'tableNames') order by 1 loop
    execute format('lock table public.%I in share row exclusive mode',rel);
  end loop;
  actual := pg_temp.profile_snapshot(false);
  if actual->'history' is distinct from expected->'history' then raise exception 'Profile history baseline changed'; end if;
  if actual->'catalog' is distinct from expected->'catalog' then raise exception 'Profile catalog baseline changed'; end if;
  if actual->'platform' is distinct from expected->'platform' then raise exception 'Profile platform baseline changed'; end if;
  if actual->'counts' is distinct from expected->'counts' then raise exception 'Profile counts baseline changed'; end if;
  if actual->'clinicalCounts' is distinct from expected->'clinicalCounts' then raise exception 'Profile clinical baseline changed'; end if;
  if actual->'tableNames' is distinct from expected->'tableNames' or actual->'tableFingerprint' is distinct from expected->'tableFingerprint' then raise exception 'Profile old table baseline changed'; end if;
  if actual->'routineSignatures' is distinct from expected->'routineSignatures' or actual->'routineFingerprint' is distinct from expected->'routineFingerprint' then raise exception 'Profile old routine baseline changed'; end if;
  if actual->'profileObjectsAbsent' is distinct from 'true'::jsonb
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
      ('profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source','validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs','lock_profile_job','start_profile_job','update_profile_job','finish_profile_job','review_profile_observation','get_profile_memory_page'))
    or exists(select 1 from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where co.conname='profile_source_identity' and n.nspname='public')
    or to_regclass('public.profile_source_identity') is not null
    or exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname in ('profile_source_immutable','enqueue_profile_source')) then
    raise exception 'Profile added object already exists';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then raise exception 'Profile public table missing RLS'; end if;
  foreach rel in array array['auth.users','public.user_profiles','public.questionnaire_definitions','public.questionnaire_items'] loop
    execute format($q$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex')
      from (select encode(sha256(convert_to($1 || to_jsonb(r)::text,'UTF8')),'hex') row_hash from %s r) x$q$,rel)
      into total,digest using secret_nonce;
    insert into pg_temp.profile_preservation values(rel,total,digest,secret_nonce);
  end loop;
end;
$profile_before$;
