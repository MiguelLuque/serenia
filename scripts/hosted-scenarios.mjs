import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import { findIntendedRetry, intendedEvents, readBoundRun } from './acceptance-checkpoint.mjs'
import assert from 'node:assert/strict'
import { hostedOrigin, secureDirectory, privateFile, assertFixture } from './hosted-acceptance.mjs'
import { target } from './hosted-packet.mjs'

const directory=secureDirectory(process.env.SERENIA_ACCEPTANCE_DIR)
const url=hostedOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL)
assert.equal(process.env.NEXT_PUBLIC_SITE_URL,target.appOrigin)
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{autoRefreshToken:false,persistSession:false}})
const path=privateFile(resolve(directory,'fixtures.json'))
const mode=process.argv[2]
const manifest=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{runId:randomBytes(10).toString('hex'),createdAt:new Date().toISOString(),targetOrigin:url,password:randomBytes(32).toString('base64url')+'-aA9!',actors:{}}
assert.equal(manifest.targetOrigin,url)
const save=()=>privateFile(path,JSON.stringify(manifest,null,2)+'\n')
const proof=(name,detail={})=>{const row={at:new Date().toISOString(),name,status:'PASS',...detail};appendFileSync(privateFile(resolve(directory,'checks.jsonl')),JSON.stringify(row)+'\n',{mode:0o600});console.log(JSON.stringify(row))}
const ok=result=>{if(result.error)throw new Error(JSON.stringify({message:result.error.message,code:result.error.code}));return result.data}
const actor=name=>assertFixture(manifest,name)
async function login(name){
  const a=actor(name);const cookies=new Map()
  const client=createServerClient(url,key,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(({name,value})=>cookies.set(name,value))}})
  const auth=ok(await client.auth.signInWithPassword({email:a.email,password:manifest.password}))
  assert.equal(auth.user.id,a.userId);assert.equal(ok(await client.auth.getUser()).user.id,a.userId)
  return {client,token:auth.session.access_token,cookie:()=>[...cookies].map(([name,value])=>`${name}=${value}`).join('; ')}
}
async function createActor(name,patient=true){
  assert.ok(!manifest.actors[name],'Fixture already exists')
  save();const email=`serenia-task7-${manifest.runId}-${name}@example.test`
  const user=ok(await admin.auth.admin.createUser({email,password:manifest.password,email_confirm:true})).user
  manifest.actors[name]={name,email,userId:user.id};save()
  const a=actor(name)
  const {client}=await login(name)
  if(patient){
    ok(await client.rpc('complete_patient_onboarding',{p_informal_name:`Ficticio ${name}`,p_pronouns:'elle',p_birth_date:'1990-01-01',p_reason:'Prueba técnica sintética hospedada',p_version:'technical-draft-2026-10-11',p_accepted:true}))
    const session=ok(await client.rpc('create_session_atomic',{p_user_id:a.userId}))
    Object.assign(a,{sessionId:session.id,conversationId:session.conversation_id,url:`${target.appOrigin}/app/sesion/${session.id}`});save()
  }
  return a
}
async function send(name,text,requestId=randomUUID()){
  const a=actor(name),auth=await login(name)
  const response=await fetch(`${target.appOrigin}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:auth.cookie()},body:JSON.stringify({sessionId:a.sessionId,requestId,messages:[{id:requestId,role:'user',parts:[{type:'text',text}]}]})})
  return {status:response.status,body:await response.text(),requestId}
}
async function job(name){const a=actor(name);return ok(await admin.from('assessment_jobs').select('session_id,status,token,run_id,attempts').eq('session_id',a.sessionId).maybeSingle())}
async function waitCompleted(name,timeout=90000){
  const deadline=Date.now()+timeout
  while(Date.now()<deadline){const j=await job(name);if(j?.status==='completed')return j;await new Promise(done=>setTimeout(done,250))}
  throw new Error('Synthetic job did not complete within bounded wait')
}
const eventsFor=runId=>intendedEvents(directory,runId)
async function runFor(jobRow,name){return (await readBoundRun(directory,actor(name),jobRow)).run}
if(mode==='fixtures'){
  assert.equal(Object.keys(manifest.actors).length,0)
  for(const name of ['patient','foreign','browser'])await createActor(name)
  await createActor('clinician',false)
  ok(await admin.from('user_profiles').update({role:'clinician'}).eq('user_id',actor('clinician').userId))
  const auth=await login('patient'),a=actor('patient'),b=actor('foreign')
  assert.deepEqual(ok(await auth.client.from('clinical_sessions').select('id').eq('id',b.sessionId)),[])
  assert.ok((await auth.client.rpc('close_session_atomic',{p_session_id:b.sessionId,p_user_id:b.userId,p_reason:'user_request'})).error)
  assert.ok((await auth.client.from('user_profiles').update({role:'clinician'}).eq('user_id',a.userId)).error)
  assert.ok((await auth.client.from('consents').insert({user_id:a.userId,consent_version:'fake'})).error)
  assert.ok((await auth.client.rpc('get_patient_session_reports',{p_session_ids:[b.sessionId]})).error)
  const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  assert.ok((await anon.from('clinical_sessions').select('id').eq('id',a.sessionId)).error)
  assert.ok((await anon.rpc('create_session_atomic',{p_user_id:a.userId})).error)
  const raw=await fetch(`${url}/rest/v1/clinical_sessions?id=eq.${a.sessionId}&select=id`,{headers:{apikey:key,Authorization:`Bearer ${auth.token}`}})
  assert.equal(raw.status,200);assert.equal((await raw.json())[0].id,a.sessionId)
  const consent=ok(await admin.from('consents').select('server_recorded,consent_version').eq('user_id',a.userId))
  assert.equal(consent.length,1);assert.equal(consent[0].server_recorded,true)
  const c=await login('clinician');assert.equal(ok(await c.client.from('clinical_sessions').select('id').eq('id',a.sessionId))[0].id,a.sessionId)
  proof('hosted_actual_gotrue_jwt_postgrest_anon_owner_foreign_clinician_service_grants')
}else if(mode==='http'){
  for(const name of ['flow','step'])assert.equal((await fetch(`${target.appOrigin}/.well-known/workflow/v1/${name}?__health`,{method:'POST',redirect:'manual'})).status,200)
  for(const text of ['Primera conversación ficticia','Me encuentro tranquilo en esta prueba','Solicito el cuestionario PHQ9']){const r=await send('patient',text);assert.equal(r.status,200,r.body)}
  const a=actor('patient'),auth=await login('patient')
  const instance=ok(await admin.from('questionnaire_instances').select('id,questionnaire_id').eq('session_id',a.sessionId).eq('user_id',a.userId).single())
  const body=JSON.stringify({answers:Array.from({length:9},(_,i)=>({itemOrder:i+1,valueNumeric:0,valueRaw:'0'}))})
  for(let i=0;i<2;i++){const response=await fetch(`${target.appOrigin}/api/questionnaires/${instance.id}/answers`,{method:'POST',headers:{Cookie:auth.cookie(),'Content-Type':'application/json'},body});assert.equal(response.status,200,await response.text())}
  assert.equal(ok(await admin.from('questionnaire_results').select('id').eq('instance_id',instance.id)).length,1)
  const retryId=randomUUID();assert.equal((await send('patient','[FALLO_UNICO] Ensayo hospedado',retryId)).status,503);assert.equal((await send('patient','[FALLO_UNICO] Ensayo hospedado',retryId)).status,200)
  const turn=ok(await admin.from('chat_turns').select('status,attempts').eq('session_id',a.sessionId).eq('request_id',retryId).single());assert.equal(turn.status,'completed');assert.equal(turn.attempts,2)
  for(const text of ['Propongo cerrar esta sesión','Sí, cerramos']){const r=await send('patient',text);assert.equal(r.status,200,r.body)}
  const completed=await waitCompleted('patient');assert.equal(completed.attempts,1)
  const report=ok(await admin.from('assessments').select('id,summary_json').eq('session_id',a.sessionId).eq('user_id',a.userId).single())
  const result=ok(await admin.from('questionnaire_results').select('total_score,severity_band,flags_json').eq('instance_id',instance.id).single())
  const definition=ok(await admin.from('questionnaire_definitions').select('code').eq('id',instance.questionnaire_id).single())
  const facts=[{code:definition.code,score:result.total_score,band:result.severity_band,flags:result.flags_json}]
  assert.deepEqual(facts,[{code:'PHQ9',score:0,band:'minimal',flags:[]}])
  assert.deepEqual(report.summary_json.questionnaires,facts,'Generated report must retain persisted scored facts despite the adversarial empty provider list')
  proof('hosted_actual_next_http_questionnaire_retry_idempotency_closure_generated_workflow',{sessionId:a.sessionId,runId:completed.run_id,questionnaires:facts})
}else if(mode==='review'){
  const name=manifest.actors.restart?'restart':'patient',a=actor(name),patient=await login(name),clinician=await login('clinician')
  assert.deepEqual(ok(await patient.client.from('assessments').select('*').eq('session_id',a.sessionId)),[])
  const pending=ok(await patient.client.rpc('get_patient_session_reports',{p_session_ids:[a.sessionId]}));assert.equal(pending[0].state,'pending_review');assert.equal(pending[0].summary,null)
  const report=ok(await admin.from('assessments').select('id,summary_json,status').eq('session_id',a.sessionId).eq('user_id',a.userId).neq('status','superseded').single());assert.equal(report.status,'draft_ai')
  const summary={...report.summary_json,patient_facing_summary:'Resumen ficticio revisado hospedado.',risk_assessment:{suicidality:'passive',self_harm:'historic',heteroaggression:'verbal',substance_use_acute:'suspected',notes:'PRIVADA_HOSTED'}}
  const args={p_session_id:a.sessionId,p_assessment_id:report.id,p_action:'modify',p_summary:summary,p_notes:'CLINICA_PRIVADA_HOSTED',p_inherited_updates:[]}
  assert.ok((await patient.client.rpc('review_assessment_atomic',args)).error)
  const id=ok(await clinician.client.rpc('review_assessment_atomic',args));assert.equal(ok(await clinician.client.rpc('review_assessment_atomic',args)),id)
  const projection=ok(await patient.client.rpc('get_patient_session_reports',{p_session_ids:[a.sessionId]}));assert.equal(projection[0].summary,summary.patient_facing_summary);assert.ok(!JSON.stringify(projection).includes('PRIVADA'))
  assert.equal(ok(await admin.from('assessments').select('id').eq('session_id',a.sessionId).eq('user_id',a.userId).not('status','in','(superseded,rejected)')).length,1)
  assert.equal(ok(await admin.from('patient_tasks').select('id').eq('user_id',a.userId).eq('acordada_en_session_id',a.sessionId).is('closed_at',null)).length,1)
  proof('hosted_private_projection_review_idempotency',{sessionId:a.sessionId,reviewedId:id})
}else if(mode==='restart-checkpoint'){
  await createActor('restart');privateFile(resolve(directory,'control.json'),'{"structured":"fail"}\n')
  for(const text of ['Primera entrada ficticia','Segunda entrada ficticia','Tercera entrada ficticia','Propongo cerrar esta sesión','Sí, cerramos']){const r=await send('restart',text);assert.equal(r.status,200,r.body)}
  const deadline=Date.now()+45000;let checkpoint
  while(Date.now()<deadline){
    const j=await job('restart')
    if(j?.run_id){const bound=await readBoundRun(directory,actor('restart'),j);const selected=findIntendedRetry(eventsFor(j.run_id),actor('restart'),j,bound.input);if(selected){
      const run=await runFor(j,'restart');const runtime=JSON.parse(readFileSync(privateFile(resolve(directory,'runtime.json')),'utf8'))
      assert.equal(runtime.targetOrigin,url);assert.equal(runtime.stateDirectory,directory)
      checkpoint={actor:actor('restart'),job:j,runId:j.run_id,run,events:eventsFor(j.run_id),runtime,retryEvent:selected}
      privateFile(resolve(directory,'checkpoint.json'),JSON.stringify(checkpoint,null,2)+'\n')
      process.kill(runtime.pid,'SIGKILL');break
    }}
    await new Promise(done=>setTimeout(done,100))
  }
  assert.ok(checkpoint,'Intended job/run retry checkpoint not observed')
  proof('hosted_same_original_actor_job_run_retry_checkpoint_stopped',{sessionId:checkpoint.actor.sessionId,runId:checkpoint.runId,pid:checkpoint.runtime.pid})
}else if(mode==='restart-verify'){
  const checkpoint=JSON.parse(readFileSync(privateFile(resolve(directory,'checkpoint.json')),'utf8'))
  assert.equal(checkpoint.actor.userId,actor('restart').userId);assert.equal(checkpoint.actor.sessionId,actor('restart').sessionId)
  const completed=await waitCompleted('restart');assert.equal(completed.run_id,checkpoint.runId);assert.equal(completed.attempts,1)
  const run=await runFor(completed,'restart');assert.equal(run.status,'completed')
  const runtime=JSON.parse(readFileSync(privateFile(resolve(directory,'runtime.json')),'utf8'))
  for(const field of ['sourceCommit','lockSha256','buildId','artifactSha256','snapshot','stateDirectory'])assert.equal(runtime[field],checkpoint.runtime[field])
  assert.notEqual(runtime.pid,checkpoint.runtime.pid)
  const events=eventsFor(checkpoint.runId);assert.equal(events.filter(row=>row.event.eventType==='run_created').length,1)
  for(const before of checkpoint.events.filter(row=>row.event.eventType==='step_completed'))assert.equal(events.filter(row=>row.event.eventType==='step_started'&&row.event.correlationId===before.event.correlationId).length,1)
  const a=actor('restart');assert.equal(ok(await admin.from('assessments').select('id').eq('session_id',a.sessionId).eq('user_id',a.userId)).length,1)
  privateFile(resolve(directory,'restart-proof.json'),JSON.stringify({checkpoint,runtime,job:completed,run,events},null,2)+'\n')
  proof('hosted_same_original_run_normal_start_replay_unique_effects',{sessionId:a.sessionId,runId:checkpoint.runId,oldPid:checkpoint.runtime.pid,newPid:runtime.pid})
}else if(mode==='cron'){
  await createActor('cron')
  for(const text of ['Primera entrada cron ficticia','Segunda entrada cron ficticia','Tercera entrada cron ficticia'])assert.equal((await send('cron',text)).status,200)
  const ids=Object.values(manifest.actors).map(a=>a.userId),sessions=Object.values(manifest.actors).map(a=>a.sessionId).filter(Boolean)
  // Aggregate-only broad counts detect unrelated rows; no pre-existing row values are fetched.
  for(const [table,column,values]of [['clinical_sessions','user_id',ids],['assessment_jobs','session_id',sessions]]){
    const all=await admin.from(table).select('*',{count:'exact',head:true});ok(all)
    const own=await admin.from(table).select('*',{count:'exact',head:true}).in(column,values);ok(own)
    assert.equal(all.count,own.count,'Unrelated rows block global cron acceptance')
  }
  const a=actor('cron');ok(await admin.from('clinical_sessions').update({last_activity_at:new Date(Date.now()-31*60000).toISOString()}).eq('id',a.sessionId).eq('user_id',a.userId).eq('status','open'))
  for(const method of ['GET','POST'])assert.equal((await fetch(`${target.appOrigin}/api/internal/close-stale-sessions`,{method,redirect:'manual'})).status,401)
  const response=await fetch(`${target.appOrigin}/api/internal/close-stale-sessions`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`},redirect:'manual'})
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.ok,true);assert.ok(result.closed>=1);assert.ok(result.closed<=10);assert.ok(result.enqueued<=10);assert.equal(result.failed,0)
  const completed=await waitCompleted('cron');assert.equal(completed.attempts,1)
  const replay=await fetch(`${target.appOrigin}/api/internal/close-stale-sessions`,{method:'GET',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`},redirect:'manual'});assert.equal(replay.status,200)
  assert.equal(ok(await admin.from('assessments').select('id').eq('session_id',a.sessionId).eq('user_id',a.userId)).length,1)
  proof('hosted_actual_cookieless_bearer_bounded_recovery',{result,sessionId:a.sessionId,runId:completed.run_id})
}else if(mode==='browser-deadline'){
  const a=await createActor('deadline')
  const expiresAt=new Date(Date.now()+90_000)
  ok(await admin.from('clinical_sessions').update({opened_at:new Date(expiresAt.getTime()-60*60_000).toISOString(),last_activity_at:new Date().toISOString()}).eq('id',a.sessionId).eq('user_id',a.userId).eq('status','open'))
  a.expiresAt=expiresAt.toISOString();save()
  proof('hosted_visible_deadline_fixture_ready',{sessionId:a.sessionId,expiresAt:a.expiresAt})
}else if(mode==='browser-fixtures'){
  assert.equal((await send('browser','Solicito el cuestionario PHQ9')).status,200)
  proof('hosted_browser_fixture_ready',{fixtureManifest:path})
}else if(mode==='cleanup'){
  // Invoke only after the task-owned Next process is stopped and durable work completed.
  const runtime=JSON.parse(readFileSync(privateFile(resolve(directory,'runtime.json')),'utf8'))
  let live=false;try{process.kill(runtime.pid,0);live=true}catch{}
  assert.equal(live,false,'Stop only the recorded task-owned runtime before scoped cleanup')
  for(const name of Object.keys(manifest.actors)){
    const a=actor(name),auth=await login(name);ok(await auth.client.auth.signOut({scope:'global'}))
    ok(await admin.auth.admin.deleteUser(a.userId));a.cleanedAt=new Date().toISOString();save()
  }
  proof('hosted_scoped_auth_cleanup_after_global_fixture_signout',{actors:Object.keys(manifest.actors).length})
}else throw new Error('Unsupported hosted scenario mode')
