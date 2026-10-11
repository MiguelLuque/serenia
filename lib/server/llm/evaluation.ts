import { createHash } from 'node:crypto'
import { strict as assert } from 'node:assert'
import { z } from 'zod'
import { AssessmentGenerationSchema } from '@/lib/server/assessments/generator'
import { buildChatSystemPrompt } from '@/lib/server/chat/system-prompt'
import { detectCrisis } from '@/lib/shared/chat/crisis-detector'
import { scorePHQ9 } from '@/lib/shared/questionnaires/scoring'
import { estimateCost } from '@/lib/shared/llm/candidates'
import { getPromptArtifact } from './prompts/loader'
import { evaluateAuxiliary } from './auxiliary'

const seed = z.strictObject({
  id: z.string().regex(/^[RQCXTA]\d{2}$/), family: z.enum(['R', 'Q', 'C', 'X', 'T', 'A']), split: z.enum(['development', 'heldout_proposed']), synthetic: z.literal(true), clinicalGold: z.literal('PENDING_HUMAN_APPROVAL'), seed: z.string().min(1), scenario: z.string().min(1), technicalObservation: z.string().min(1),
  messages: z.array(z.strictObject({ id: z.string().min(1), role: z.literal('user'), text: z.string().min(1), at: z.literal('2026-10-11T08:00:00Z') })).min(1),
})
const corpusSchema = z.strictObject({ version: z.literal('synthetic-seeds-1'), provenance: z.literal('docs/audits/2026-10-11-ai-evaluation-preparation.md'), cases: z.array(seed).length(26) })
const requiredIds = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'Q01', 'Q02', 'Q03', 'Q04', 'C01', 'C02', 'X01', 'X02', 'X03', 'T01', 'T02', 'A01', 'A02', 'A03', 'A04', 'A05']
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

// Deliberately contains no network transport. These assertions exercise current
// deterministic code against hand-authored fixtures, never model responses.
export async function runOfflineEvaluation(rawCorpus: unknown) {
  const parsed = corpusSchema.safeParse(rawCorpus)
  if (!parsed.success) throw Error('Invalid corpus')
  const corpus = parsed.data
  const ids = corpus.cases.map(c => c.id)
  if (new Set(ids).size !== 26 || requiredIds.some(id => !ids.includes(id))) throw Error('Invalid corpus')
  for (const family of ['R', 'Q', 'C', 'X', 'T', 'A']) {
    if (new Set(corpus.cases.filter(c => c.family === family).map(c => c.split)).size !== 1) throw Error('Family split leakage')
  }
  for (const c of corpus.cases) {
    if (!c.id.startsWith(c.family) || new Set(c.messages.map(m => m.id)).size !== c.messages.length) throw Error('Invalid corpus')
  }
  // Permissive lexical behavior includes negation, past, quote and other subject.
  // It is explicitly not an LLM quality or clinical-risk expectation.
  for (const [id, detected] of Object.entries({ R01: true, R02: true, R03: true, R04: true, R05: true, R06: true, R07: false, R08: true, R09: false })) {
    assert.equal(detectCrisis(corpus.cases.find(c => c.id === id)!.messages[0].text).detected, detected, `lexical fixture ${id}`)
  }
  const fixture = {
    chief_complaint: 'Datos insuficientes en esta sesión.', presenting_issues: [], mood_affect: '', cognitive_patterns: [], questionnaires: [], areas_for_exploration: [], preliminary_impression: '', recommended_actions_for_clinician: [], patient_facing_summary: '', proposed_tasks: [],
    risk_assessment: { suicidality: 'none', self_harm: 'none', heteroaggression: 'none', substance_use_acute: null, notes: '' },
  }
  assert.equal(AssessmentGenerationSchema.safeParse(fixture).success, true, 'valid hand-authored schema fixture')
  for (const invalid of [
    { ...fixture, risk_assessment: { suicidality: 'none', self_harm: 'none', notes: '' } },
    { ...fixture, risk_assessment: { ...fixture.risk_assessment, suicidality: 'unknown' } },
    { ...fixture, proposed_tasks: [{ descripcion: 'Actividad sintética' }] },
    { ...fixture, questionnaires: [{ code: 'PHQ9', score: NaN, band: 'mild', flags: [] }] },
  ]) assert.equal(AssessmentGenerationSchema.safeParse(invalid).success, false, 'invalid schema fixture')
  assert.deepEqual(scorePHQ9([1, 1, 1, 1, 1, 1, 1, 1, 0]), { totalScore: 8, severityBand: 'mild', subscores: {}, flags: [], requiresReview: false })
  const pieces = { basePrompt: 'B', riskOpeningNotice: 'R', crisisNotice: 'C', questionnaireNotice: 'Q', timeNotice: 'T', intakeBlock: 'I', patientContextBlock: 'P', protocolPhaseBlock: 'F' }
  assert.equal(buildChatSystemPrompt(pieces), 'BRCQTIPF')
  assert.equal(buildChatSystemPrompt({ ...pieces, crisisNotice: '', patientContextBlock: '' }), 'BRQTIF')
  assert.deepEqual(await evaluateAuxiliary('Texto sintético', { provider: 'openai', mode: 'off', transport: async () => { throw Error('Offline network transport must never run') } }), { status: 'abstain', reason: 'disabled', intent: 'shadow_review_only' })
  const syntheticResponse = JSON.stringify({ model: 'jev-1.13.0', answers: { theme: { type: 'choice', choice: 'insufficient', confidence: 1, probabilities: { work: 0, sleep: 0, other: 0, insufficient: 1 } } }, usage: { input_tokens: 100, output_tokens: 1 } })
  assert.equal((await evaluateAuxiliary('Texto sintético', { provider: 'jev', mode: 'shadow', transport: async () => ({ status: 200, body: syntheticResponse }) })).status, 'abstain')
  assert.equal((await evaluateAuxiliary('Texto sintético', { provider: 'openai', mode: 'shadow', transport: async () => ({ status: 200, body: '{}' }) })).status, 'error')
  assert.deepEqual(estimateCost('decisionsLuna', { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }), { status: 'estimated', usd: .0001, pricingSnapshot: '2026-10-11', measured: false })
  const prompts = ['docs/agents/prompts/session-therapist.md', 'docs/agents/prompts/clinical-report.md'].map(path => {
    const artifact = getPromptArtifact(path)
    return { path: artifact.path, version: artifact.version, sourceSha256: artifact.sourceSha256, bodySha256: artifact.bodySha256 }
  })
  return {
    mode: 'offline_synthetic', onlineBudgetUsd: 0, caseSeeds: corpus.cases.length, clinicalGold: 'PENDING_HUMAN_APPROVAL',
    corpusSha256: hash(JSON.stringify(corpus)), schemaSha256: hash(JSON.stringify(z.toJSONSchema(AssessmentGenerationSchema))), prompts,
    checks: { corpus: 'PASS', lexicalFixtures: 'PASS', schemaFixtures: 'PASS', scorerFixture: 'PASS', promptOrder: 'PASS', auxiliaryFixtures: 'PASS', costFixture: 'PASS' },
    online: { compatibility: 'NOT_RUN', quality: 'NOT_RUN', latency: 'NOT_RUN', calibration: 'NOT_RUN', measuredCost: 'NOT_RUN' },
    limits: '26 case seeds, 9 lexical fixtures, 1 valid/4 invalid schema fixtures, PHQ9 fixture, 2 prompt order fixtures, auxiliary off/abstain/error and tariff arithmetic. Not 26 model runs or route integration runs. Human rubric and heldout split are proposed, not approved.',
  } as const
}
