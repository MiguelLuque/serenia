# Fictitious model evaluation manifest — plan only

Status on 2026-11-01: **ONLINE_NOT_RUN**. No provider access, transport compatibility, clinical quality, latency, token usage, or actual cost was measured. These are proposed human review prompts, not clinical gold labels. This manifest does not authorize paid calls or production model changes.

## Fixed input and provenance

| Source | IDs | SHA-256 |
| --- | --- | --- |
| `tests/fixtures/ai-evaluation.json`, `synthetic-seeds-1` | 26: R01–R10, Q01–Q04, C01–C02, X01–X03, T01–T02, A01–A05 | `eb4f218a28e25d40b990803d14addef7f2a97b9caf3111f4da9226d6fc90d8a4` |
| `tests/fixtures/profile-evaluation-2026-11-01.json`, `fictional-profile-plan-1` | P01–P17; P01–P15 provider review, P16–P17 state only | `70f5608956e82fdf1728d63745cdd720170546f29072db3718097b84c97d0332` |
| `lib/shared/llm/pricing-snapshot-2026-11-01.json` | Six exact Gateway IDs; Standard prices and tier arrays | Catalog SHA-256 `a0f22c61b24b6c3d7533ff1cfc581abe9ab30cc470edb79cce018f04660f45a8` |

Freeze these file hashes before any later execution. Changes require a new manifest version and a newly reviewed case list. No real patient material belongs in this corpus.

## Case routing and review

| Route | Fixed IDs | Candidate IDs | Maximum provider calls |
| --- | --- | --- | ---: |
| Conversation | R07, R09, Q01, Q04, C01, X02, X03, T01, T02 | `openai/gpt-6-luna`, `anthropic/claude-haiku-5.5` | 9 × 2 = 18 |
| Profile extraction | P01–P15 | `openai/gpt-6-luna`, `anthropic/claude-haiku-5.5` | 15 × 2 = 30 |
| Closure report draft | R03–R06, R10, Q02–Q04, A01–A05 | `openai/gpt-6.1-sol`, `anthropic/claude-sonnet-5.5` | 13 × 2 = 26 |
| Deterministic/state checks only | R01, R02, R08, X01, C02, P16, P17 | None | 0 |

R01/R02/R08 urgent paths stay under existing server checks and static responses. R03–R06 may inform report review, but their high-signal chat route must never be redirected to a model for this benchmark. X01 is rejected at the request boundary. C02 checks prompt assembly. P16 and P17 inspect rejection/source state without provider generation. The 26 existing seeds remain intact; this routing does not change `ai:evaluate:offline` or its positive environment policy.

For each candidate, inspect actual Gateway → provider routing, tool calls and continuations, JSON/schema validity, temporal and third-party attribution, negation, correction, abstention, evidence citations, and refusal/postponement handling. A clinician must approve the rubric and assess report usefulness, omissions, and unsupported claims. Record human decisions as proposed case-level observations, including disagreements; do not derive a clinical pass rate from schema validity or an LLM judge. `PENDING_HUMAN_APPROVAL` in the source is not a positive label.

## Execution caps and cost boundary

The planned benchmark allows one attempt per case/candidate, with **no retries, tool continuations, cache credits, or batch/fast/regional mode**. Maximum billable input/output tokens per call: conversation 8,000/2,500; profile 6,000/1,500; report 16,000/6,000. Output includes reasoning. Measure and enforce caps before any future run; abort a case if its assembled context exceeds its input cap. These caps and call counts bound the base Standard token calculation only, not external tools, storage, taxes, regional premiums, failed calls with usage, or reviewer labor.

At the short-context Standard snapshot rates, the **maximum base token estimate** is `(18 × (8,000×0.10 + 2,500×0.50) + 30 × (6,000×0.10 + 1,500×0.50) + 26 × (16,000×2 + 6,000×10)) / 1,000,000 = $2.4694`. This is a planning ceiling, not a spending authorization or an actual bill. If a call is retried or a tool continuation runs, count it as an additional billed attempt and revise the cap first. Missing usage remains `unknown`; never substitute zero. Long-context, cache write retention, region, service mode, and other unsupported charges must be resolved with authoritative rates before pricing those runs.

For a separate **synthetic session** comparison, `npm run ai:costs` prints current 20-message/20-profile/one-report cadence ($0.37725 all mini versus $0.10100 Luna/Luna/Sol) and a clearly hypothetical four-profile cadence ($0.23325 versus $0.08340). Those volumes are not observed usage and do not alter runtime extraction frequency. Price snapshot must be refreshed before any spend decision. Transport and clinical review remain **ONLINE_NOT_RUN**.
