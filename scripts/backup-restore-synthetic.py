#!/usr/bin/env python3
"""Synthetic-only logical backup/restore across two disposable PostgreSQL 17s.

No hosted access, real credentials, live data, host mounts or container network.
Logical dump bytes are kept only in process memory; output contains no rows.
"""
import hashlib
import json
import pathlib
import sys
import time
import types

runtime_path = pathlib.Path(__file__).resolve().parents[1] / 'tests/tooling/chronology_local_docker.py'
if runtime_path.is_symlink():
    raise RuntimeError('Unexpected Docker runtime path')
runtime_bytes = runtime_path.read_bytes()
if hashlib.sha256(runtime_bytes).hexdigest() != '112d9e08f7aa758c99d676237ee25e4c98bbc6f70bd03d0f9cc6a809eefb776d':
    raise RuntimeError('Unexpected Docker runtime content')
runtime_module = types.ModuleType('serenia_free_backup_runtime')
exec(compile(runtime_bytes, str(runtime_path), 'exec'), runtime_module.__dict__)
LocalDocker = runtime_module.LocalDocker

source = None
target = None
source_id = None
target_id = None

def run(runtime, cid, program, *args, data=None, check=True):
    command = ['exec'] + (['-i'] if data is not None else []) + [cid, program, *args]
    result = runtime.command(*command, sql=data, check=False)
    if check and result.returncode:
        # All content is synthetic; never dump SQL, data, environment or errors.
        raise RuntimeError(f'{program} failed with exit {result.returncode}')
    return result

def sql(runtime, cid, statement, check=True):
    return run(runtime, cid, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
               '-U', 'postgres', '-d', 'postgres', data=statement, check=check)

def await_ready(runtime, cid):
    for _ in range(80):
        if run(runtime,cid,'pg_isready','-h','127.0.0.1','-U','postgres',check=False).returncode == 0:
            return
        time.sleep(.25)
    raise RuntimeError('Synthetic PostgreSQL did not start')

def dump(runtime, cid, *args):
    result = run(runtime,cid,'pg_dump','-U','postgres','-d','postgres',*args)
    if not result.stdout or len(result.stdout.encode()) > 2_000_000:
        raise RuntimeError('Synthetic dump empty or unexpectedly large')
    return result.stdout

def restore(runtime, cid, contents, replica=False):
    prefix = 'SET session_replication_role=replica;\n' if replica else ''
    run(runtime,cid,'psql','-X','-q','-v','ON_ERROR_STOP=1','--single-transaction',
        '-U','postgres','-d','postgres',data=prefix + contents)

fixture = r"""
CREATE ROLE probe_member NOLOGIN;
CREATE ROLE probe_clinician NOLOGIN;
CREATE ROLE probe_worker NOLOGIN;
GRANT probe_member TO probe_clinician;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA supabase_migrations;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text NOT NULL, synthetic_hash text NOT NULL);
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id), label text NOT NULL);
CREATE TABLE public.patient_events(id bigint PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id), content text NOT NULL);
CREATE TABLE storage.objects(id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, name text NOT NULL, statements text[] NOT NULL);
CREATE FUNCTION public.fixture_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.profiles VALUES (NEW.id,'synthetic'); RETURN NEW; END $$;
CREATE TRIGGER fixture_auth_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fixture_profile();
ALTER TABLE public.patient_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY probe_own ON public.patient_events FOR SELECT TO probe_member USING (user_id = nullif(current_setting('probe.user',true),'')::uuid);
GRANT USAGE ON SCHEMA public TO probe_member;
GRANT SELECT ON public.patient_events TO probe_member;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000101','fictional@example.invalid','synthetic-not-a-password');
INSERT INTO public.patient_events VALUES (1,'00000000-0000-0000-0000-000000000101','entirely fictional');
INSERT INTO storage.objects VALUES ('00000000-0000-0000-0000-000000000201','fictional-object');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260101000001','fixture_one',ARRAY['CREATE TABLE example(id integer)']);
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260101000002','fixture_two',ARRAY['ALTER TABLE example ADD COLUMN label text']);
"""

