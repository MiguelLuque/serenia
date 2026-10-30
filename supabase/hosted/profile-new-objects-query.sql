with new_tables as (
 select c.relname as name,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.relacl::text as acl,
  (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select jsonb_agg(jsonb_build_object('name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by co.conname) from pg_constraint co where co.conrelid=c.oid) as constraints,
  (select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers,
  (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
  (select jsonb_agg(jsonb_build_object('name',i.relname,'definition',pg_get_indexdef(i.oid)) order by i.relname) from pg_index ix join pg_class i on i.oid=ix.indexrelid where ix.indrelid=c.oid) as indexes
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname in ('profile_settings','profile_extraction_jobs','profile_observations')
), new_routines as (
 select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as signature,pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.provolatile as volatility,l.lanname as language,p.proconfig as config,p.proacl::text as acl,md5(pg_get_functiondef(p.oid)) as definition_md5
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prokind='f' and p.proname in ('profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source','validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs','lock_profile_job','start_profile_job','update_profile_job','finish_profile_job','review_profile_observation','get_profile_memory_page')
)
select jsonb_build_object(
 'tables',(select jsonb_agg(to_jsonb(t) order by name) from new_tables t),
 'routines',(select jsonb_agg(to_jsonb(r) order by signature) from new_routines r),
 'messageConstraint',(select jsonb_build_object('definition',pg_get_constraintdef(co.oid),'validated',co.convalidated,'deferrable',co.condeferrable,'deferred',co.condeferred) from pg_constraint co where co.conrelid='public.messages'::regclass and co.conname='profile_source_identity'),
 'messageIndex',(select pg_get_indexdef(i.oid) from pg_class i join pg_namespace n on n.oid=i.relnamespace where n.nspname='public' and i.relname='profile_source_identity'),
 'messageTriggers',(select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid='public.messages'::regclass and t.tgname in ('profile_source_immutable','enqueue_profile_source'))
);
