-- Expected ACL between the expand and contract closure migrations.
do $$
declare expected record;
begin
  for expected in
    select * from (values
      ('public.close_session_atomic(uuid,uuid,text)', 'authenticated', true,  'Expansion removed authenticated access required by the current app'),
      ('public.close_session_atomic(uuid,uuid,text)', 'anon',          false, 'Anonymous role can call the legacy closure RPC'),
      ('public.close_session_atomic(uuid,uuid,text)', 'service_role',  true,  'Expansion removed service_role access required by internal cleanup'),
      ('public.close_session_from_chat_view(uuid,text,text,integer)', 'authenticated', true,  'Authenticated role cannot call the new serialized closure RPC'),
      ('public.close_session_from_chat_view(uuid,text,text,integer)', 'anon',          false, 'Anonymous role can call the new serialized closure RPC'),
      ('public.close_session_from_chat_view(uuid,text,text,integer)', 'service_role',  false, 'service_role should not call the patient-facing closure RPC')
    ) as t(fn, role_name, allowed, message)
  loop
    if has_function_privilege(expected.role_name, expected.fn, 'EXECUTE') is distinct from expected.allowed then
      raise exception '%', expected.message;
    end if;
  end loop;
end $$;
