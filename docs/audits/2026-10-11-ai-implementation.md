# Implementación y revisión de IA — Task5

Estado: completa y revisada, commits `9d63871` y `4e14be8`. Offline y trazado verificados; aceptación integral Task6 y calidad/proveedores online siguen pendientes.

## Informe de implementación y fix

# Task5 implementation report — 2026-10-11

## Implementation

Commit `9d6387155e3704e340766f544f67b55d5ad99082` (`feat(ai): add offline evaluation and bounded shadow candidates`), parent `3fa42f7742969e8b9fb444eb0a3cc80d6131d3ba`, branch `codex/serenia-robust-mvp`.

- Typed research presets for Sonnet4.6/Haiku4.5/Sol6.1/Sonnet5.5/Luna6 and dedicated DecisionsLuna/Jev1.13 endpoints. `getRoleConfig`, models, patient chat/workflow and questionnaire scoring untouched. Candidate tariffs are frozen research estimates, not measured savings/clinical superiority.
- Small server-only, transport-injected theme adapter: work/sleep/other/insufficient only. Feature flag absent/unknown off; shadow readonly review intent; no fetch/client/credentials/persistence/patient caller. Jev native questions/answers maps, OpenAI questions/answers/probability arrays, full official required metadata validation. One attempt,2s abort signal,4000characters/12000bytes input,16384bytes response. Refusal/insufficient→abstain; HTTP/transport/timeout/JSON/schema/identity/distribution errors sanitized. No new clinical labels, confidence threshold, spans or invented evidence. Confidence retains provider value without claiming calibration.
- Offline-only CLI `rtk npm run ai:evaluate:offline`:26 Spanish synthetic seed records with family-separated proposed development/heldout split and clinical gold PENDING_HUMAN_APPROVAL. Real deterministic schema/scorer/lexical/order helpers and synthetic auxiliary/cost fixtures. Explicit0USD online budget and NOT_RUN compatibility/quality/latency/calibration/measured-cost. No online mode/provider client. Output only IDs/counts/provenance hashes/metadata, no messages or prompt bodies.26 seeds are not26 executed model/routing cases.
- Preserved full86-line preparation as tracked `docs/audits/2026-10-11-ai-evaluation-preparation.md`; new technical/procedure/proposed-human-rubric document cites primary model/API references. Historical research remains dated; current narrative corrects context truncation/dependency assumptions. Human rubric/severity/acceptance thresholds are proposals requiring clinical approval.
- Prompt loader now reads two literal supported asset paths only; rejects fixtures/drafts/arbitrary paths before reads. Cached immutable artifact records actual source/body SHA256 and declared version. Both active bodies unchanged; frontmatter1.1.0. No warning suppression or Next internal flags. Read installed Next16.4 NFT/output guidance before implementation.

## TDD evidence (full private logs)

Commands were shell-prefixed `rtk`; logging wrappers used `rtk proxy sh -c`, preserving full npm/Vitest outputs and original exits under `/private/tmp/serenia-task5`.

| RED command | Observed failure before implementation | GREEN evidence |
| --- | --- | --- |
| `rtk npm test -- tests/llm/prompts.test.ts` | Unsupported existing test fixture was accepted (`expected function to throw`,1failed/8passed). Demonstrates unrestricted loader. | `green-prompts.log`:9/9; actual fixed-body/hash tests. |
| `rtk npm test -- tests/llm/auxiliary.test.ts` | Contract skeleton returned undefined: default off/result/timeouts invalid (21failures). Behavior assertions fail, not module resolution. | `green-auxiliary.log`:21/21. Native normalization/refusal/uncertainty/error/order/off/no-call/timeout/retry bounds. |
| `rtk npm test -- tests/llm/candidates.test.ts` | Estimator skeleton returned undefined (3failures). | `green-cost.log`:3/3 with literal independently calculated costs, cache, premiums, all attempts, unknown/invalid usage. |
| `rtk npm test -- tests/llm/evaluation.test.ts` | Skeleton threw Not implemented rather than expected technical report/corpus rejection (2failures). | `green-evaluation.log`:2/2, report separation and corpus duplicate/missing/family leakage fail closed. |