contract_sql = r"""
WITH tables AS (
 SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner,c.relacl::text acl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','auth','storage','supabase_migrations') AND c.relkind='r'
), columns AS (
 SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) def
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE n.nspname IN ('public','auth','storage','supabase_migrations') AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
), constraints AS (
 SELECT n.nspname,c.relname,co.conname,pg_get_constraintdef(co.oid) definition
 FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','auth','storage','supabase_migrations')
), routines AS (
 SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,p.proacl::text acl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='fixture_profile'
), triggers AS (
 SELECT n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','auth','storage','supabase_migrations') AND NOT t.tgisinternal
), policies AS (
 SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
 WHERE schemaname IN ('public','auth','storage','supabase_migrations')
), roles AS (
 SELECT rolname,rolcanlogin,rolsuper,rolinherit,rolbypassrls FROM pg_roles WHERE rolname IN ('probe_member','probe_clinician','probe_worker')
), memberships AS (
 SELECT m.rolname member,r.rolname granted FROM pg_auth_members am JOIN pg_roles m ON m.oid=am.member JOIN pg_roles r ON r.oid=am.roleid
 WHERE m.rolname LIKE 'probe_%' AND r.rolname LIKE 'probe_%'
), hashes AS (
 SELECT 'auth.users' rel,count(*) total,md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) digest FROM auth.users t
 UNION ALL SELECT 'public.profiles',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.profiles t
 UNION ALL SELECT 'public.patient_events',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.patient_events t
 UNION ALL SELECT 'storage.objects',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM storage.objects t
 UNION ALL SELECT 'supabase_migrations.schema_migrations',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM supabase_migrations.schema_migrations t
)
SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(to_jsonb(t) ORDER BY nspname,relname) FROM tables t),
 'columns',(SELECT jsonb_agg(to_jsonb(t) ORDER BY nspname,relname,attname) FROM columns t),
 'constraints',(SELECT jsonb_agg(to_jsonb(t) ORDER BY nspname,relname,conname) FROM constraints t),
 'routines',(SELECT jsonb_agg(to_jsonb(t) ORDER BY nspname,proname,args) FROM routines t),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY nspname,relname,tgname) FROM triggers t),
 'policies',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schemaname,tablename,policyname) FROM policies t),
 'roles',(SELECT jsonb_agg(to_jsonb(t) ORDER BY rolname) FROM roles t),
 'memberships',(SELECT jsonb_agg(to_jsonb(t) ORDER BY member,granted) FROM memberships t),
 'hashes',(SELECT jsonb_agg(to_jsonb(t) ORDER BY rel) FROM hashes t)
);
"""

try:
    source = LocalDocker(); source.start(); source_id = source.container_id; await_ready(source,source_id)
    target = LocalDocker(); target.start(); target_id = target.container_id; await_ready(target,target_id)
    if source_id == target_id: raise RuntimeError('Containers must be different')
    sql(source,source_id,fixture)
    before = json.loads(sql(source,source_id,contract_sql).stdout)
    if len(before['roles']) != 3 or len(before['hashes']) != 5 or len(before['policies']) != 1:
        raise RuntimeError('Incomplete source fixture')
    run(source,source_id,'mkdir','-p','/tmp/fictional-storage')
    run(source,source_id,'tee','/tmp/fictional-storage/object',data='synthetic blob only\n')

    raw_roles = run(source,source_id,'pg_dumpall','-U','postgres','--globals-only','--no-role-passwords').stdout
    lines = raw_roles.splitlines(keepends=True)
    create_admin = [x for x in lines if x.strip() == 'CREATE ROLE postgres;']
    alter_admin = [x for x in lines if x.strip().startswith('ALTER ROLE postgres ')]
    if len(create_admin) != 1 or len(alter_admin) != 1:
        raise RuntimeError('Unexpected synthetic built-in administrator dump')
    roles = ''.join(x for x in lines if x not in create_admin and x not in alter_admin)
    schema = dump(source,source_id,'--schema-only','--exclude-schema=supabase_migrations')
    data = dump(source,source_id,'--data-only','--exclude-schema=supabase_migrations')
    history_schema = dump(source,source_id,'--schema-only','--schema=supabase_migrations')
    history_data = dump(source,source_id,'--data-only','--schema=supabase_migrations')
    restore(target,target_id,roles)
    restore(target,target_id,schema)
    restore(target,target_id,data,replica=True)
    restore(target,target_id,history_schema)
    restore(target,target_id,history_data,replica=True)
    after = json.loads(sql(target,target_id,contract_sql).stdout)
    if before != after: raise RuntimeError('Synthetic data or catalog contract differs')
    print('PASS synthetic roles/membership, schema, ACL, RLS, policies, Auth trigger, data counts/hashes and migration history',flush=True)

    good = sql(target,target_id,"SET ROLE probe_clinician; SET \"probe.user\"='00000000-0000-0000-0000-000000000101'; SELECT count(*) FROM public.patient_events;").stdout.strip()
    other = sql(target,target_id,"SET ROLE probe_clinician; SET \"probe.user\"='00000000-0000-0000-0000-000000000999'; SELECT count(*) FROM public.patient_events;").stdout.strip()
    if (good,other) != ('1','0'): raise RuntimeError('Synthetic RLS behavior changed')
    print('PASS restored RLS for fictional owner and different actor',flush=True)

    # Run after the source/target baseline comparison; this is a new fictional
    # user, not evidence that Supabase GoTrue or real sign-up has been tested.
    sql(target,target_id,"INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000102','new-fictional@example.invalid','synthetic-not-a-password');")
    created = sql(target,target_id,"SELECT count(*) FROM public.profiles WHERE user_id='00000000-0000-0000-0000-000000000102' AND label='synthetic';").stdout.strip()
    if created != '1': raise RuntimeError('Restored fictional Auth trigger did not create profile')
    print('PASS restored synthetic Auth insert trigger creates a profile for a new fictional user',flush=True)
    missing_blob = run(target,target_id,'test','-e','/tmp/fictional-storage/object',check=False)
    if missing_blob.returncode != 1: raise RuntimeError('Unexpected synthetic Storage blob result')
    print('PASS storage object metadata restored; external synthetic blob was not included',flush=True)
    print('LIMIT synthetic only: no hosted connection, real backup, Vault/key, Auth service, external Storage, consistency under writes or hosted restoration verified',flush=True)
finally:
    try:
        if target is not None: target.cleanup()
    finally:
        if source is not None: source.cleanup()
