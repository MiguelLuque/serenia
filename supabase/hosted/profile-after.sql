
-- PROFILE PRESERVATION CHECK: no row transformation is authorized.
do $profile_after$
declare expected jsonb; actual jsonb; original record; total bigint; digest text;
  rel text; role_name text; privilege_name text; routine record; expected_execute boolean;
  new_tables text[] := array['profile_extraction_jobs','profile_observations','profile_settings'];
  owner_rpcs text[] := array['set_profile_enabled','get_profile_memory','get_profile_memory_page','review_profile_observation'];
  worker_rpcs text[] := array['claim_profile_jobs','start_profile_job','update_profile_job','finish_profile_job'];
  new_routines text[] := array['profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source','validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs','lock_profile_job','start_profile_job','update_profile_job','finish_profile_job','review_profile_observation','get_profile_memory_page'];
begin
  select b.expected into expected from pg_temp.profile_baseline b;
  for original in select * from pg_temp.profile_preservation loop
    execute format($q$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex')
      from (select encode(sha256(convert_to($1 || to_jsonb(r)::text,'UTF8')),'hex') row_hash from %s r) x$q$,original.relation_name)
      into total,digest using original.nonce;
    if total<>original.expected_count or digest<>original.aggregate_sha256 then raise exception 'Profile account/catalog preservation failed'; end if;
  end loop;
  actual := pg_temp.profile_snapshot(true);
  if actual->'history' is distinct from expected->'history' then raise exception 'Profile history preservation failed'; end if;
  if actual->'platform' is distinct from expected->'platform' then raise exception 'Profile platform preservation failed'; end if;
  if actual->'catalog' is distinct from expected->'catalog' or actual->'counts' is distinct from expected->'counts' or actual->'clinicalCounts' is distinct from expected->'clinicalCounts' then raise exception 'Profile data baseline preservation failed'; end if;
  if actual->'tableNames' is distinct from expected->'tableNames' or actual->'tableFingerprint' is distinct from expected->'tableFingerprint' then raise exception 'Profile old table preservation failed'; end if;
  if actual->'routineSignatures' is distinct from expected->'routineSignatures' or actual->'routineFingerprint' is distinct from expected->'routineFingerprint' then raise exception 'Profile old routine preservation failed'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')) <> jsonb_array_length(expected->'tableNames')+3
    or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then raise exception 'Profile table set/RLS mismatch'; end if;
  foreach rel in array new_tables loop
    execute format('select count(*) from public.%I',rel) into total;
    if total<>0 then raise exception 'Profile default data must remain empty'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
        if has_table_privilege(role_name,format('public.%I',rel),privilege_name) is distinct from
          (privilege_name='SELECT' and (role_name='service_role' or (role_name='authenticated' and rel<>'profile_extraction_jobs'))) then raise exception 'Profile table ACL mismatch'; end if;
      end loop;
    end loop;
    if exists(select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid=format('public.%I',rel)::regclass and a.grantee=0) then raise exception 'Profile PUBLIC table ACL remains'; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f') <> jsonb_array_length(expected->'routineSignatures')+14 then raise exception 'Profile function set mismatch'; end if;
  for routine in select p.*,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(new_routines) loop
    if pg_get_userbyid(routine.proowner)<>'postgres' or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
      or routine.prosecdef is distinct from (routine.proname not in ('profile_message_text','validate_profile_source','validate_profile_observation'))
      or pg_get_functiondef(routine.oid) ~* 'errcode\s*=\s*''40001''' then raise exception 'Profile function security/source mismatch'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      expected_execute := (role_name='authenticated' and routine.proname=any(owner_rpcs)) or (role_name='service_role' and routine.proname=any(worker_rpcs));
      if has_function_privilege(role_name,routine.oid,'EXECUTE') is distinct from expected_execute then raise exception 'Profile function ACL mismatch'; end if;
    end loop;
    if exists(select 1 from aclexplode(coalesce(routine.proacl,acldefault('f',routine.proowner))) a where a.grantee=0) then raise exception 'Profile PUBLIC function EXECUTE remains'; end if;
  end loop;
  if not exists(select 1 from pg_constraint where conrelid='public.messages'::regclass and conname='profile_source_identity' and contype='u')
    or (select count(*) from pg_trigger where tgrelid='public.messages'::regclass and tgname in ('profile_source_immutable','enqueue_profile_source') and tgenabled='O')<>2 then raise exception 'Profile message additions missing'; end if;
  if exists(select 1 from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and co.conname='profile_source_identity' and co.conrelid<>'public.messages'::regclass)
    or exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname in ('profile_source_immutable','enqueue_profile_source') and t.tgrelid<>'public.messages'::regclass) then raise exception 'Profile excluded-name collision'; end if;
  -- Includes exact new columns/defaults/constraints/indexes/policies/triggers,
  -- function signatures/source/ACL/config and both authorized message bindings.
  if pg_temp.profile_new_metadata() is distinct from (select expected_new from pg_temp.profile_baseline) then raise exception 'Profile new object metadata mismatch'; end if;
end;
$profile_after$;