RED originals: `red-prompts.log`, `red-auxiliary.log`, `red-cost.log`, `red-evaluation.log` (all retained).

## Final verification

- `rtk npm test`:688passed/58files, exit0, `/private/tmp/serenia-task5/full-test.log`. Ran once after behavior/docs implementation. Subsequent only CLI type-literal annotation (`NODE_ENV as const`) resolved Next ProcessEnv typing without behavior change; final focused checks cover changed blocks.
- `rtk npm test -- tests/llm`:35passed/4files, exit0, `focused-final.log`.
- `rtk npm run lint`:exit0, no warnings, `lint-final.log`.
- `rtk npm run typecheck`:exit0, `typecheck-final.log`.
- `rtk npm run ai:evaluate:offline`:exit0 after commit, trackedSourceDirty:false, commit9d63871, `/private/tmp/serenia-task5/evaluation-committed.log`.
- Debug failures preserved: `evaluation.json.log` (tsx CommonJS top-level await unsupported; fixed async main); `lint.log` (unused destructured body; fixed explicit metadata projection); `typecheck.log`/`typecheck-green.log` (Next ProcessEnv requires typed NODE_ENV; fixed positive env literal). Read failures, kept fixes bounded, reran affected gates. No test failures omitted.
- Git diff/check self-review: explicit13paths staged/committed, no whitespace errors, no clinical-body/config/scorer/runtime/SQL/wire changes. No package-lock/dependency versions change; package only adds offline entrypoint.

## Source provenance

Nodev24.14.1, AI6.0.303, Zod4.3.6. LockSHA256 `86749cc76613926df395608ea88f243ad40a3e1e26e0ea86c1ff8df0f7c476a4`.
Corpus fileSHA256 `eb4f218a28e25d40b990803d14addef7f2a97b9caf3111f4da9226d6fc90d8a4`; normalized parsed corpusSHA256 `469153e0170ac03197f074f77d52254b86f68359221a6bb4a5ef2d895aa2796e`.
Generated Zod JSON schemaSHA256 `421c25bfe5cdb0fe23423b21c568b0fe1f4315a8aaaca9b62823fc2d4303f5aa`.
Evaluator sourceSHA256 `3321721459f42814873d5a12533e7647fe4a282b38cd97a1ccbef27d638e09f8`.

| Prompt1.1.0 | SourceSHA256 | Loaded bodySHA256 |
| --- | --- | --- |
| session-therapist.md | a6060c7efbf3f915c1bf7030d074ae7bc1de648aac8852d347612ab38e34b2a7 | 608251dbfc4b7c05b4450951aabfbde39830a2c191fb409a52c75e840118551c |
| clinical-report.md | 9f5ca76f442d9464b52cc7da183d0ad0db65aa18c2c09dea256dd911b109a2c7 | f004974cb517d9dd6c55eb439cbff2187e7c7e10e27796b4577bb2ecead544ec |

## Changed paths

`lib/server/llm/prompts/loader.ts`, `lib/server/llm/auxiliary.ts`, `lib/server/llm/evaluation.ts`, `lib/shared/llm/candidates.ts`, `scripts/evaluate-ai.ts`, `package.json`, `tests/llm/{prompts,auxiliary,candidates,evaluation}.test.ts`, `tests/fixtures/ai-evaluation.json`, `docs/audits/2026-10-11-ai-evaluation.md`, `docs/audits/2026-10-11-ai-evaluation-preparation.md`.

## Limits / concerns

No provider compatibility, model-generated Spanish clinical quality, latency, calibration or measured billing demonstrated. No candidate/clinical prompt promotion. Transport cancel compliance is not proved by synthetic abort-signal tests. Proposed corpus is seed coverage, not patient representativeness or approved gold. Adapter implements one choice theme primitive, not the entire native endpoints. Budget0 applies offline; future online transport/spend authorization and provider/privacy validation remain separate gates.

