// External synthetic preload: no app auth, route or Workflow lifecycle overrides.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import net from 'node:net'
import { syncBuiltinESMExports } from 'node:module'
import { privateDirectory, readControl } from './acceptance-local.mjs'
const directory = privateDirectory(process.env.SERENIA_ACCEPTANCE_DIR)
const ledger = resolve(directory, 'provider.jsonl')
const record = data => appendFileSync(ledger, JSON.stringify({ at: new Date().toISOString(), pid: process.pid, ...data }) + '\n', { mode: 0o600 })
const originalConnect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0]
  const host = typeof options === 'object' ? options.host : typeof args[1] === 'string' ? args[1] : undefined
  const port = Number(typeof options === 'object' ? options.port : options)
  if (host !== '127.0.0.1' || ![3000, 54321].includes(port)) {
    record({ kind: 'network_denied', host: String(host), port: Number.isFinite(port) ? port : null })
    throw new Error('Acceptance network boundary denied destination')
  }
  return originalConnect.apply(this, args)
}
syncBuiltinESMExports()
const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (!['http://127.0.0.1:3000', 'http://127.0.0.1:54321'].includes(url.origin)) {
    record({ kind: 'network_denied', host: url.hostname, port: url.port })
    throw new Error('Acceptance network boundary denied destination')
  }
  if (url.pathname.startsWith('/.well-known/workflow/')) {
    const headers = new Headers(init?.headers)
    record({ kind: 'workflow_http', path: url.pathname, messageId: headers.get('x-vqs-message-id'), attempt: headers.get('x-vqs-message-attempt') })
  }
  return originalFetch(input, init)
}
const syntheticSummary = {
  chief_complaint: 'Consulta ficticia de aceptación técnica', presenting_issues: ['Estrés ficticio'], mood_affect: 'Sintético', cognitive_patterns: [], questionnaires: [],
  areas_for_exploration: ['Revisión humana del caso ficticio'], preliminary_impression: 'ORIENTACION_PRIVADA_SINTETICA',
  recommended_actions_for_clinician: ['Revisar el informe sintético'], patient_facing_summary: 'Resumen ficticio pendiente de revisión clínica.',
  risk_assessment: { suicidality: 'none', self_harm: 'none', heteroaggression: 'none', substance_use_acute: null, notes: 'NOTA_PRIVADA_SINTETICA' },
  proposed_tasks: [{ descripcion: 'Registrar una actividad agradable ficticia', nota: null }],
}
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }
function attempt(modelId, prompt) {
  const marker = createHash('sha256').update(JSON.stringify(prompt)).digest('hex').slice(0, 16)
  const prior = existsSync(ledger) ? readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.kind === 'model' && row.marker === marker).length : 0
  record({ kind: 'model', modelId, marker, attempt: prior + 1 })
  return prior + 1
}
function model(modelId) {
  if (!['synthetic/conversational', 'synthetic/fast', 'synthetic/structured'].includes(modelId)) { record({ kind: 'model_denied', modelId }); throw new Error('Unexpected synthetic model') }
  return { specificationVersion: 'v3', provider: 'synthetic', modelId, supportedUrls: {},
    async doGenerate(options) {
      attempt(modelId, options.prompt)
      if (modelId !== 'synthetic/structured') throw new Error('Unexpected generate mode')
      if (readControl(directory).structured === 'fail') throw new Error('Synthetic durable retry checkpoint')
      return { content: [{ type: 'text', text: JSON.stringify(syntheticSummary) }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }
    },
    async doStream(options) {
      const count = attempt(modelId, options.prompt)
      const latest = options.prompt.filter(message => message.role === 'user').at(-1)
      const text = (latest?.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('')
      if (text.includes('[FALLO_UNICO]') && count === 1) throw new Error('Synthetic recoverable chat failure')
      if (text.includes('[ESPERA]')) await new Promise(resolve => setTimeout(resolve, 15000))
      let name, input
      if (/cuestionario|phq/i.test(text)) { name = 'propose_questionnaire'; input = { code: text.includes('[CSSRS]') ? 'CSSRS' : 'PHQ9', reason: 'Aceptación ficticia del cuestionario solicitado' } }
      if (/propongo cerrar/i.test(text)) { name = 'propose_close_session'; input = { reason: 'user_request' } }
      if (/^s[ií],? cerramos[.!\s]*$/i.test(text.trim())) { name = 'confirm_close_session'; input = { reason: 'user_request' } }
      const response = name === 'propose_questionnaire' ? 'Aquí tienes el cuestionario solicitado para esta prueba ficticia.' : name === 'propose_close_session' ? '¿Quieres cerrar la sesión?' : name === 'confirm_close_session' ? 'Cerramos la sesión. El informe queda pendiente de revisión.' : 'Respuesta sintética: gracias por compartirlo. ¿Cómo te has sentido hoy?'
      const parts = [{ type: 'stream-start', warnings: [] }, { type: 'text-start', id: 'text' }, { type: 'text-delta', id: 'text', delta: response }, { type: 'text-end', id: 'text' }]
      if (name) parts.push({ type: 'tool-call', toolCallId: randomUUID(), toolName: name, input: JSON.stringify(input) })
      parts.push({ type: 'finish', usage, finishReason: { unified: name ? 'tool-calls' : 'stop', raw: 'synthetic' } })
      return { stream: new ReadableStream({ start(controller) { parts.forEach(part => controller.enqueue(part)); controller.close() } }) }
    },
  }
}
globalThis.AI_SDK_DEFAULT_PROVIDER = { specificationVersion: 'v3', languageModel: model, embeddingModel() { throw new Error('Unsupported embedding') }, imageModel() { throw new Error('Unsupported image') } }
record({ kind: 'preload', node: process.version })
