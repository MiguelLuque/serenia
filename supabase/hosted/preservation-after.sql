
-- No row transformation is authorized by this schema packet.
do $preserved$
declare original record; total bigint; digest text;
begin
  for original in select * from pg_temp.serenia_preservation loop
    execute format($q$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex')
      from (select encode(sha256(convert_to($1 || to_jsonb(r)::text,'UTF8')),'hex') row_hash from %s r) x$q$,original.relation_name)
      into total,digest using original.nonce;
    if total<>original.expected_count or digest<>original.aggregate_sha256 then
      raise exception 'Hosted account/catalog preservation failed; transaction must roll back';
    end if;
  end loop;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then
    raise exception 'Public table missing RLS';
  end if;
  if has_function_privilege('anon','public.handle_new_auth_user()','EXECUTE')
    or has_function_privilege('authenticated','public.handle_new_auth_user()','EXECUTE')
    or has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
    or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') then
    raise exception 'Trigger function client EXECUTE remains';
  end if;
end;
$preserved$;
