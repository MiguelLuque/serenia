-- Contract phase only: apply after the app using close_session_from_chat_view
-- is deployed and its patient closure flow passes runtime verification.
do $contract$
declare
  legacy regprocedure := to_regprocedure('public.close_session_atomic(uuid,uuid,text)');
  view_rpc regprocedure := to_regprocedure('public.close_session_from_chat_view(uuid,text,text,integer)');
begin
  if legacy is null
     or not has_function_privilege('authenticated', legacy, 'EXECUTE')
     or not has_function_privilege('service_role', legacy, 'EXECUTE') then
    raise exception 'Unexpected legacy session-close RPC contract';
  end if;
  if view_rpc is null
     or not has_function_privilege('authenticated', view_rpc, 'EXECUTE')
     or has_function_privilege('anon', view_rpc, 'EXECUTE') then
    raise exception 'Serialized patient closure RPC is unavailable or overexposed';
  end if;
end
$contract$;

revoke all on function public.close_session_atomic(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.close_session_atomic(uuid,uuid,text) to service_role;