Task6 actual GoTrue/JWT/PostgREST/browser/generated Workflow/restart and final wholebranch review remain PENDING. Task4 SQL/wire unchanged, not repeated. Dependency audit not rerun (no dependency change); inherited full audit five high entries share exact temporary dev advisory exception expiry2026-10-18, production0 is historical Task4 evidence, not a new full clean audit or production readiness. Next announced14October patch remains external pending gate.



## Final isolated build / NFT gate — PASS

- Initial restricted `rtk npm run build:isolated` stayed at optimized compilation without progress; no pass claimed. Controller confirmed same historical network/fonts restriction in Task4. Identified only its parent/PID tree with process names, SIGTERM NextPID59968; build exit143 and launcherexit1. No concurrent build was left before repeating. Preserved `/private/tmp/serenia-task5/build-launch.log` plus `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-jzV0rZ/{metadata.json,result.json,build.log}`. This is stopped/incomplete evidence, not PASS.
- Repeated only `rtk npm run build:isolated` with require_escalated allowing necessary public Google Fonts fetches over a **fresh** git archive/dependencies copy/positive synthetic-loopback env. No .env.local loaded, no real API credentials/model/remoteDB calls, no font mocks/warning suppression/Next internal flags, no reuse of .next. This grants build network availability; it does not demonstrate universal OS/network isolation.
- Final sourceCommit `9d6387155e3704e340766f544f67b55d5ad99082`, lockSHA256 `86749cc76613926df395608ea88f243ad40a3e1e26e0ea86c1ff8df0f7c476a4`, Nodev24.14.1; installed package versions recorded by isolated metadata against lock (Next16.4.0, AI6.0.303, Workflow4.8.13, @workflow/next4.1.17, SupabaseJS2.117.3/SSR0.12.7/CLI2.120.0, Vitest4.1.11/Vite8.3.4). Child env built by existing allowlist with only synthetic local placeholders, telemetry off and feature off.
- Final build exit0; full log `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-xtFmih/build.log`, metadata/result same parent. Launcher full output `/private/tmp/serenia-task5/build-network-launch.log`. Snapshot canonical `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-xtFmih/project`.
- NFT inspection command `rtk proxy python3 /private/tmp/serenia-task5/check-traces.py /private/tmp/serenia-task5/build-network-launch.log`, exit0. Script and full27manifest path/hash/count records retained in `/private/tmp/serenia-task5/{check-traces.py,trace-evidence.json}`. Checked required prompt inclusion, env names, unrelated project source, escaped roots, NFT parallel fileHashes lengths, extra roots and every warning in build log.
- BUILD_ID `SgW2wnY8gPQK7g6fU2WJL`,27NFT manifests, combined path/content/count identitySHA256 `a5f1b2e90cb76b6e610c7d182355753ea3e8e966b052415c5350ef955f79710d`. Source assets exactly `docs/agents/prompts/clinical-report.md`, `docs/agents/prompts/session-therapist.md`, `package.json`;0environment/0unrelated source assets;0warnings, broad loader warning resolved. Actual archived prompt source/body hashes and evaluator-source hash independently compared to committed evaluator metadata, exact match.
- Fresh committed-source evaluator exit0 with trackedSourceDirty:false; final Git working tree clean (report is ignored plan evidence). No additional behavior changes after commit. These gates prove offline/build/trace behavior; they do not replace Task6 actual Auth/JWT/PostgREST/browser/generated Workflow/restart or clinical/provider acceptance.

**Status: DONE** for the Task5 scoped implementation, with external/runtime/clinical gates explicitly pending as specified. Independent review follows under the controller.

## Fix round1 — evaluator pre-import environment boundary (2026-10-11)

Independent review identified one Important gap: the original package script loaded the evaluator/dependency graph in an inherited environment; its positive env covered only Git children. Verified the finding against real source and reproduced it with entirely fictitious sentinels before editing the launcher behavior. No actual provider request or credential disclosure was found or implied. Applied receiving-code-review, TDD/debugging and verification workflow; no subagents.

### Narrow implementation

