-- Opt-in author-reported memory. No clinical conclusions, score or permission changes.
create table profile_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 consent_epoch bigint not null default 0 check(consent_epoch>=0),
 updated_at timestamptz not null default clock_timestamp()
);
alter table messages add constraint profile_source_identity unique(id,session_id,conversation_id,created_at);
create table profile_extraction_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_message_id uuid not null unique,
 session_id uuid not null,
 conversation_id uuid not null,
 source_created_at timestamptz not null,
 consent_epoch bigint not null check(consent_epoch>=0),
 status text not null default 'pending' check(status in ('pending','enqueued','running','completed','cancelled','exhausted')),
 token uuid not null default gen_random_uuid(),
 lease_until timestamptz,
 attempts integer not null default 0 check(attempts between 0 and 3),
 available_at timestamptz not null default clock_timestamp(),
 run_id text,
 error_code text check(error_code in ('processing_failed','claims_exhausted','consent_withdrawn')),
 extractor_version text not null default 'profile-v1' check(extractor_version='profile-v1'),
 model_id text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint profile_job_source foreign key(source_message_id,session_id,conversation_id,source_created_at) references messages(id,session_id,conversation_id,created_at) on delete cascade,
 constraint profile_job_session_owner foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade,
 constraint profile_job_conversation_owner foreign key(conversation_id,user_id) references conversations(id,user_id) on delete cascade,
 constraint profile_job_observation_source unique(id,user_id,source_message_id,source_created_at),
 constraint profile_job_active_lease check((status in ('enqueued','running'))=(lease_until is not null))
);
create unique index profile_job_one_active_user on profile_extraction_jobs(user_id) where status in ('enqueued','running');
create index profile_job_pending_order on profile_extraction_jobs(user_id,source_created_at,id) where status in ('pending','enqueued','running');
create index profile_job_session_owner_index on profile_extraction_jobs(session_id,user_id);
create index profile_job_conversation_owner_index on profile_extraction_jobs(conversation_id,user_id);
create table profile_observations (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 source_message_id uuid not null,
 source_created_at timestamptz not null,
 category text not null check(category in ('concern','goal','context','functioning','resource','preference','history','agreement')),
 quote text not null check(char_length(quote) between 1 and 400),
 time_scope text not null check(time_scope in ('current','historical','unspecified')),
 supersedes_id uuid,
 status text not null default 'pending' check(status in ('pending','confirmed','rejected','superseded')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint profile_observation_source foreign key(job_id,user_id,source_message_id,source_created_at) references profile_extraction_jobs(id,user_id,source_message_id,source_created_at) on delete cascade,
 unique(id,user_id),
 unique(job_id,category,quote),
 constraint profile_observation_target foreign key(supersedes_id,user_id) references profile_observations(id,user_id) on delete set null (supersedes_id),
 check(supersedes_id is distinct from id)
);
create index profile_observation_owner_recent on profile_observations(user_id,source_created_at desc,id desc);
create index profile_observation_target_index on profile_observations(supersedes_id,user_id);
create index profile_observation_source_message on profile_observations(source_message_id);

alter table profile_settings enable row level security;
alter table profile_extraction_jobs enable row level security;
alter table profile_observations enable row level security;
revoke all on profile_settings,profile_extraction_jobs,profile_observations from public,anon,authenticated,service_role;
grant select on profile_settings,profile_observations to authenticated;
grant select on profile_settings,profile_extraction_jobs,profile_observations to service_role;
create policy profile_settings_owner on profile_settings for select to authenticated using(user_id=(select auth.uid()));
create policy profile_observations_owner on profile_observations for select to authenticated using(user_id=(select auth.uid()));

-- Same canonical source as the extractor: text parts in order, separated by LF.
create function profile_message_text(p_parts jsonb) returns text language sql immutable set search_path=public,pg_temp as $$
 select coalesce(string_agg(part->>'text',E'\n' order by ordinal),'')
 from jsonb_array_elements(case when jsonb_typeof(p_parts)='array' then p_parts else '[]'::jsonb end) with ordinality as parts(part,ordinal)
 where part->>'type'='text' and jsonb_typeof(part->'text')='string'
$$;
revoke all on function profile_message_text(jsonb) from public,anon,authenticated,service_role;

create function profile_source_immutable() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if row(new.id,new.parts,new.role,new.session_id,new.conversation_id,new.created_at) is distinct from row(old.id,old.parts,old.role,old.session_id,old.conversation_id,old.created_at)
  and exists(select 1 from profile_extraction_jobs where source_message_id=old.id) then
  raise exception 'Profile source is immutable' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function profile_source_immutable() from public,anon,authenticated,service_role;
create trigger profile_source_immutable before update on messages for each row execute function profile_source_immutable();

create function enqueue_profile_source() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; cfg profile_settings%rowtype;
begin
 if new.role<>'user' or new.session_id is null then return new; end if;
 select s.user_id into uid from clinical_sessions s join conversations c on c.id=s.conversation_id and c.user_id=s.user_id
 where s.id=new.session_id and s.conversation_id=new.conversation_id;
 if uid is null then raise exception 'Profile source ownership mismatch' using errcode='23514'; end if;
 select * into cfg from profile_settings where user_id=uid for update;
 if not found or not cfg.enabled then return new; end if;
 insert into profile_extraction_jobs(user_id,source_message_id,session_id,conversation_id,source_created_at,consent_epoch)
 values(uid,new.id,new.session_id,new.conversation_id,new.created_at,cfg.consent_epoch) on conflict(source_message_id) do nothing;
 return new;
end $$;
revoke all on function enqueue_profile_source() from public,anon,authenticated,service_role;
create trigger enqueue_profile_source after insert on messages for each row execute function enqueue_profile_source();

-- Foreign keys also fence elevated SQL writes. Role/quote constraints need row validation.
create function validate_profile_source() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from messages m where m.id=new.source_message_id and m.role='user') then
  raise exception 'Profile source must be user authored' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function validate_profile_source() from public,anon,authenticated,service_role;
