import { expect, it } from 'vitest'
import corpus from '@/tests/fixtures/ai-evaluation.json'
import { runOfflineEvaluation } from '@/lib/server/llm/evaluation'

it('reports technical fixture proof separately from every unrun provider/clinical gate', async () => {
  const report = await runOfflineEvaluation(corpus)
  expect(report).toMatchObject({ mode: 'offline_synthetic', onlineBudgetUsd: 0, caseSeeds: 26, online: { compatibility: 'NOT_RUN', quality: 'NOT_RUN', latency: 'NOT_RUN', calibration: 'NOT_RUN', measuredCost: 'NOT_RUN' }, clinicalGold: 'PENDING_HUMAN_APPROVAL' })
  expect(report.checks).toMatchObject({ corpus: 'PASS', lexicalFixtures: 'PASS', schemaFixtures: 'PASS', scorerFixture: 'PASS', promptOrder: 'PASS', auxiliaryFixtures: 'PASS', costFixture: 'PASS' })
  expect(report.prompts.map(p => p.version)).toEqual(['1.1.0', '1.1.0'])
  expect(report.schemaSha256).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(report)).not.toContain('Quiero matarme')
})

it('fails closed on duplicate IDs, family split leakage or a missing seed', async () => {
  await expect(runOfflineEvaluation({ ...corpus, cases: [...corpus.cases, corpus.cases[0]] })).rejects.toThrow('Invalid corpus')
  await expect(runOfflineEvaluation({ ...corpus, cases: corpus.cases.slice(1) })).rejects.toThrow('Invalid corpus')
  await expect(runOfflineEvaluation({ ...corpus, cases: corpus.cases.map((c, i) => i === 0 ? { ...c, split: 'heldout_proposed' } : c) })).rejects.toThrow('Family split leakage')
})