Commit `4e14be841eee8c758f7bf46d1837ef8353a8588d` (`fix(ai): isolate offline evaluator before dependency imports`), parent `9d6387155e3704e340766f544f67b55d5ad99082`. Exactly5paths: `scripts/evaluate-ai-launcher.mjs`, `scripts/evaluate-ai.ts`, `package.json`, `tests/llm/evaluation-launcher.test.ts`, `docs/audits/2026-10-11-ai-evaluation.md`.

- New launcher imports builtins only and spawns an evaluator child with explicit Node arguments/cwd before TS/evaluator/AI/Supabase dependency imports. Only PATH inherited; NODE_ENV=test, telemetry off, auxiliary off and positive-v1 policy marker are fixed. No credentials/NODE_OPTIONS/proxies/tracing/HOME or parent execArgv copied. Unsupported arguments fail; child exit propagated. No new online mode.
- Effective evaluator provenance records exact6launcher-specified key names, launcherSHA256, policy/scope and auxiliary off. Unknown effective key fails closed without printing a value. Darwin automatically introduced __CF_USER_TEXT_ENCODING during spawn; root explicitly approved distinguishing that one OS-added key only on actual darwin/presence, separately from supplied keys. Its value is never inherited/read/printed. No other platform key exception.
- Initial shell/npm/launcher may inherit environment and execute NODE_OPTIONS; no retrospective initial-process isolation or universal network/OS isolation is claimed. The child environment boundary is established by the launcher before dependency imports. The runtime provenance check validates observed allowed keys after imports, and tests demonstrate that fake parent preload never loads evaluator dependencies.
- No app/clinical/auth/prompt/scorer/SDK/lock/SQL changes. Package only changes the offline command to `node scripts/evaluate-ai-launcher.mjs`; user command remains `rtk npm run ai:evaluate:offline`.

### Meaningful RED → GREEN and preserved failures

`rtk npm test -- tests/llm/evaluation-launcher.test.ts` before launcher implementation:1failed, exit1. The test launches the actual package-configured evaluator with synthetic OPENAI/Supabase sentinels and a synthetic NODE_OPTIONS preload that records only booleans at exit. Initial process inheritance is explicitly permitted. RED observed evaluatorImported+sentinels true when expectation was false, proving the original boundary gap, not a missing-module failure. Full log: `/private/tmp/serenia-task5/fix1-red-launcher.log`.

Intermediate `/private/tmp/serenia-task5/fix1-green-launcher.log` is **not GREEN**: the first strict6key policy rejected Darwin's additional OS metadata key. Diagnosis inspected only the sanitized child key names, not values; root approved the narrowly platform-specific distinction. Final launcher-focused run passes3/3, exit0: `/private/tmp/serenia-task5/fix1-green-launcher-final.log`. Coverage includes actual child/preload separation, exact positive env from arbitrary fake inputs (including fake CF parent value), observed policy keys, no sentinel disclosure, unknown-key fail-closed and no-online argument rejection.

`rtk npm test -- tests/llm`:38/38 in5files, exit0, `/private/tmp/serenia-task5/fix1-focused.log`.
`rtk npm run lint`:exit0/no warnings, `/private/tmp/serenia-task5/fix1-lint.log`.
`rtk npm run typecheck`:initial failure in test spawn due JS return NODE_ENV inferred string, preserved `/private/tmp/serenia-task5/fix1-types.log`; added return JSDoc NodeJS.ProcessEnv only, no behavior change. Final exit0 `/private/tmp/serenia-task5/fix1-types-final.log`.

### Actual committed launched evaluator with fake parent environment

After commit, executed package-configured `node scripts/evaluate-ai-launcher.mjs` through a builtins-only driver (`rtk proxy node --input-type=module -`), supplying only PATH, NODE_ENV=test and explicitly fictitious OpenAI/Supabase/Anthropic/OIDC/database/proxy sentinels, auxiliary shadow, NODE_OPTIONS pointing to synthetic `/private/tmp/serenia-task5/fix1-probe.cjs`. The real launcher forces the evaluator child auxiliary off and strips all sentinels/preload. No actual environment-file/secret values were read. Full stdout/stderr `/private/tmp/serenia-task5/fix1-evaluator-committed.log`; initial probe booleans `/private/tmp/serenia-task5/fix1-probe-observations.jsonl` (private files, retained).