create trigger validate_profile_source before insert or update on profile_extraction_jobs for each row execute function validate_profile_source();

create function validate_profile_observation() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare source_text text;
begin
 if tg_op='UPDATE' then
  if row(new.job_id,new.user_id,new.source_message_id,new.source_created_at,new.category,new.quote,new.time_scope) is distinct from row(old.job_id,old.user_id,old.source_message_id,old.source_created_at,old.category,old.quote,old.time_scope)
   or (new.supersedes_id is distinct from old.supersedes_id and new.supersedes_id is not null) then
   raise exception 'Profile observation source is immutable' using errcode='23514';
  end if;
  -- SET NULL preserves the correction's independent source and invalidates stale UI versions.
  if new.supersedes_id is distinct from old.supersedes_id then
   new.updated_at=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  end if;
  return new;
 end if;
 select profile_message_text(m.parts) into source_text from messages m where m.id=new.source_message_id and m.role='user';
 if source_text is null or char_length(source_text)>8000 or position(new.quote in source_text)=0 then
  raise exception 'Profile quote must match bounded user source' using errcode='23514';
 end if;
 if tg_op='INSERT' and new.supersedes_id is not null and not exists(
  select 1 from profile_observations o where o.id=new.supersedes_id and o.user_id=new.user_id and o.status='confirmed'
   and o.category=new.category and o.source_created_at<new.source_created_at
 ) then raise exception 'Profile correction target invalid' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function validate_profile_observation() from public,anon,authenticated,service_role;
create trigger validate_profile_observation before insert or update on profile_observations for each row execute function validate_profile_observation();

