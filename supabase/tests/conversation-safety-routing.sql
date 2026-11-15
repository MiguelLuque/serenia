-- Synthetic transaction tests for prompt-bound safety clarification routing.
begin;

create function pg_temp.expect_failure(statement text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege or check_violation or lock_not_available
    or unique_violation or undefined_function then
    return;
  end;
  raise exception 'SAFETY ROUTING REGRESSION: accepted %', statement;
end
$$;

insert into auth.users(id)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(90, 98) n
on conflict (id) do nothing;

insert into user_profiles(
  user_id, role, birth_date, informal_name, pronouns, reason_for_consulting
)
select
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'patient', '1990-01-01', 'Synthetic', 'elle',
  'Synthetic test reason for safety routing'
from generate_series(90, 98) n
on conflict (user_id) do update set
  role = excluded.role,
  birth_date = excluded.birth_date,
  informal_name = excluded.informal_name,
  pronouns = excluded.pronouns,
  reason_for_consulting = excluded.reason_for_consulting;

insert into consents(user_id, consent_version, server_recorded, payload_json)
select
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'technical-draft-2026-10-11', true,
  '{"birthDate":"1990-01-01","technicalDraft":true}'
from generate_series(90, 98) n;

insert into conversations(id, user_id)
select ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(90, 98) n;

insert into clinical_sessions(id, user_id, conversation_id)
select ('20000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(90, 98) n;

do $acl$
declare public_signature text :=
  'public.begin_chat_turn(uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean)';
begin
  if to_regprocedure(public_signature) is null then
    raise exception 'Extended begin_chat_turn signature missing';
  end if;
  if to_regprocedure('public.begin_chat_turn(uuid,uuid,text,text,boolean,boolean)') is not null then
    raise exception 'Ambiguous six-argument begin_chat_turn overload remains';
  end if;
  if has_function_privilege('anon', public_signature, 'EXECUTE')
    or has_function_privilege('authenticated', public_signature, 'EXECUTE')
    or not has_function_privilege('service_role', public_signature, 'EXECUTE') then
    raise exception 'begin_chat_turn grants are not service-role-only';
  end if;
end
$acl$;

set local role service_role;
do $cases$
declare
  uid uuid := '00000000-0000-0000-0000-000000000090';
  sid uuid;
  claim jsonb;
  token uuid;
  parts jsonb := jsonb_build_array(
    jsonb_build_object('type', 'text', 'text', '¿Estás pensando en suicidarte ahora?'),
    jsonb_build_object('type', 'data-safety-prompt',
      'data', jsonb_build_object('version', 1, 'riskType', 'suicidal_ideation'))
  );
begin
  -- A server-stored, immediately preceding marker authorizes one categorized
  -- answer. Retries retain the first category and cannot duplicate its event.
  sid := '20000000-0000-0000-0000-000000000090';
  claim := begin_chat_turn(sid, uid, 'prompt-yes', 'A veces me siento así', false, false);
  if coalesce((claim->>'replay')::boolean, false) then raise exception 'Prompt unexpectedly replayed'; end if;
  if exists(select 1 from risk_events where session_id = sid) then
    raise exception 'Ambiguous cue created a risk event';
  end if;
  token := (claim->>'token')::uuid;
  perform finish_chat_turn(sid, 'prompt-yes', token, parts, '[]'::jsonb);
  perform pg_temp.expect_failure($q$
    select begin_chat_turn(
      p_session_id => '20000000-0000-0000-0000-000000000090',
      p_user_id => '00000000-0000-0000-0000-000000000090',
      p_request_id => 'answer-without-category', p_text => 'No lo sé',
      p_crisis => false, p_urgent => false
    )
  $q$);

  claim := begin_chat_turn(
    p_session_id => sid, p_user_id => uid, p_request_id => 'answer-yes',
    p_text => 'Sí', p_crisis => false, p_urgent => false,
    p_direct_risk_type => null, p_safety_answer => 'affirmative',
    p_safety_answer_risk_type => 'suicidal_ideation',
    p_safety_answer_required => true
  );
  if claim->>'safetyAnswer' is distinct from 'affirmative'
    or claim->>'safetyAnswerRiskType' is distinct from 'suicidal_ideation' then
    raise exception 'Validated safety answer was not returned: %', claim;
  end if;
  if (select safety_answer from chat_turns where session_id = sid and request_id = 'answer-yes')
      is distinct from 'affirmative'
    or (select safety_answer_risk_type from chat_turns where session_id = sid and request_id = 'answer-yes')
      is distinct from 'suicidal_ideation'::risk_type then
    raise exception 'Validated safety answer was not stored';
  end if;
  if (select count(*) from risk_events where session_id = sid and severity = 'moderate'
      and risk_type = 'suicidal_ideation'
      and payload_json->>'signal' = 'safety_clarification_affirmative'
      and payload_json->>'needs_clinician_review' = 'true'
      and payload_json->>'interpretation' = 'provisional_text_signal_not_diagnosis') <> 1 then
    raise exception 'Affirmative prompt answer did not create one provisional event';
  end if;
  perform fail_chat_turn(sid, 'answer-yes', (claim->>'token')::uuid, 'synthetic_failure');
  perform pg_temp.expect_failure($q$
    select begin_chat_turn(
      p_session_id => '20000000-0000-0000-0000-000000000090',
      p_user_id => '00000000-0000-0000-0000-000000000090',
      p_request_id => 'answer-yes', p_text => 'Sí',
      p_crisis => false, p_urgent => false, p_direct_risk_type => null,
      p_safety_answer => 'negative',
      p_safety_answer_risk_type => 'suicidal_ideation',
      p_safety_answer_required => true
    )
  $q$);
  claim := begin_chat_turn(
    p_session_id => sid, p_user_id => uid, p_request_id => 'answer-yes',
    p_text => 'Sí', p_crisis => false, p_urgent => false,
    p_direct_risk_type => null, p_safety_answer => 'affirmative',
    p_safety_answer_risk_type => 'suicidal_ideation',
    p_safety_answer_required => true
  );
  if claim->>'safetyAnswer' is distinct from 'affirmative'
    or (select count(*) from risk_events where session_id = sid
        and payload_json->>'signal' = 'safety_clarification_affirmative') <> 1 then
    raise exception 'Retry changed the first answer or duplicated its event';
  end if;
  perform pg_temp.expect_failure(format(
    'insert into risk_events(user_id,session_id,conversation_id,risk_type,severity,source_type,payload_json) ' ||
    'select %L,%L,%L,%L,%L,%L,%L::jsonb',
    uid, sid, (select conversation_id from clinical_sessions where id = sid),
    'suicidal_ideation', 'moderate', 'conversation',
    jsonb_build_object('request_id','answer-yes','signal','safety_clarification_affirmative',
      'prompt_request_id','prompt-yes','needs_clinician_review',true,
      'interpretation','provisional_text_signal_not_diagnosis')
  ));

  -- Negative, unclear and skip answers are stored against the marker but do
  -- not create risk events or get rewritten as an affirmative/denial.
  sid := '20000000-0000-0000-0000-000000000091';
  uid := '00000000-0000-0000-0000-000000000091';
  claim := begin_chat_turn(sid, uid, 'prompt-negative', 'No sé', false, false);
  perform finish_chat_turn(sid, 'prompt-negative', (claim->>'token')::uuid, parts, '[]'::jsonb);
  claim := begin_chat_turn(sid, uid, 'answer-negative', 'No', false, false,
    null, 'negative', 'suicidal_ideation', true);
  if claim->>'safetyAnswer' is distinct from 'negative'
    or exists(select 1 from risk_events where session_id = sid) then
    raise exception 'Negative answer was not acknowledged without event';
  end if;
  perform finish_chat_turn(sid, 'answer-negative', (claim->>'token')::uuid,
    '[{"type":"text","text":"Gracias por aclararlo."}]'::jsonb, '[]'::jsonb);

  sid := '20000000-0000-0000-0000-000000000092';
  uid := '00000000-0000-0000-0000-000000000092';
  claim := begin_chat_turn(sid, uid, 'prompt-unclear', 'A veces me cuesta saberlo', false, false);
  perform finish_chat_turn(sid, 'prompt-unclear', (claim->>'token')::uuid, parts, '[]'::jsonb);
  claim := begin_chat_turn(sid, uid, 'answer-unclear', 'No lo sé', false, false,
    null, 'unclear', 'suicidal_ideation', true);
  if claim->>'safetyAnswer' is distinct from 'unclear'
    or exists(select 1 from risk_events where session_id = sid) then
    raise exception 'Unclear answer was converted into a risk event';
  end if;
  perform finish_chat_turn(sid, 'answer-unclear', (claim->>'token')::uuid,
    '[{"type":"text","text":"Entiendo; podemos seguir con otro tema."}]'::jsonb, '[]'::jsonb);

  sid := '20000000-0000-0000-0000-000000000093';
  uid := '00000000-0000-0000-0000-000000000093';
  claim := begin_chat_turn(sid, uid, 'prompt-skip', 'No estoy segura', false, false);
  perform finish_chat_turn(sid, 'prompt-skip', (claim->>'token')::uuid, parts, '[]'::jsonb);
  claim := begin_chat_turn(sid, uid, 'answer-skip', 'Prefiero hablar de otra cosa', false, false,
    null, 'skip', 'suicidal_ideation', true);
  if claim->>'safetyAnswer' is distinct from 'skip'
    or exists(select 1 from risk_events where session_id = sid) then
    raise exception 'Skip was converted into a risk event';
  end if;
  perform finish_chat_turn(sid, 'answer-skip', (claim->>'token')::uuid,
    '[{"type":"text","text":"Claro, seguimos."}]'::jsonb, '[]'::jsonb);

  -- Mismatched type, unsupported category, missing type, and unsolicited
  -- categories fail closed even when the client asks for answer validation.
  sid := '20000000-0000-0000-0000-000000000094';
  uid := '00000000-0000-0000-0000-000000000094';
  claim := begin_chat_turn(sid, uid, 'prompt-self-harm', 'Me cuesta controlarlo', false, false);
  perform finish_chat_turn(sid, 'prompt-self-harm', (claim->>'token')::uuid,
    jsonb_build_array(
      jsonb_build_object('type','text','text','¿Piensas en hacerte daño intencionalmente ahora?'),
      jsonb_build_object('type','data-safety-prompt',
        'data',jsonb_build_object('version',1,'riskType','self_harm'))
    ), '[]'::jsonb);
  perform pg_temp.expect_failure($q$
    select begin_chat_turn(
      p_session_id => '20000000-0000-0000-0000-000000000094',
      p_user_id => '00000000-0000-0000-0000-000000000094',
      p_request_id => 'mismatch', p_text => 'Sí',
      p_crisis => false, p_urgent => false, p_direct_risk_type => null,
      p_safety_answer => 'affirmative',
      p_safety_answer_risk_type => 'suicidal_ideation',
      p_safety_answer_required => true
    )
  $q$);
  perform pg_temp.expect_failure($q$
    select begin_chat_turn(
      p_session_id => '20000000-0000-0000-0000-000000000094',
      p_user_id => '00000000-0000-0000-0000-000000000094',
      p_request_id => 'unsupported', p_text => 'Sí',
      p_crisis => false, p_urgent => false, p_direct_risk_type => null,
      p_safety_answer => 'yes',
      p_safety_answer_risk_type => 'self_harm',
      p_safety_answer_required => true
    )
  $q$);
  perform pg_temp.expect_failure($q$
    select begin_chat_turn(
      p_session_id => '20000000-0000-0000-0000-000000000094',
      p_user_id => '00000000-0000-0000-0000-000000000094',
      p_request_id => 'missing-type', p_text => 'Sí',
      p_crisis => false, p_urgent => false, p_direct_risk_type => null,
      p_safety_answer => 'affirmative', p_safety_answer_risk_type => null,
      p_safety_answer_required => true
    )
  $q$);

  -- An old prompt cannot be reused after an intervening completed response.
  sid := '20000000-0000-0000-0000-000000000095';
  uid := '00000000-0000-0000-0000-000000000095';
  claim := begin_chat_turn(sid, uid, 'old-prompt', 'Ambiguous cue', false, false);
  perform finish_chat_turn(sid, 'old-prompt', (claim->>'token')::uuid, parts, '[]'::jsonb);
  claim := begin_chat_turn(sid, uid, 'skip-old-prompt', 'Cambio de tema', false, false,
    null, 'skip', 'suicidal_ideation', true);
  perform finish_chat_turn(sid, 'skip-old-prompt', (claim->>'token')::uuid,
    '[{"type":"text","text":"Claro, dime."}]'::jsonb, '[]'::jsonb);
  perform pg_temp.expect_failure($q$
    select begin_chat_turn(
      p_session_id => '20000000-0000-0000-0000-000000000095',
      p_user_id => '00000000-0000-0000-0000-000000000095',
      p_request_id => 'late-answer', p_text => 'Sí',
      p_crisis => false, p_urgent => false, p_direct_risk_type => null,
      p_safety_answer => 'affirmative',
      p_safety_answer_risk_type => 'suicidal_ideation',
      p_safety_answer_required => true
    )
  $q$);

  -- A direct current self-harm signal takes precedence over a pending prompt
  -- and any simultaneous answer candidate. It stores its own type once.
  sid := '20000000-0000-0000-0000-000000000096';
  uid := '00000000-0000-0000-0000-000000000096';
  claim := begin_chat_turn(sid, uid, 'prompt-direct', 'No lo sé', false, false);
  perform finish_chat_turn(sid, 'prompt-direct', (claim->>'token')::uuid, parts, '[]'::jsonb);
  claim := begin_chat_turn(
    p_session_id => sid, p_user_id => uid, p_request_id => 'direct-no-answer',
    p_text => 'Voy a hacerme daño ahora', p_crisis => false, p_urgent => true,
    p_direct_risk_type => 'self_harm'
  );
  if claim->>'safetyAnswer' is not null
    or (select risk_type from risk_events where session_id=sid) <> 'self_harm'::risk_type
    or (select count(*) from risk_events where session_id=sid)<>1
    or (select safety_answer from chat_turns where session_id=sid and request_id='direct-no-answer') is not null then
    raise exception 'Direct signal with a pending prompt was blocked without an answer candidate';
  end if;
  perform finish_chat_turn(sid, 'direct-no-answer', (claim->>'token')::uuid,
    '[{"type":"text","text":"Si hay peligro inmediato, llama al 112."}]'::jsonb, '[]'::jsonb);

  sid := '20000000-0000-0000-0000-000000000098';
  uid := '00000000-0000-0000-0000-000000000098';
  claim := begin_chat_turn(sid, uid, 'prompt-direct-signal', 'No lo sé', false, false);
  perform finish_chat_turn(sid, 'prompt-direct-signal', (claim->>'token')::uuid, parts, '[]'::jsonb);
  claim := begin_chat_turn(
    p_session_id => sid, p_user_id => uid, p_request_id => 'direct-self-harm',
    p_text => 'Me haré daño ahora', p_crisis => false, p_urgent => true,
    p_direct_risk_type => 'self_harm',
    p_safety_answer => 'affirmative',
    p_safety_answer_risk_type => 'self_harm',
    p_safety_answer_required => true
  );
  if (select risk_type from risk_events where session_id = sid) <> 'self_harm'::risk_type
    or (select severity from risk_events where session_id = sid) <> 'high'
    or (select payload_json->>'needs_clinician_review' from risk_events where session_id = sid) <> 'true'
    or (select payload_json->>'interpretation' from risk_events where session_id = sid)
      <> 'provisional_text_signal_not_diagnosis'
    or (select status from clinical_sessions where id = sid) <> 'open'
    or (select safety_answer from chat_turns where session_id=sid and request_id='direct-self-harm') is not null
    or (select count(*) from risk_events where session_id=sid)<>1 then
    raise exception 'Direct signal lost its type, provisional status or open session';
  end if;
  perform finish_chat_turn(sid, 'direct-self-harm', (claim->>'token')::uuid,
    '[{"type":"text","text":"Si hay peligro inmediato, llama al 112."}]'::jsonb, '[]'::jsonb);

  sid := '20000000-0000-0000-0000-000000000097';
  uid := '00000000-0000-0000-0000-000000000097';
  perform pg_temp.expect_failure($q$
    select begin_chat_turn(
      p_session_id => '20000000-0000-0000-0000-000000000097',
      p_user_id => '00000000-0000-0000-0000-000000000097',
      p_request_id => 'invalid-direct-type', p_text => 'Severe distress',
      p_crisis => true, p_urgent => true,
      p_direct_risk_type => 'severe_distress'
    )
  $q$);

  -- No caller-supplied marker parameter or six-argument overload can bypass
  -- the database's server-stored prompt validation.
  if to_regprocedure(
    'public.begin_chat_turn(uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean,jsonb)'
  ) is not null then
    raise exception 'Client marker was added to begin_chat_turn';
  end if;
end
$cases$;

reset role;
rollback;
