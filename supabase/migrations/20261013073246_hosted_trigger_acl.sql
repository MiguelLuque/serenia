-- Trigger-only routines are not Data API contracts. Preserve platform creators
-- and service_role; do not create the hosted-only event trigger on local installs.
do $acl$
declare routine record;
begin
  if (select count(*) from pg_proc f join pg_namespace n on n.oid=f.pronamespace
      where n.nspname='public' and f.proname='handle_new_auth_user') <> 1 then
    raise exception 'Unexpected Auth trigger routine signatures';
  end if;
  select * into routine from pg_proc where oid='public.handle_new_auth_user()'::regprocedure;
  if pg_get_userbyid(routine.proowner)<>'postgres' or routine.prorettype<>'trigger'::regtype
    or not routine.prosecdef or routine.proconfig is distinct from array['search_path=public']::text[]
    or md5(routine.prosrc)<>'80b4cef3633f554d4c9aedcb4c57702f'
    or (select count(*) from pg_trigger t where t.tgrelid='auth.users'::regclass
        and t.tgname='on_auth_user_created' and t.tgfoid=routine.oid
        and t.tgenabled='O' and t.tgtype=5 and not t.tgisinternal)<>1 then
    raise exception 'Unexpected Auth trigger definition/binding';
  end if;
  grant execute on function public.handle_new_auth_user() to service_role;
  -- Vanilla PG regression/fresh local bootstrap may omit platform roles.
  if exists(select 1 from pg_roles where rolname='supabase_auth_admin') then
    grant execute on function public.handle_new_auth_user() to supabase_auth_admin;
  end if;
  if exists(select 1 from pg_roles where rolname='supabase_admin') then
    grant execute on function public.handle_new_auth_user() to supabase_admin;
  end if;
  grant execute on function public.handle_new_auth_user() to postgres;
  revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

  if to_regprocedure('public.rls_auto_enable()') is null then
    if exists(select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace
      where n.nspname='public' and f.proname='rls_auto_enable')
      or exists(select 1 from pg_event_trigger where evtname='ensure_rls') then
      raise exception 'Unexpected hosted event trigger signature';
    end if;
    return;
  end if;
  if (select count(*) from pg_proc f join pg_namespace n on n.oid=f.pronamespace
      where n.nspname='public' and f.proname='rls_auto_enable')<>1 then
    raise exception 'Unexpected hosted event routine signatures';
  end if;
  select * into routine from pg_proc where oid='public.rls_auto_enable()'::regprocedure;
  if pg_get_userbyid(routine.proowner)<>'postgres' or routine.prorettype<>'event_trigger'::regtype
    or not routine.prosecdef or routine.proconfig is distinct from array['search_path=pg_catalog']::text[]
    or md5(routine.prosrc)<>'99be20677b456ea8d3be47bdd44fb369'
    or (select count(*) from pg_event_trigger e where e.evtname='ensure_rls'
      and e.evtevent='ddl_command_end' and e.evtenabled='O' and e.evtfoid=routine.oid
      and pg_get_userbyid(e.evtowner)='postgres'
      and e.evttags is not distinct from array['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[])<>1 then
    raise exception 'Unexpected hosted event trigger definition/binding';
  end if;
  grant execute on function public.rls_auto_enable() to postgres, service_role;
  if exists(select 1 from pg_roles where rolname='supabase_admin') then
    grant execute on function public.rls_auto_enable() to supabase_admin;
  end if;
  if exists(select 1 from pg_roles where rolname='supabase_auth_admin') then
    grant execute on function public.rls_auto_enable() to supabase_auth_admin;
  end if;
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
end;
$acl$;
