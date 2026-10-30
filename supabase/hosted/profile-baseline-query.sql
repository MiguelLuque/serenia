with tables_snapshot as (
 select c.relname as name,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.relacl::text as acl,
  (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select jsonb_agg(jsonb_build_object('name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by co.conname) from pg_constraint co where co.conrelid=c.oid and co.conname<>'profile_source_identity') as constraints,
  (select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal and t.tgname not in ('profile_source_immutable','enqueue_profile_source')) as triggers,
  (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
  (select jsonb_agg(jsonb_build_object('name',i.relname,'definition',pg_get_indexdef(i.oid)) order by i.relname) from pg_index ix join pg_class i on i.oid=ix.indexrelid where ix.indrelid=c.oid and i.relname<>'profile_source_identity') as indexes
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')
), routines_snapshot as (
 select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as signature,pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.provolatile as volatility,l.lanname as language,p.proconfig as config,p.proacl::text as acl,md5(pg_get_functiondef(p.oid)) as definition_md5
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prokind='f'
), catalog_snapshot as (
 select d.code,encode(sha256(convert_to((to_jsonb(d)-'id'-'created_at'-'updated_at')::text,'UTF8')),'hex') as definition_sha256,
 (select count(*) from public.questionnaire_items i where i.questionnaire_id=d.id) as items,
 (select encode(sha256(convert_to(coalesce(string_agg((to_jsonb(i)-'id'-'questionnaire_id'-'created_at'-'updated_at')::text,E'\n' order by i.order_index),''),'UTF8')),'hex') from public.questionnaire_items i where i.questionnaire_id=d.id) as items_sha256
 from public.questionnaire_definitions d
)
select jsonb_build_object(
 'history',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_md5',md5(array_to_string(statements,E'\n'))) order by version) from supabase_migrations.schema_migrations),
 'catalog',(select jsonb_agg(to_jsonb(x) order by code) from catalog_snapshot x),
 'tableNames',(select jsonb_agg(name order by name) from tables_snapshot),
 'tableFingerprint',(select md5(jsonb_agg(to_jsonb(t) order by name)::text) from tables_snapshot t),
 'routineSignatures',(select jsonb_agg(signature order by signature) from routines_snapshot),
 'routineFingerprint',(select md5(jsonb_agg(to_jsonb(r) order by signature)::text) from routines_snapshot r),
 'platform',jsonb_build_object('authOwner',pg_get_userbyid((select relowner from pg_class where oid='auth.users'::regclass)),
  'rlsRoutine',(select to_jsonb(r) from routines_snapshot r where signature='public.rls_auto_enable()'),
  'eventTriggers',(select jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'enabled',e.evtenabled,'tags',e.evttags,'function',e.evtfoid::regprocedure::text,'owner',pg_get_userbyid(e.evtowner)) order by e.evtname) from pg_event_trigger e),
  'authTriggers',(select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid='auth.users'::regclass and not t.tgisinternal)),
 'counts',jsonb_build_object('auth', (select count(*) from auth.users),'profiles',(select count(*) from public.user_profiles),'definitions',(select count(*) from public.questionnaire_definitions),'items',(select count(*) from public.questionnaire_items)),
 'clinicalCounts',(select jsonb_build_object('assessments',(select count(*) from public.assessments),'audit_log',(select count(*) from public.audit_log),'care_plans',(select count(*) from public.care_plans),'clinical_sessions',(select count(*) from public.clinical_sessions),'clinician_reviews',(select count(*) from public.clinician_reviews),'clinicians',(select count(*) from public.clinicians),'consents',(select count(*) from public.consents),'conversations',(select count(*) from public.conversations),'messages',(select count(*) from public.messages),'patient_context_injections',(select count(*) from public.patient_context_injections),'patient_tasks',(select count(*) from public.patient_tasks),'questionnaire_answers',(select count(*) from public.questionnaire_answers),'questionnaire_instances',(select count(*) from public.questionnaire_instances),'questionnaire_results',(select count(*) from public.questionnaire_results),'risk_events',(select count(*) from public.risk_events),'session_summaries',(select count(*) from public.session_summaries),'user_clinician_assignments',(select count(*) from public.user_clinician_assignments))),
 'profileObjectsAbsent',to_regclass('public.profile_settings') is null and to_regclass('public.profile_extraction_jobs') is null and to_regclass('public.profile_observations') is null and to_regprocedure('public.get_profile_memory()') is null and to_regprocedure('public.get_profile_memory_page(timestamptz,uuid)') is null
) as baseline;