create function set_profile_enabled(p_enabled boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg profile_settings%rowtype;
begin
 if auth.uid() is null or not patient_onboarding_ready(auth.uid()) then raise exception 'Owned adult profile required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Profile preference required' using errcode='23514'; end if;
 insert into profile_settings(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into cfg from profile_settings where user_id=auth.uid() for update;
 update profile_settings set enabled=p_enabled,consent_epoch=cfg.consent_epoch+case when p_enabled then 0 else 1 end,updated_at=clock_timestamp() where user_id=cfg.user_id;
 if not p_enabled then
  update profile_extraction_jobs set status='cancelled',token=gen_random_uuid(),lease_until=null,error_code='consent_withdrawn',updated_at=clock_timestamp()
   where user_id=cfg.user_id and status in ('pending','enqueued','running');
 end if;
end $$;
revoke all on function set_profile_enabled(boolean) from public,anon,service_role;
grant execute on function set_profile_enabled(boolean) to authenticated;

create function get_profile_memory() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authenticated owner required' using errcode='42501'; end if;
 -- One SQL snapshot; read never creates settings or reads another owner's records.
 select jsonb_build_object(
  'enabled',coalesce((select enabled from profile_settings where user_id=auth.uid()),false),
  'pending_jobs',(select count(*) from profile_extraction_jobs where user_id=auth.uid() and consent_epoch=(select consent_epoch from profile_settings where user_id=auth.uid()) and status in ('pending','enqueued','running')),
  'failed_jobs',(select count(*) from profile_extraction_jobs where user_id=auth.uid() and consent_epoch=(select consent_epoch from profile_settings where user_id=auth.uid()) and status='exhausted'),
  'observations',coalesce((select jsonb_agg(jsonb_build_object(
   'id',o.id,'category',o.category,'quote',o.quote,'time_scope',o.time_scope,'status',o.status,
   'supersedes_id',o.supersedes_id,'source_message_id',o.source_message_id,'session_id',o.session_id,
   'source_created_at',o.source_created_at,'updated_at',o.updated_at,
   'disputed',o.status='confirmed' and exists(select 1 from profile_observations child where child.supersedes_id=o.id and child.user_id=o.user_id and child.status='pending')
  ) order by o.source_created_at desc,o.id desc) from (
   select obs.*,j.session_id from profile_observations obs join profile_extraction_jobs j on j.id=obs.job_id and j.user_id=obs.user_id
   where obs.user_id=auth.uid() order by obs.source_created_at desc,obs.id desc limit 100
  ) o),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function get_profile_memory() from public,anon,service_role;
grant execute on function get_profile_memory() to authenticated;

create function claim_profile_jobs(p_user_id uuid default null,p_limit integer default 1)
returns setof profile_extraction_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg profile_settings%rowtype; j profile_extraction_jobs%rowtype; claimed integer:=0;
begin
 if p_limit is null or p_limit not between 1 and 10 then raise exception 'Profile claim limit invalid' using errcode='23514'; end if;
 -- Settings is always the first lock. SKIP LOCKED lets independent users advance.
 for cfg in select s.* from profile_settings s where s.enabled and (p_user_id is null or s.user_id=p_user_id)
  and exists(select 1 from profile_extraction_jobs job where job.user_id=s.user_id and job.status in ('pending','enqueued','running'))
  order by s.user_id for update skip locked
 loop
  loop
   select * into j from profile_extraction_jobs where user_id=cfg.user_id and status in ('pending','enqueued','running') order by source_created_at,id limit 1 for update;
   exit when not found;
   -- Never skip an unavailable oldest source in favour of a newer one.
   exit when (j.status='pending' and j.available_at>clock_timestamp()) or (j.status in ('enqueued','running') and j.lease_until>clock_timestamp());
   if j.consent_epoch<>cfg.consent_epoch then
    update profile_extraction_jobs set status='cancelled',token=gen_random_uuid(),lease_until=null,error_code='consent_withdrawn',updated_at=clock_timestamp() where id=j.id;
   elsif j.attempts>=3 then
    update profile_extraction_jobs set status='exhausted',lease_until=null,error_code='claims_exhausted',updated_at=clock_timestamp() where id=j.id;
   else
    update profile_extraction_jobs set status='enqueued',token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',attempts=attempts+1,run_id=null,error_code=null,updated_at=clock_timestamp() where id=j.id returning * into j;
    return next j;
    claimed=claimed+1;
    exit;
   end if;
  end loop;
  exit when claimed>=p_limit;
 end loop;
end $$;
revoke all on function claim_profile_jobs(uuid,integer) from public,anon,authenticated;
grant execute on function claim_profile_jobs(uuid,integer) to service_role;

-- Internal fenced lock shared by worker RPCs, deliberately not executable by clients.
create function lock_profile_job(p_job_id uuid,p_token uuid) returns profile_extraction_jobs
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; cfg profile_settings%rowtype; j profile_extraction_jobs%rowtype;
begin
 select user_id into uid from profile_extraction_jobs where id=p_job_id;
 if uid is null then raise exception 'Profile job unavailable' using errcode='42501'; end if;
 select * into cfg from profile_settings where user_id=uid for update;
 if not found or not cfg.enabled then raise exception 'Profile consent inactive' using errcode='42501'; end if;
 select * into j from profile_extraction_jobs where id=p_job_id and user_id=uid for update;
 if not found or j.token is distinct from p_token or j.consent_epoch<>cfg.consent_epoch
  or j.status not in ('enqueued','running','completed')
  or (j.status<>'completed' and (j.lease_until is null or j.lease_until<=clock_timestamp())) then
  raise exception 'Profile claim stale' using errcode='42501';
 end if;
 return j;
end $$;
revoke all on function lock_profile_job(uuid,uuid) from public,anon,authenticated,service_role;

create function start_profile_job(p_job_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare j profile_extraction_jobs%rowtype;
begin
 j=lock_profile_job(p_job_id,p_token);
 if j.status='completed' then return false; end if;
 if j.status<>'enqueued' then raise exception 'Profile worker already started' using errcode='40001'; end if;
 update profile_extraction_jobs set status='running',updated_at=clock_timestamp() where id=j.id;
 return true;
end $$;
revoke all on function start_profile_job(uuid,uuid) from public,anon,authenticated;
grant execute on function start_profile_job(uuid,uuid) to service_role;

create function update_profile_job(p_job_id uuid,p_token uuid,p_action text,p_run_id text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare j profile_extraction_jobs%rowtype;
begin
 if p_action is null or p_action not in ('enqueued','failed') or (p_run_id is not null and char_length(p_run_id) not between 1 and 200) then raise exception 'Profile job update invalid' using errcode='23514'; end if;
 j=lock_profile_job(p_job_id,p_token);
 if p_action='enqueued' then
  -- Workflow can start/finish before its dispatch acknowledgement returns.
  update profile_extraction_jobs set run_id=coalesce(p_run_id,run_id),updated_at=clock_timestamp() where id=j.id;
 else
  if j.status='completed' then raise exception 'Profile job already completed' using errcode='40001'; end if;
  update profile_extraction_jobs set status=case when attempts>=3 then 'exhausted' else 'pending' end,
   lease_until=null,available_at=clock_timestamp()+interval '30 seconds',error_code='processing_failed',updated_at=clock_timestamp() where id=j.id;
 end if;
end $$;
revoke all on function update_profile_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function update_profile_job(uuid,uuid,text,text) to service_role;

create function finish_profile_job(p_job_id uuid,p_token uuid,p_observations jsonb,p_model_id text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare j profile_extraction_jobs%rowtype; o jsonb; target uuid; source_text text;
begin
 j=lock_profile_job(p_job_id,p_token);
 if j.status='completed' then return; end if;
 if j.status<>'running' then raise exception 'Profile worker not running' using errcode='23514'; end if;
 if p_model_id is null or char_length(btrim(p_model_id)) not between 1 and 200 then raise exception 'Profile model identifier required' using errcode='23514'; end if;
 if jsonb_typeof(p_observations) is distinct from 'array' or jsonb_array_length(p_observations)>5 then raise exception 'Profile output invalid' using errcode='23514'; end if;
 select profile_message_text(parts) into source_text from messages where id=j.source_message_id and role='user' and created_at=j.source_created_at;
 if source_text is null or char_length(source_text)>8000 then raise exception 'Profile source unavailable or too long' using errcode='23514'; end if;
 for o in select value from jsonb_array_elements(p_observations) loop
  if jsonb_typeof(o) is distinct from 'object' then raise exception 'Profile observation invalid' using errcode='23514'; end if;
  if not (o ?& array['category','quote','time_scope','supersedes_id']) or (o-array['category','quote','time_scope','supersedes_id'])<>'{}'::jsonb
   or jsonb_typeof(o->'category') is distinct from 'string' or jsonb_typeof(o->'quote') is distinct from 'string' or jsonb_typeof(o->'time_scope') is distinct from 'string'
   or jsonb_typeof(o->'supersedes_id') not in ('null','string') then raise exception 'Profile observation fields invalid' using errcode='23514'; end if;
  begin target=(o->>'supersedes_id')::uuid;
  exception when invalid_text_representation then raise exception 'Profile correction identifier invalid' using errcode='23514'; end;
  insert into profile_observations(job_id,user_id,source_message_id,source_created_at,category,quote,time_scope,supersedes_id)
  values(j.id,j.user_id,j.source_message_id,j.source_created_at,o->>'category',o->>'quote',o->>'time_scope',target);
 end loop;
 -- Every validation/insertion rolls back with the whole statement on failure.
 update profile_extraction_jobs set status='completed',lease_until=null,model_id=btrim(p_model_id),error_code=null,updated_at=clock_timestamp() where id=j.id;
end $$;
revoke all on function finish_profile_job(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function finish_profile_job(uuid,uuid,jsonb,text) to service_role;

create function review_profile_observation(p_observation_id uuid,p_action text,p_expected_updated_at timestamptz) returns void
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
  if not found or target.status<>'confirmed' or target.category<>o.category or target.source_created_at>=o.source_created_at then
   raise exception 'Profile correction changed; reload' using errcode='40001';
  end if;
  update profile_observations set status='superseded',updated_at=clock_timestamp() where id=target.id or (supersedes_id=target.id and user_id=o.user_id and status='pending' and id<>o.id);
 end if;
 update profile_observations set status=case when p_action='confirm' then 'confirmed' else 'rejected' end,updated_at=greatest(clock_timestamp(),o.updated_at+interval '1 microsecond') where id=o.id;
end $$;
revoke all on function review_profile_observation(uuid,text,timestamptz) from public,anon,service_role;
grant execute on function review_profile_observation(uuid,text,timestamptz) to authenticated;
