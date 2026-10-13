#!/usr/bin/env python3
"""PG17 fixture test: exact migration sections, equivalent synthetic history guard.
No remote connection, mounts, patient data, or shell interpolation.
"""
import hashlib, json, pathlib, subprocess, time, uuid
ROOT = pathlib.Path(__file__).resolve().parents[1]
name = 'serenia-hosted-packet-' + uuid.uuid4().hex[:12]
def docker(*args, sql=None, check=True):
    result = subprocess.run(['rtk','proxy','docker',*args], input=sql, text=True, capture_output=True)
    if check and result.returncode: raise RuntimeError(result.stdout+result.stderr)
    return result
def query(sql, check=True):
    return docker('exec','-i',name,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres',sql=sql,check=check)
try:
    docker('run','--detach','--rm','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17.6-bookworm')
    for _ in range(80):
        if docker('exec',name,'pg_isready','-h','127.0.0.1','-U','postgres',check=False).returncode==0: break
        time.sleep(.25)
    else: raise RuntimeError('PG17 did not start')
    query((ROOT/'supabase/tests/bootstrap.sql').read_text())
    for path in sorted((ROOT/'supabase/migrations').glob('*.sql')):
        if path.name.startswith('202610'): continue
        query('begin;'+path.read_text()+'\ncommit;')
    catalog_sql = """select jsonb_agg(row_to_json(x) order by code) from (
      select d.code,encode(sha256(convert_to((to_jsonb(d)-'id'-'created_at'-'updated_at')::text,'UTF8')),'hex') as definition_sha256,
      (select count(*) from questionnaire_items i where i.questionnaire_id=d.id) as items,
      (select encode(sha256(convert_to(coalesce(string_agg((to_jsonb(i)-'id'-'questionnaire_id'-'created_at'-'updated_at')::text,E'\\n' order by i.order_index),''),'UTF8')),'hex') from questionnaire_items i where i.questionnaire_id=d.id) as items_sha256
      from questionnaire_definitions d) x;"""
    accepted=json.loads(query(catalog_sql).stdout)
    baseline=json.loads((ROOT/'docs/operations/hosted-baseline.json').read_text())
    assert len(accepted)==len(baseline['catalog'])==5, 'Catalog count mismatch'
    assert [r['code'] for r in accepted]==[r['code'] for r in baseline['catalog']], 'Catalog codes differ'
    assert accepted==baseline['catalog'], 'Catalog semantic fingerprints differ'
    comparison=[{'code':r['code'],'definitionMatch':r['definition_sha256']==h['definition_sha256'],'itemsMatch':r['items_sha256']==h['items_sha256'],'local':r,'hosted':h} for r,h in zip(accepted,baseline['catalog'])]
    print('CATALOG_SEMANTIC_COMPARISON '+json.dumps(comparison))
    query((ROOT/'supabase/tests/hosted-platform.sql').read_text())
    query("set role supabase_auth_admin; insert into auth.users(id) values('00000000-0000-0000-0000-000000000101'),('00000000-0000-0000-0000-000000000102'); reset role;")
    query('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text,name text,statements text[]);')
    fixture_history=[]
    for h in baseline['history']:
        query("insert into supabase_migrations.schema_migrations values ('"+h['version']+"','"+h['name']+"',array['fixture']);")
        fixture_history.append({**h,'statements_md5':hashlib.md5(b'fixture').hexdigest()})
    packet=(ROOT/'supabase/hosted/serenia-atomic.sql').read_text()
    # Only replace preservation metadata with known synthetic history, not SQL bodies.
    expected=json.dumps(baseline['history'],separators=(',',':'))
    assert packet.count(expected)==1
    packet=packet.replace(expected,json.dumps(fixture_history,separators=(',',':')))
    # Same counts with changed clinical text must fail inside the locked guard.
    result=query("begin; update questionnaire_items set prompt='Unexpected drift' where id=(select id from questionnaire_items limit 1);"+packet+'\ncommit;',check=False)
    assert result.returncode and 'Hosted reviewed catalog semantic baseline changed' in result.stderr, result.stdout+result.stderr
    assert query("select count(*) from pg_class where oid=to_regclass('public.chat_turns');").stdout.strip()=='0'
    assert json.loads(query(catalog_sql).stdout)==accepted
    print('PASS same-count catalog drift rejected before DDL, clinical prompt unchanged after rollback')
    for mutation in ["update public.user_profiles set informal_name='changed'", "delete from public.questionnaire_items where id=(select id from public.questionnaire_items limit 1)"]:
        marker='-- No row transformation is authorized by this schema packet.'
        red=packet.replace(marker,mutation+';\n'+marker)
        result=query('begin;'+red+'\ncommit;',check=False)
        assert result.returncode and 'Hosted account/catalog preservation failed' in result.stderr, result.stdout+result.stderr
        assert query("select count(*) from pg_class where oid=to_regclass('public.chat_turns');").stdout.strip()=='0','Failed migration did not roll back'
    print('PASS full packet account/catalog mutation rollback twice, no DDL prefix committed')
    query('begin;'+packet+'\ncommit;')
    query("""do $$ declare routine text; role_name text; begin
      foreach routine in array array['public.handle_new_auth_user()','public.rls_auto_enable()'] loop
        foreach role_name in array array['anon','authenticated'] loop
          if has_function_privilege(role_name,routine,'EXECUTE') then raise exception 'client execute remains'; end if;
        end loop;
        foreach role_name in array array['postgres','supabase_admin','supabase_auth_admin','service_role'] loop
          if not has_function_privilege(role_name,routine,'EXECUTE') then raise exception 'intended execute lost'; end if;
        end loop;
      end loop;
    end $$;
    set role supabase_auth_admin;
    insert into auth.users(id) values('00000000-0000-0000-0000-000000000103');
    -- CREATE TRIGGER explicitly needs the creator's preserved EXECUTE grant.
    drop trigger on_auth_user_created on auth.users;
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();
    reset role;
    set role supabase_admin; create table public.admin_scratch(id int); reset role;
    create table public.postgres_scratch(id int);
    do $$ begin
      if (select count(*) from user_profiles where user_id='00000000-0000-0000-0000-000000000103' and role='patient' and onboarding_status='pending')<>1 then raise exception 'Auth signup trigger failed'; end if;
      if exists(select 1 from pg_class where oid in ('public.admin_scratch'::regclass,'public.postgres_scratch'::regclass) and not relrowsecurity) then raise exception 'Administrative RLS trigger failed'; end if;
    end $$;""")
    print('PASS row trigger signup/recreation, administrative event trigger, effective ACLs for six roles')
    # Hosted-only event routine absent is valid on fresh local installations.
    query('drop event trigger ensure_rls; drop function public.rls_auto_enable();')
    query((ROOT/'supabase/migrations/20261013073246_hosted_trigger_acl.sql').read_text())
    print('PASS fresh local installation does not invent hosted event trigger')
    # Unexpected binding is fail-closed before grant delta.
    query('alter table auth.users disable trigger on_auth_user_created;')
    result=query((ROOT/'supabase/migrations/20261013073246_hosted_trigger_acl.sql').read_text(),check=False)
    assert result.returncode and 'Unexpected Auth trigger definition/binding' in result.stderr
    print('PASS disabled Auth trigger binding rejected')
finally:
    docker('rm','--force',name,check=False)