Observed exit0, HEAD `4e14be841eee8c758f7bf46d1837ef8353a8588d`, trackedSourceDirty:false; Nodev24.14.1, unchanged lockSHA256 `86749cc76613926df395608ea88f243ad40a3e1e26e0ea86c1ff8df0f7c476a4`, unchanged corpus/evaluator/schema/prompts from Task5 implementation. LauncherSHA256 `2d156f620dc2f12a9130096aac30caa104b2934b3258ad9677adc239edca4105`. Policy positive-v1; effectiveKeys exactly DO_NOT_TRACK,FEATURE_AUXILIARY_DECISIONS,NEXT_TELEMETRY_DISABLED,NODE_ENV,PATH,SERENIA_AI_EVALUATOR_ENV_POLICY; separate osAddedKeys:[__CF_USER_TEXT_ENCODING], nodeOptionsInherited:false, auxiliaryMode:off. Initial probe reports evaluatorImported:false/openaiInherited:true/supabaseInherited:true — it ran only in the allowed initial launcher. No probe execution in the sanitized child. Online budget0 and compatibility/quality/latency/calibration/measuredCost all NOT_RUN remain explicit.

### Self-review / scope / handoff

Read full review and own explicit5path diff; Git diff --check clean, committed source working tree clean. Full suite, SQL, wire and build were **not repeated**, as controller directed for launcher-only fix; prior Task5 688/58 and build27NFT evidence remains at9d63871, not relabelled as a build of4e14be8. No app/runtime/build inputs requiring renewed build changed. Task6/wholebranch/provider/clinical approvals remain pending.

**Fix round1 status: DONE**, scoped re-review follows.


## Revisión independiente del bloque

❌ **Spec compliance: one scoped requirement needs a fix.** The evaluator process does not establish the required positive environment boundary before loading its dependencies. The remaining Task 5 requirements inspected in `review-3fa42f7..9d63871.diff` are satisfied.

### Strengths

