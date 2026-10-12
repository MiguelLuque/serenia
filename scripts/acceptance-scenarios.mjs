import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { localOrigin, privateDirectory } from './acceptance-local.mjs'
const directory = privateDirectory(process.env.SERENIA_ACCEPTANCE_DIR)
const url = localOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL, 54321)
const app = localOrigin(process.env.NEXT_PUBLIC_SITE_URL, 3000)
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const password = 'Synthetic-Only-2026!'
const manifestPath = resolve(directory, 'fixtures.json')
const proof = (name, detail = {}) => { const row = { at: new Date().toISOString(), name, status: 'PASS', ...detail }; appendFileSync(resolve(directory, 'checks.jsonl'), JSON.stringify(row) + '\n', { mode: 0o600 }); console.log(JSON.stringify(row)) }
const ok = result => { if (result.error) throw new Error(JSON.stringify({ message: result.error.message, code: result.error.code })); return result.data }
async function login(actor) {
  const cookies = new Map()
  const client = createServerClient(url, key, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: rows => rows.forEach(({ name, value }) => cookies.set(name, value)) } })
  const data = ok(await client.auth.signInWithPassword({ email: actor.email, password }))
  assert.equal(data.user.id, actor.userId)
  assert.equal(ok(await client.auth.getUser()).user.id, actor.userId)
  return { client, cookie: () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') }
}
async function makeActor(name) {
  const email = `serenia-${name}-${Date.now()}@example.test`
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user
  return { email, userId: user.id, name }
}
const onboarding = { p_informal_name: 'Paciente ficticio', p_pronouns: 'elle', p_birth_date: '1990-01-01', p_reason: 'Verificación técnica con datos ficticios', p_version: 'technical-draft-2026-10-11', p_accepted: true }
async function preparePatient(name) {
  const actor = await makeActor(name)
  const { client } = await login(actor)
  ok(await client.rpc('complete_patient_onboarding', { ...onboarding, p_informal_name: `Ficticio ${name}` }))
  const session = ok(await client.rpc('create_session_atomic', { p_user_id: actor.userId }))
  return { ...actor, sessionId: session.id, conversationId: session.conversation_id, url: `${app}/app/sesion/${session.id}` }
}
async function send(actor, text, requestId = randomUUID()) {
  const auth = await login(actor)
  const response = await fetch(`${app}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: auth.cookie() }, body: JSON.stringify({ sessionId: actor.sessionId, requestId, messages: [{ id: requestId, role: 'user', parts: [{ type: 'text', text }] }] }) })
  return { status: response.status, body: await response.text(), requestId }
}
const save = manifest => writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
const mode = process.argv[2]
if (mode === 'fixtures') {
  const manifest = { password, app, createdAt: new Date().toISOString(), actors: {} }
  const actor = await makeActor('gate')
  const { client } = await login(actor)
  assert.equal(ok(await client.rpc('get_onboarding_ready')), false)
  assert.ok((await client.rpc('create_session_atomic', { p_user_id: actor.userId })).error)
  for (const date of ['2015-01-01', '2026-02-30', 'infinity']) assert.ok((await client.rpc('complete_patient_onboarding', { ...onboarding, p_birth_date: date })).error)
  assert.ok((await client.rpc('complete_patient_onboarding', { ...onboarding, p_accepted: false })).error)
  ok(await client.rpc('complete_patient_onboarding', onboarding))
  assert.equal(ok(await client.rpc('get_onboarding_ready')), true)
  assert.ok((await client.from('user_profiles').update({ role: 'clinician' }).eq('user_id', actor.userId)).error)
  assert.ok((await client.from('consents').insert({ user_id: actor.userId, consent_version: 'fake' })).error)
  const consents = ok(await admin.from('consents').select('server_recorded,consent_version').eq('user_id', actor.userId))
  assert.equal(consents.length, 1); assert.equal(consents[0].server_recorded, true)
  proof('real_auth_jwt_onboarding_grants', { userId: actor.userId, invalidDates: 3 })
  for (const name of ['runtime', 'chat', 'cssrs', 'retry', 'pending', 'urgent', 'boundary', 'closure', 'older']) { manifest.actors[name] = await preparePatient(name); save(manifest) }
  manifest.actors.clinician = await makeActor('clinician')
  ok(await admin.from('user_profiles').update({ role: 'clinician' }).eq('user_id', manifest.actors.clinician.userId))
  const a = manifest.actors.chat, b = manifest.actors.retry
  const authA = await login(a)
  assert.deepEqual(ok(await authA.client.from('clinical_sessions').select('id').eq('id', b.sessionId)), [])
  assert.ok((await authA.client.rpc('close_session_atomic', { p_session_id: b.sessionId, p_user_id: b.userId, p_reason: 'user_request' })).error)
  assert.ok((await authA.client.from('assessments').insert({ user_id: a.userId, session_id: a.sessionId, assessment_type: 'closure', status: 'draft_ai' })).error)
  assert.ok((await authA.client.rpc('get_patient_session_reports', { p_session_ids: [b.sessionId] })).error)
  save(manifest)
  proof('real_auth_jwt_rls_cross_owner', { patient: a.userId, foreignSession: b.sessionId })
  console.log(`Fictional fixtures: ${manifestPath}`)
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (mode === 'restart-checkpoint') {
    const actor = await preparePatient('restart')
    manifest.actors.restart = actor; save(manifest)
    const eventsPath = resolve(directory, 'workflow/events')
    const prior = new Set(readdirSync(eventsPath))
    let stopped = false
    const timer = setInterval(() => {
      for (const name of readdirSync(eventsPath).filter(name => name.endsWith('.json') && !prior.has(name))) {
        const event = JSON.parse(readFileSync(resolve(eventsPath, name), 'utf8'))
        if (event.eventType !== 'step_retrying') continue
        const runtime = JSON.parse(readFileSync(resolve(directory, 'runtime.json'), 'utf8'))
        writeFileSync(resolve(directory, 'checkpoint.json'), JSON.stringify({ runId: event.runId, eventFile: name, event, actor, runtime }, null, 2), { mode: 0o600 })
        process.kill(runtime.pid, 'SIGKILL'); stopped = true; clearInterval(timer)
        proof('durable_retry_checkpoint_stopped', { runId: event.runId, eventFile: name, sessionId: actor.sessionId, pid: runtime.pid })
      }
    }, 20)
    try {
      for (const text of ['Primera entrada ficticia', 'Segunda entrada ficticia', 'Tercera entrada ficticia', 'Propongo cerrar esta sesión', 'Sí, cerramos']) assert.equal((await send(actor, text)).status, 200)
      await new Promise(done => setTimeout(done, 1500))
      assert.ok(stopped, 'No durable retry checkpoint observed')
    } finally { clearInterval(timer) }
  }
  if (mode === 'boundary-expire') {
    const actor = manifest.actors.boundary
    const rows = ok(await admin.from('clinical_sessions').update({ opened_at: new Date(Date.now() - 61 * 60_000).toISOString() }).eq('id', actor.sessionId).eq('user_id', actor.userId).eq('status', 'open').select('id'))
    assert.equal(rows.length, 1, 'The synthetic browser boundary session must still be open')
    proof('browser_boundary_expired_after_page_entry', { sessionId: actor.sessionId })
  }
  if (mode === 'http') {
    for (const path of ['flow', 'step']) {
      const response = await fetch(`${app}/.well-known/workflow/v1/${path}?__health`, { method: 'POST', redirect: 'manual' }); assert.equal(response.status, 200)
      const malformed = await fetch(`${app}/.well-known/workflow/v1/${path}`, { method: 'POST', body: '{}', redirect: 'manual' }); assert.equal(malformed.status, 400)
    }
    proof('generated_workflow_http_routes')
    const actor = manifest.actors.runtime
    for (const text of ['Primera conversación ficticia', 'Me encuentro tranquilo en esta prueba', 'Solicito el cuestionario PHQ9']) { const response = await send(actor, text); assert.equal(response.status, 200, response.body) }
    const instance = ok(await admin.from('questionnaire_instances').select('id').eq('session_id', actor.sessionId).single())
    const auth = await login(actor)
    const response = await fetch(`${app}/api/questionnaires/${instance.id}/answers`, { method: 'POST', headers: { Cookie: auth.cookie(), 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: Array.from({ length: 9 }, (_, index) => ({ itemOrder: index + 1, valueNumeric: 0, valueRaw: '0' })) }) })
    assert.equal(response.status, 200, await response.text())
    assert.equal(ok(await admin.from('questionnaire_results').select('id').eq('instance_id', instance.id)).length, 1)
    const retryId = randomUUID()
    assert.equal((await send(actor, '[FALLO_UNICO] Ensayo de recuperación', retryId)).status, 503)
    assert.equal((await send(actor, '[FALLO_UNICO] Ensayo de recuperación', retryId)).status, 200)
    assert.equal((await send(actor, 'Mensaje ordinario tras recuperación')).status, 200)
    const turn = ok(await admin.from('chat_turns').select('status,attempts,user_message_id').eq('session_id', actor.sessionId).eq('request_id', retryId).single())
    assert.equal(turn.status, 'completed'); assert.equal(turn.attempts, 2)
    proof('real_http_chat_phq_retry', { sessionId: actor.sessionId, instanceId: instance.id, requestId: retryId, turn })
  }
  if (mode === 'closure') {
    const actor = manifest.actors.runtime
    assert.equal((await send(actor, 'Propongo cerrar esta sesión')).status, 200)
    assert.equal((await send(actor, 'Sí, cerramos')).status, 200)
    proof('real_http_closure', { sessionId: actor.sessionId })
  }
  if (mode === 'inspect') {
    const actor = manifest.actors.runtime
    const jobs = ok(await admin.from('assessment_jobs').select('session_id,status,run_id,attempts').eq('session_id', actor.sessionId))
    const assessments = ok(await admin.from('assessments').select('id,status,session_id').eq('session_id', actor.sessionId))
    console.log(JSON.stringify({ jobs, assessments }))
  }
  if (mode === 'review') {
    const actor = manifest.actors.restart ?? manifest.actors.runtime
    const patient = await login(actor)
    assert.deepEqual(ok(await patient.client.from('assessments').select('*').eq('session_id', actor.sessionId)), [])
    const before = ok(await patient.client.rpc('get_patient_session_reports', { p_session_ids: [actor.sessionId] }))
    assert.equal(before[0].state, 'pending_review'); assert.equal(before[0].summary, null)
    const report = ok(await admin.from('assessments').select('*').eq('session_id', actor.sessionId).neq('status', 'superseded').single())
    assert.equal(report.status, 'draft_ai')
    const clinician = await login(manifest.actors.clinician)
    const summary = { ...report.summary_json, patient_facing_summary: 'Resumen ficticio revisado y vigente.', risk_assessment: { suicidality: 'passive', self_harm: 'historic', heteroaggression: 'verbal', substance_use_acute: 'suspected', notes: 'NOTA_PRIVADA_REVISADA' } }
    const args = { p_session_id: actor.sessionId, p_assessment_id: report.id, p_action: 'modify', p_summary: summary, p_notes: 'NOTA_CLINICA_PRIVADA', p_inherited_updates: [] }
    assert.ok((await patient.client.rpc('review_assessment_atomic', args)).error)
    const reviewedId = ok(await clinician.client.rpc('review_assessment_atomic', args))
    assert.equal(ok(await clinician.client.rpc('review_assessment_atomic', args)), reviewedId)
    const projection = ok(await patient.client.rpc('get_patient_session_reports', { p_session_ids: [actor.sessionId] }))
    assert.equal(projection[0].summary, summary.patient_facing_summary)
    assert.ok(!JSON.stringify(projection).includes('PRIVADA'))
    assert.deepEqual(ok(await patient.client.from('assessments').select('*').eq('session_id', actor.sessionId)), [])
    const live = ok(await admin.from('assessments').select('id').eq('session_id', actor.sessionId).not('status', 'in', '(superseded,rejected)'))
    assert.equal(live.length, 1)
    proof('real_jwt_private_projection_clinical_review', { sessionId: actor.sessionId, originalId: report.id, reviewedId, projection })
  }
  if (mode === 'safety') {
    for (const boundary of [false, true]) {
      const actor = await preparePatient(boundary ? 'api-boundary' : 'api-urgent')
      assert.equal((await send(actor, 'Solicito el cuestionario PHQ9')).status, 200)
      if (boundary) ok(await admin.from('clinical_sessions').update({ opened_at: new Date(Date.now() - 61 * 60_000).toISOString() }).eq('id', actor.sessionId))
      const countCalls = () => readFileSync(resolve(directory, 'provider.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)).filter(row => row.kind === 'model' && row.modelId === 'synthetic/conversational').length
      const beforeCalls = countCalls()
      const response = await send(actor, 'Voy a suicidarme ahora, tengo un plan para hacerlo')
      assert.equal(countCalls() - beforeCalls, 0, 'High-signal resources must not depend on a model call')
      assert.equal(response.status, 200); assert.ok(response.body.includes('112'), response.body)
      const risks = ok(await admin.from('risk_events').select('id,severity').eq('session_id', actor.sessionId))
      assert.ok(risks.length > 0)
      const session = ok(await admin.from('clinical_sessions').select('status,closure_reason').eq('id', actor.sessionId).single())
      if (boundary) { assert.equal(session.status, 'closed'); assert.equal(session.closure_reason, 'crisis_detected') }
      if (!boundary) assert.equal(session.status, 'open')
      proof('real_http_new_urgent_signal', { boundary, actor, session, risks, conversationalCalls: 0 })
    }
  }
  if (mode === 'safety' || mode === 'safety-interrupted') {
    const actor = await preparePatient('api-interrupted')
    const failed = await send(actor, `[FALLO_UNICO] Mensaje ficticio interrumpido ${actor.userId}`)
    assert.equal(failed.status, 503)
    const requestId = randomUUID()
    const text = 'Voy a suicidarme ahora, tengo un plan para hacerlo'
    const callsBefore = readFileSync(resolve(directory, 'provider.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)).filter(row => row.kind === 'model' && row.modelId === 'synthetic/conversational').length
    const first = await send(actor, text, requestId), replay = await send(actor, text, requestId)
    const callsAfter = readFileSync(resolve(directory, 'provider.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)).filter(row => row.kind === 'model' && row.modelId === 'synthetic/conversational').length
    assert.equal(callsAfter, callsBefore)
    assert.equal(first.status, 200); assert.ok(first.body.includes('112')); assert.deepEqual(replay.body.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6))), first.body.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6))))
    const turns = ok(await admin.from('chat_turns').select('request_id,status,attempts').eq('session_id', actor.sessionId))
    assert.equal(turns.length, 2); assert.equal(turns.find(t => t.request_id === failed.requestId).status, 'interrupted'); assert.equal(turns.find(t => t.request_id === requestId).attempts, 1)
    assert.equal(ok(await admin.from('risk_events').select('id').eq('session_id', actor.sessionId)).length, 1)
    proof('real_http_urgent_interruption_replay', { actor, requestId, turns, conversationalCalls: 0 })
  }
  if (mode === 'browser-fixtures') {
    assert.equal((await send(manifest.actors.cssrs, '[CSSRS] Solicito el cuestionario')).status, 200)
    for (const name of ['chat', 'urgent', 'boundary']) assert.equal((await send(manifest.actors[name], 'Solicito el cuestionario PHQ9')).status, 200)
    for (const name of ['closure', 'older']) {
      const actor = manifest.actors[name]
      for (const text of ['Primera entrada ficticia', 'Segunda entrada ficticia', 'Tercera entrada ficticia', 'Propongo cerrar esta sesión', 'Sí, cerramos']) assert.equal((await send(actor, text)).status, 200)
    }
    const retryId = randomUUID()
    assert.equal((await send(manifest.actors.retry, '[FALLO_UNICO] Mensaje ficticio para reintentar', retryId)).status, 503)
    manifest.actors.retry.requestId = retryId
    // Preconditions only: no app bypass. The real route still applies expiry/risk.
    // Browser: enter the open boundary page first; set its local DB expiry
    // only after the reviewer is ready, so the real lazy-close page gate is preserved.
    ok(await admin.from('clinical_sessions').update({ closed_at: '2026-01-01T12:00:00Z' }).eq('id', manifest.actors.older.sessionId))
    ok(await admin.from('risk_events').insert({ user_id: manifest.actors.older.userId, session_id: manifest.actors.older.sessionId, risk_type: 'suicidal_ideation', severity: 'critical', source_type: 'message', payload_json: { synthetic: true }, status: 'open' }))
    save(manifest)
    proof('browser_fixture_preconditions', { fixtures: manifestPath })
  }
}
