# Task 2 report — task-specific model policies

Status: IMPLEMENTED / LOCAL_CHECKS_PASS / REVIEW_PENDING.
Commit: `d4b39e899a10f71934d0f889d57d82c704413818` (parent `2b149e4`).
Working directory for every command: `/Users/miguelluque/git/serenia`.
Only the 16 assigned source/config/test paths were committed. Root audit/research/spec/plan files and the root-owned `lib/server/patient-context/builder.ts` comment remain untouched/uncommitted.

## Interface and behavior

`lib/shared/llm/task-policy.ts` exports:

```ts
type LLMTask = 'conversation' | 'profileExtraction' | 'closureReport'
interface TaskPolicy<T extends LLMTask = LLMTask> {
  task: T
  modelId: string
  timeoutMs: number
  maxOutputTokens: number
  maxRetries: 0
}
resolveTaskPolicy<T extends LLMTask>(task: T, env: Record<string, string | undefined> = process.env): TaskPolicy<T>
```

- Conversation: `LLM_CONVERSATIONAL_*`, 45_000 ms / 2500 output tokens / SDK retries 0.
- Profile extraction: optional `LLM_PROFILE_EXTRACTION_PROVIDER` + `LLM_PROFILE_EXTRACTION_MODEL`, 20_000 ms / 1500 / 0.
- Closure report: optional `LLM_CLOSURE_REPORT_PROVIDER` + `LLM_CLOSURE_REPORT_MODEL`, 45_000 ms / 6000 / 0.
- Only entirely absent/blank new pairs fall back to legacy `LLM_STRUCTURED_*`. A partial or malformed pair throws a safe error naming both variables without their values. Routing syntax validation does not assert catalogue availability/access. Legacy provider omission retains its existing Anthropic fallback. `getRoleConfig` and `llm.conversational/structured/fast` remain compatible; `getRoleConfig` additionally accepts an optional environment for pure task resolution. Fast has no runtime consumer.
- Chat uses one captured policy for its ID, initial cap, total two-step cap, timeout and retries. Existing tools, ordering, step counts and context behavior stay intact.
- Profile worker resolves once immediately before generation, passes the same policy as optional extractor third argument, and persists its captured `modelId` after awaiting extraction. Two-argument extractor callers resolve their own policy. Literal quote/schema/consent/claim/fence validation is unchanged.
- Durable and legacy report generation use the same task policy and limits. The durable step retains `maxRetries = 3`; profile step retains `maxRetries = 0`. Both report generators sanitize only SDK generation rejection to `Error('assessment_generation_failed')` without cause, preserving evidence/claim error branches. Existing success logs add only `requestedModel`.
- `.env.example` adds blank optional override pairs and fallback explanation; existing role values are unchanged. Relevant path and authentication comments no longer assume token delivery/expiry; production/remote configuration is unchanged.

## RED evidence

1. Initial project-checks skill runner could not create its fixed log under `/Users/miguelluque/git/ai-workbench/logs` (sandbox EPERM, before tests). I copied that runner unchanged to `/private/tmp/serenia-task2-project-checks.py`; first runs used its `/private/tmp/logs` output. Root then supplied the intended existing `.cache/pablo-pilot/project_checks.py` path, used thereafter. No runner repository file was changed.
2. `/private/tmp/logs/20261101-183952-_n4wncz1.log`: missing new policy module; profile captured-policy/metadata and report override/retry boundaries failed. SDK retry probes initially hit the default 5s test timeout; raised test timeout to 15s so the real default retries could finish.
3. `/private/tmp/logs/20261101-184017-q4gwtcre.log`: both report probes used real AI SDK `generateObject` and real Gateway provider with in-memory synthetic 503 fetch, observing **3 attempts rather than 1**. Profile capture/metadata and report override/limit assertions also failed. One extractor fixture parse mistake was corrected immediately, before production implementation.
4. `.cache/pablo-pilot/logs/20261101-184033-at334f87.log`: extractor captured-policy RED, `synthetic/structured` observed instead of `synthetic/captured`; 21 existing extractor tests passed.
5. `.cache/pablo-pilot/logs/20261101-184223-5rxb8mos.log`: separate SDK-error safety RED after root's scoped clarification; both report generators exposed `SENSITIVE_SYNTHETIC_SDK_PAYLOAD` instead of the safe code. The new probes cover error cause and durable return/log/manual-review persistence.

## GREEN checks

All following use `rtk proxy python3 /Users/miguelluque/git/serenia/.cache/pablo-pilot/project_checks.py run /Users/miguelluque/git/serenia -- ...` and preserve full logs.

- Focused command: `npm test -- tests/llm/task-policy.test.ts tests/profile tests/assessments/generator.test.ts tests/workflows/generate-assessment.test.ts tests/api/chat-route.test.ts tests/chat/clinical-pilot.test.ts tests/chat/tool-feedback.test.ts` — exit 0, **15 files / 265 tests**; log `.cache/pablo-pilot/logs/20261101-184233-cl6cjkwh.log`.
- `npm run lint` — exit 0; log `.cache/pablo-pilot/logs/20261101-184234-x9vex7fd.log`.
- `npm run typecheck` — exit 0; log `.cache/pablo-pilot/logs/20261101-184235-9aug9dnx.log`.
- First `npm test` — exit 1, **89 files / 1136 tests passed, 4 failed**, solely existing loopback `listen EPERM` probes in `tests/tooling/dependency-integration.test.ts`: trailing bytes/compressed-body next request; excessive encodings through provider-utils; excessive encodings through world-local; mixed-case SRI through Workflow transport. Full log `.cache/pablo-pilot/logs/20261101-184243-l3176lzk.log` inspected.
- Same `npm test` command rerun with authorized sandbox escalation for existing ephemeral 127.0.0.1 tests — exit 0, **90 files / 1140 tests**; log `.cache/pablo-pilot/logs/20261101-184337-8fyygmbm.log`. Existing `TimeoutNaNWarning` remains visible in this full log.
- `git diff --check` and staged `git diff --cached --check` — exit 0. Git staging/commit needed authorized escalation because sandbox blocked `.git/index.lock`; only assigned paths were staged.

## Limits / handoff

No audit rerun (known strict gate blockage retained), build, SQL, dependencies, remote service/configuration, `.env.local`/credential reading, real provider/model call, key/budget/cost operation, production promotion or deployment. The synthetic SDK test uses a reserved invalid hostname and custom in-memory fetch; it opens no sockets. Local evidence does not establish Gateway/provider access or clinical quality. Root owns final review, committed-document build and remaining release gates.