- Patient models, clinical prompt bodies, Auth, scoring, cutoffs, age and patient consumers have no changes in this 13-path diff. Candidate presets remain research configuration ([candidates.ts:11](/Users/miguelluque/git/serenia/lib/shared/llm/candidates.ts:11)); the auxiliary has only an injected transport and review-only results ([auxiliary.ts:30](/Users/miguelluque/git/serenia/lib/server/llm/auxiliary.ts:30), [auxiliary.ts:48](/Users/miguelluque/git/serenia/lib/server/llm/auxiliary.ts:48)).
- The two native choice contracts match the full official references: Jev maps versus Decisions arrays, named answers, complete required usage metadata, refusal and option identities. Strict schemas, distribution checks, default-off behavior, bounded input/output, one attempt and timeout/error sanitization are concrete ([auxiliary.ts:16](/Users/miguelluque/git/serenia/lib/server/llm/auxiliary.ts:16), [auxiliary.ts:39](/Users/miguelluque/git/serenia/lib/server/llm/auxiliary.ts:39), [auxiliary.ts:56](/Users/miguelluque/git/serenia/lib/server/llm/auxiliary.ts:56), [auxiliary.ts:81](/Users/miguelluque/git/serenia/lib/server/llm/auxiliary.ts:81)). Checked against [Jev API](https://docs.typesafe.ai/api) and [Decisions endpoint reference](https://developers.openai.com/api/reference/resources/decisions/methods/create); synthetic transports do not establish live compatibility or cancellation.
- Cost arithmetic accounts for cache reads/writes, declared premiums and unknown/invalid usage; per-attempt estimates are explicitly unmeasured ([candidates.ts:25](/Users/miguelluque/git/serenia/lib/shared/llm/candidates.ts:25), [candidates.test.ts:10](/Users/miguelluque/git/serenia/tests/llm/candidates.test.ts:10)). The report correctly leaves caller-side attempt summation and unavailable billing evidence explicit.
- The 26 seed manifest has fixed provenance, pending human gold, required IDs and family-separated proposed splits. The evaluator exercises actual deterministic helpers and labels every online quality/latency/calibration/billing gate `NOT_RUN`; it does not turn seed count into model-performance claims ([evaluation.ts:12](/Users/miguelluque/git/serenia/lib/server/llm/evaluation.ts:12), [evaluation.ts:36](/Users/miguelluque/git/serenia/lib/server/llm/evaluation.ts:36), [evaluation.ts:63](/Users/miguelluque/git/serenia/lib/server/llm/evaluation.ts:63), [evaluation documentation:23](/Users/miguelluque/git/serenia/docs/audits/2026-10-11-ai-evaluation.md:23)). The retained preparation and proposed clinical rubric are clearly separate from approval.
- Prompt loading accepts only two literal asset paths, preserves the prior body transformation, and returns immutable source/body/version provenance ([loader.ts:17](/Users/miguelluque/git/serenia/lib/server/llm/prompts/loader.ts:17), [loader.ts:28](/Users/miguelluque/git/serenia/lib/server/llm/prompts/loader.ts:28), [prompts.test.ts:39](/Users/miguelluque/git/serenia/tests/llm/prompts.test.ts:39)). The fresh build's archived prompt/evaluator hashes match the committed evaluator evidence.

### Issues

#### Critical (Must Fix)

- None found in this task scope.

#### Important (Should Fix)

- **Establish the secretless boundary before importing the evaluator.** [package.json:13](/Users/miguelluque/git/serenia/package.json:13) starts the evaluator directly, and [evaluate-ai.ts:4](/Users/miguelluque/git/serenia/scripts/evaluate-ai.ts:4) statically imports its dependency graph. The positive environment at [evaluate-ai.ts:12](/Users/miguelluque/git/serenia/scripts/evaluate-ai.ts:12) applies only to Git subprocesses, after evaluation starts. The evaluator itself therefore retains inherited provider/Supabase credentials and runtime options, contrary to the explicit no-inherited-credentials requirement. This is a boundary gap, not evidence of an actual provider call or disclosure. A focused run with an otherwise positive synthetic environment and fictitious `OPENAI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` returned exit 0 and `{"openaiInherited":true,"supabaseInherited":true}` after importing the real evaluator entrypoint. Add a small builtins-only launcher that creates the evaluator child with a positive environment before its imports, and test with fictitious sentinels that the child's effective environment is secretless. Do not require retrospective isolation of the initial shell/npm process. Record the effective evaluator environment policy in provenance.

#### Minor (Nice to Have)

- None identified that warrants additional task work.

### Checks and scope

- Reviewed the packaged diff in passes; one initial tool-output truncation required a smaller pass through the affected diff region. No Git command, checkout/index/branch mutation, suite rerun, build rerun, provider request or real credential/environment-file read was performed.
- Named unchanged-code risk: evaluator imports can expose its dependency graph to inherited credentials. Inspected only the schema-owning import section in [generator.ts:1](/Users/miguelluque/git/serenia/lib/server/assessments/generator.ts:1), which imports AI/LLM modules, then performed the single synthetic environment reproduction above. No real secret values were inspected or printed.
- Existing RED evidence is present for prompts/auxiliary/cost/evaluation. Existing full and final focal results show 688/58 and 35/4 respectively ([full-test.log:9](/private/tmp/serenia-task5/full-test.log:9), [focused-final.log:9](/private/tmp/serenia-task5/focused-final.log:9)); final lint/typecheck logs are warning-free. The committed evaluator records commit `9d63871` and `trackedSourceDirty:false` ([evaluation-committed.log:46](/private/tmp/serenia-task5/evaluation-committed.log:46)). These are inspected existing results, not newly rerun gates.
- Named build risk: broad tracing or missing prompt assets. Read the retained checker and evidence, then independently compared all 27 actual NFT manifests against recorded path/hash/count identities, checked referenced file existence/root containment, exact source assets and zero build warnings. PASS: only the two supported prompts plus `package.json`, zero environment/unrelated source assets ([trace-evidence.json:8](/private/tmp/serenia-task5/trace-evidence.json:8)). Actual snapshot: `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-xtFmih/project`; build log: `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-xtFmih/build.log`; metadata/result are in the same snapshot parent. Retained checker: `/private/tmp/serenia-task5/check-traces.py`. The earlier stopped build remains incomplete evidence, not a pass.
- ⚠️ Outside this diff/task gate: actual Auth/JWT/PostgREST/browser/generated Workflow/restart acceptance, online provider compatibility/cancellation, Spanish clinical quality, calibration, measured latency/billing and final independent whole-branch review. Task 6 and clinical/provider approval remain pending. The announced Next patch is an external gate; the narrow audited development GHSA exception expires 2026-10-18 and does not make the full audit clean. No production-readiness verdict is implied ([evaluation documentation:25](/Users/miguelluque/git/serenia/docs/audits/2026-10-11-ai-evaluation.md:25), [evaluation documentation:31](/Users/miguelluque/git/serenia/docs/audits/2026-10-11-ai-evaluation.md:31)).

### Assessment

**Task quality: Needs fixes.** The native adapter, truthful offline evaluation and literal prompt tracing are well scoped and supported by existing evidence. Fix the evaluator's pre-import environment boundary before approving Task 5; the separate whole-branch/runtime/clinical gates remain pending.

**Saved report:** `/Users/miguelluque/git/serenia/.superpowers/sdd/2026-10-10-robust-mvp/task-5-review.md`.


## Revisión independiente del fix

# Task 5 fix round 1 — scoped independent re-review

**Verdict: all addressed; no new Critical or Important findings in this fix diff.** The single prior Important finding is **ADDRESSED**. This verdict applies only to the evaluator child environment fix, `9d6387155e3704e340766f544f67b55d5ad99082..4e14be841eee8c758f7bf46d1837ef8353a8588d`.

## Prior finding verification

### Important — establish the secretless evaluator child before dependency imports: ADDRESSED

- [package.json:13](/Users/miguelluque/git/serenia/package.json:13) now routes the offline command through the `.mjs` launcher. [evaluate-ai-launcher.mjs:1](/Users/miguelluque/git/serenia/scripts/evaluate-ai-launcher.mjs:1) imports only Node builtins. At [evaluate-ai-launcher.mjs:25](/Users/miguelluque/git/serenia/scripts/evaluate-ai-launcher.mjs:25), the launcher creates a new evaluator process with explicit Node arguments and the positive environment returned at [evaluate-ai-launcher.mjs:8](/Users/miguelluque/git/serenia/scripts/evaluate-ai-launcher.mjs:8). This boundary exists before the child's `tsx` and evaluator dependency imports. Neither inherited `NODE_OPTIONS` nor the parent's `execArgv` is copied to that child.
- The environment constructor copies only `PATH`, then fixes `NODE_ENV=test`, both telemetry settings, auxiliary mode `off`, and the `positive-v1` policy marker. Credentials, proxy/tracing variables, `HOME`, and an inherited `__CF_USER_TEXT_ENCODING` value are not included. This is a child-process environment boundary, with inherited `PATH` intentionally retained for installed tools; it is not universal OS/network isolation.
- [evaluate-ai.ts:11](/Users/miguelluque/git/serenia/scripts/evaluate-ai.ts:11) enumerates effective key names. The one separate metadata classification at [evaluate-ai.ts:14](/Users/miguelluque/git/serenia/scripts/evaluate-ai.ts:14) requires actual `process.platform === 'darwin'` and observed presence of `__CF_USER_TEXT_ENCODING`. It never reads or prints the value. All remaining effective keys must equal the exact sorted six-key allowlist, and the fixed setting values and policy marker are validated at [evaluate-ai.ts:17](/Users/miguelluque/git/serenia/scripts/evaluate-ai.ts:17). Every other unknown effective key fails closed. This matches the controller's narrowly defined Darwin ruling.
- Provenance at [evaluate-ai.ts:22](/Users/miguelluque/git/serenia/scripts/evaluate-ai.ts:22) includes the launcher hash, child-boundary scope, exact specified key names, separate OS-added key names, and auxiliary mode. The check executes after imports; the launcher, rather than that later check, establishes the pre-import boundary. [evaluation documentation:7](/Users/miguelluque/git/serenia/docs/audits/2026-10-11-ai-evaluation.md:7) and the appended implementation report state this distinction and explicitly leave the initial shell/npm/launcher outside retrospective isolation.
- The new integration regression at [evaluation-launcher.test.ts:7](/Users/miguelluque/git/serenia/tests/llm/evaluation-launcher.test.ts:7) launches the actual package-configured command with fictitious OpenAI/Supabase values and a fictitious `NODE_OPTIONS` preload. It permits initial launcher inheritance, rejects the original combination of evaluator import plus inherited sentinels, checks the child's reported exact environment, and checks absence of sentinel output. The positive environment test at [evaluation-launcher.test.ts:35](/Users/miguelluque/git/serenia/tests/llm/evaluation-launcher.test.ts:35) covers arbitrary fake credential/proxy/tracing values and a fake parent CF value. [evaluation-launcher.test.ts:40](/Users/miguelluque/git/serenia/tests/llm/evaluation-launcher.test.ts:40) covers unknown-key rejection without value disclosure and unsupported online arguments.

## Existing evidence inspected

No suite, evaluator, build, Git command, or provider request was rerun for this review. The supplied fix diff was read once in full; the five changed paths, appended fix report, targeted current launcher/evaluator/test source, and these retained logs were inspected:

- `/private/tmp/serenia-task5/fix1-red-launcher.log`: one behavioral failure, `expected true to be false`, at the original evaluator-import-plus-sentinel assertion. This supports the original gap rather than merely a missing module.
- `/private/tmp/serenia-task5/fix1-green-launcher.log`: preserved intermediate failure, evaluator exit 1; it is not passing evidence. The report identifies the strict six-key rejection of Darwin metadata and retains the subsequent narrow correction.
- `/private/tmp/serenia-task5/fix1-green-launcher-final.log`: 3/3 tests, one file passed.
- `/private/tmp/serenia-task5/fix1-focused.log`: 38/38 tests, five files passed.
- `/private/tmp/serenia-task5/fix1-lint.log`: retained lint invocation with no diagnostics; appended report records exit 0.
- `/private/tmp/serenia-task5/fix1-types.log`: preserved `NODE_ENV` type error in the new test. `/private/tmp/serenia-task5/fix1-types-final.log`: final invocation without diagnostics; appended report records exit 0. The source carries the corresponding return-type JSDoc; no behavior change is attributed to it.
- `/private/tmp/serenia-task5/fix1-evaluator-committed.log`: actual report identifies commit `4e14be841eee8c758f7bf46d1837ef8353a8588d`, `trackedSourceDirty:false`, Node `v24.14.1`, launcher SHA256 `2d156f620dc2f12a9130096aac30caa104b2934b3258ad9677adc239edca4105`, exact six specified keys, separate `__CF_USER_TEXT_ENCODING`, auxiliary `off`, online budget 0, and all online measurements `NOT_RUN`. Two Git temp-directory warnings are present; they are not lint warnings or failed evaluation evidence.
- `/private/tmp/serenia-task5/fix1-probe-observations.jsonl`: the allowed initial launcher records `evaluatorImported:false`, with both synthetic credential-presence booleans true. The later child report passes its strict effective-key policy. The absence of child preload observations is expected when `NODE_OPTIONS` is stripped; the positive environment construction and effective-key assertion provide the child-side evidence.

These are existing run results, not newly executed verification. The integration test directly starts the package-configured Node command; it does not claim to isolate npm or the starting shell. The full suite/build evidence remains attached to the earlier commit, as the report states.

## New breakage limited to the fix diff

- **Critical:** none found.
- **Important:** none found.
- **Minor:** none requiring further scoped work.

## Out-of-scope, nonblocking for this round

Task 6 actual Auth/JWT/PostgREST/browser/generated Workflow/restart acceptance and the final independent whole-branch review remain pending. Online compatibility/cancellation, Spanish clinical quality, calibration, latency and billing are not demonstrated by this fix. The historical dependency/build gates are not refreshed or relabelled as evidence for this commit. This review makes no production-readiness claim.

**Round verdict: all prior findings addressed; no new Important findings.**

