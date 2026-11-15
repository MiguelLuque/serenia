-- Forward-only I1 fix: retain rejected targets while confirming their later source.
-- Fail closed against the reviewed baseline; preserve signature, owner and grants.
do $guard$
declare routine record; routine_id oid;
begin
 routine_id=to_regprocedure('public.review_profile_observation(uuid,text,timestamptz)');
 if routine_id is null or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='review_profile_observation')<>1 then
  raise exception 'Unexpected profile review forward baseline';
 end if;
 select * into routine from pg_proc where oid=routine_id;
 if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef
  or routine.prorettype<>'void'::regtype or routine.proretset or routine.provolatile<>'v'
  or routine.prolang<>(select oid from pg_language where lanname='plpgsql')
  or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or routine.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres']::aclitem[]
  or md5(routine.prosrc)<>'7b88b47b6bd68b6a10b47134e082033e'
  or md5(pg_get_functiondef(routine_id))<>'8e334461d08720096d2e740fedfe8ec7' then
  raise exception 'Unexpected profile review forward baseline';
 end if;
end;
$guard$;
create or replace function review_profile_observation(p_observation_id uuid,p_action text,p_expected_updated_at timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare o profile_observations%rowtype; target profile_observations%rowtype;
begin
 if auth.uid() is null then raise exception 'Authenticated owner required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('confirm','reject') then raise exception 'Profile review action invalid' using errcode='23514'; end if;
 -- Reviews remain available after opt-out; keep the same mutex as extraction.
 perform 1 from profile_settings where user_id=auth.uid() for update;
 select * into o from profile_observations where id=p_observation_id and user_id=auth.uid() for update;
 if not found then raise exception 'Owned profile observation required' using errcode='42501'; end if;
 if p_expected_updated_at is distinct from o.updated_at or o.status not in ('pending','confirmed') or (p_action='confirm' and o.status<>'pending') then
  raise exception 'Profile observation changed; reload' using errcode='40001';
 end if;
 if p_action='confirm' and o.supersedes_id is not null then
  select * into target from profile_observations where id=o.supersedes_id and user_id=o.user_id for update;
  if not found or target.status not in ('confirmed','rejected') or target.category<>o.category or target.source_created_at>=o.source_created_at then
   raise exception 'Profile correction changed; reload' using errcode='40001';
  end if;
  -- Keep a rejected target and its version as evidence of the owner's review.
  update profile_observations set status='superseded',updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond')
   where (id=target.id and status='confirmed')
    or (supersedes_id=target.id and user_id=o.user_id and status='pending' and id<>o.id);
 end if;
 update profile_observations set status=case when p_action='confirm' then 'confirmed' else 'rejected' end,updated_at=greatest(clock_timestamp(),o.updated_at+interval '1 microsecond') where id=o.id;
end $$;

do $verified$
declare routine record;
begin
 select * into routine from pg_proc where oid='public.review_profile_observation(uuid,text,timestamptz)'::regprocedure;
 if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef
  or routine.prorettype<>'void'::regtype or routine.proretset or routine.provolatile<>'v'
  or routine.prolang<>(select oid from pg_language where lanname='plpgsql')
  or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or routine.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres']::aclitem[]
  or md5(routine.prosrc)<>'303c0266096ff91a18407264f5274567' then
  raise exception 'Profile review forward changed an unexpected contract';
 end if;
end;
$verified$;
