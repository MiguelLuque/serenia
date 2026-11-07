-- Business conflicts are terminal decisions, not PostgreSQL serialization failures.
-- PostgREST 14 retries 40001 internally; PT409 returns a reloadable HTTP conflict.
-- Forward only: refuse drift and preserve every routine's API, owner and ACL.
do $profile_conflicts$
declare expected record; routine pg_proc%rowtype; routine_id oid; before_metadata jsonb; definition text;
begin
 for expected in select * from (values
  ('public.review_profile_observation(uuid,text,timestamptz)','review_profile_observation','303c0266096ff91a18407264f5274567','45f8e4a112cfe356f01d9331f72b7775','388738c656736cb0d5e738b5187de4ef','93f0b7d6025000bfd7bbcfacc724c6eb','void',array['postgres=X/postgres','authenticated=X/postgres']::text[],2),
  ('public.start_profile_job(uuid,uuid)','start_profile_job','f60f672eaf906f202a8ba2c39220d312','a9b68aa353cb81e2cf8ff133e15adc9e','a47e4b02473adbfe0758dda6d3164d99','f92b49a7134bfb815a6c202ad28f785a','boolean',array['postgres=X/postgres','service_role=X/postgres']::text[],1),
  ('public.update_profile_job(uuid,uuid,text,text)','update_profile_job','a1776a28d9f37bb3d17f3bb08c6d63df','6fb05f0519fd5207886cbc0e61c4f6ea','52a452c3a58da9be382f8f336795e412','d885f6fb32ba616ba2d9cc5f2766fef5','void',array['postgres=X/postgres','service_role=X/postgres']::text[],1)
 ) as baseline(signature,name,source_md5,definition_md5,new_source_md5,new_definition_md5,return_type,acl,code_count)
 loop
  routine_id=to_regprocedure(expected.signature);
  if routine_id is null or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname=expected.name)<>1 then
   raise exception 'Unexpected profile conflict routine: %',expected.name;
  end if;
  select * into routine from pg_proc where oid=routine_id;
  if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef or routine.proretset
   or routine.prorettype<>expected.return_type::regtype or routine.provolatile<>'v'
   or routine.prolang<>(select oid from pg_language where lanname='plpgsql')
   or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
   or routine.proacl is distinct from expected.acl::aclitem[]
   or md5(routine.prosrc)<>expected.source_md5
   or md5(pg_get_functiondef(routine_id))<>expected.definition_md5
   or (length(routine.prosrc)-length(replace(routine.prosrc,'errcode=''40001''','')))/length('errcode=''40001''')<>expected.code_count then
   raise exception 'Unexpected profile conflict baseline: %',expected.name;
  end if;
  before_metadata=to_jsonb(routine)-'prosrc';
  definition=replace(pg_get_functiondef(routine_id),'errcode=''40001''','errcode=''PT409''');
  execute definition;
  select * into routine from pg_proc where oid=routine_id;
  if to_jsonb(routine)-'prosrc' is distinct from before_metadata
   or md5(routine.prosrc)<>expected.new_source_md5
   or md5(pg_get_functiondef(routine_id))<>expected.new_definition_md5 then
   raise exception 'Profile conflict changed an unexpected contract: %',expected.name;
  end if;
 end loop;
end;
$profile_conflicts$;
