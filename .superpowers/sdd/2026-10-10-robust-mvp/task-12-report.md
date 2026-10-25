# Task12 — bounded production dependency patch

Status: committed source + hosted-build checkpoint ready for independent review; no runtime/DDL/fixture action. Executable BASE `f1ff5b788f1f217c21c0883923cacbf056e991f1`; Task11 documentary checkpoint `5accbed` contains only its report/audit and precedes all dependency changes. Task12 review range begins at5accbed. Task11 source/forward review was approved separately by root/same reviewer; hosted acceptance remains pending. Six root-owned untracked records are excluded; root's Task12 plan edit is explicitly included in the forthcoming source commit.

## Actual blocker and upstream rationale

Task11 nativeverify overall1 is retained at `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-jgKyNw`: tests752/64, lint, types, wire20/24, nativePG17 and isolated build all0; strict production/full audit each npm exit1. Its22 High package-graph entries derive from FIVE distinct advisories, not22 vulnerabilities. No audit waiver, expiry extension, suppression, force-fix, global configuration or Workflow downgrade is used.

Official advisory/release pages and public npm metadata were checked24Oct before mutation. Publish/release dates differ from the24Oct registry observation: [Zod4.6.6](https://github.com/colinhacks/zod/releases/tag/v4.6.6) released11Oct; [its advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) updated23Oct. [body-parser2.4.0](https://github.com/expressjs/body-parser/releases/tag/v2.4.0) released22Oct; [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) updated23Oct. Undici [6.29.1](https://github.com/nodejs/undici/releases/tag/v6.29.1)/[7.30.1](https://github.com/nodejs/undici/releases/tag/v7.30.1) released15Oct; the three relevant [EventSource](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [mixed-case SRI](https://github.com/advisories/GHSA-f72v-6w45-q472) and [excessive encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c) advisories were updated23Oct. This patch does not claim five newly published24Oct advisories.

Private `.cache/task12/registry-{selected,branches}-before.json` retains release metadata, dist integrity, parent constraints and publish times. Latest4-branch `@workflow/core4.8.14` still requests Zod~4.3.6; `world-local4.4.4`/`world-vercel4.7.8` still request Zod~4.3.6 and Undici7.30.0. Even current Workflow5 parents request vulnerable Zod~4.5.4/Undici7.30.0. Latest Vercel cli-auth0.3.12/cli-config0.3.3 still pin Zod4.1.11. Parent upgrades therefore do not resolve the constraints and would widen scope.

## Narrow package/lock change

- Direct Zod4.3.6→4.6.6, plus `zod@^4.0.0:4.6.6` override for installed transitive4.x copies constrained by Workflow/Vercel. No Zod3/5 major substitution. Two vulnerable nested Vercel copies deduplicate to the patched root.
- Separate exact `undici@^6.0.0:6.29.1` and `undici@^7.0.0:7.30.1` overrides. AI provider-utils stays on6; Workflow local/vercel and jsdom stay on7. No global move to one major or8.
- Targeted compatible body-parser2.3.0→2.4.0 lock update under Express5.3.0's existing^2.3.0 range, with no body-parser override. Its new minimum qs^6.16.1 requires qs6.16.0→6.16.1; this is the sole accompanying dependency version change.

Next16.4.1, React/DOM19.3.1, AI6.0.303, Workflow4.8.13/@workflow/next4.1.17, existing devalue/nanoid overrides, clinical app code, prompts/provider defaults and SQL are unchanged. Only10 lock entries change (root metadata, affected packages/qs, and two removed Zod copies), with no unrelated package or integrity churn. Patched lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`.

`npm update body-parser --package-lock-only --ignore-scripts --no-audit --no-fund` exit0 resolved the narrow specs. `npm ci --no-audit --no-fund` exit0 installed897 platform packages using a positive environment, private HOME/cache and empty npm user/global configs; no global install/config or inherited auth/provider keys. The existing ESLint9.39.4 upstream deprecation warning is retained. Every affected installed version matches the lock; production/full `npm ls` exit0. Private `lock-delta.json`, `installed-package-identity.json` and `installed-graph-{production,full}.log` record exact paths/integrities. All installed affected copies: Zod4.6.6; body-parser2.4.0; Undici6.29.1 root and7.30.1 in world-local/world-vercel/jsdom; qs6.16.1.

## Meaningful verification and failures

New native test file uses real Zod/AI SDK schema conversion and disposable child transports bound to ephemeral127.0.0.1 ports. It never uses app port3000, fixtures, hosted calls or a real model. Children receive only PATH/NODE_ENV=test. Before installing the resolved lock, SIX probes against the unchanged old modules gave FOUR actual RED failures: oversized constrained array visited elements; both installed Undici6/7 transports emitted an uncaught stream error after excessive encodings; Workflow7 transport accepted an SRI mismatch with mixed-case algorithm. Two probes (real AI strict report schema and body-parser trailing-byte/next-request compatibility) already passed. These six probes do NOT reproduce all five advisories; EventSource and the body-parser advisory are covered by official patch provenance/audit, with a bounded body-parser transport compatibility smoke.

After install, all6 probes passed. Combined schema/Task11 focused run:70 tests/4files passed, exit0; final native gates follow below. First focused typecheck exit2 identified test-only Next ProcessEnv requiring NODE_ENV in the positive child environment; corrected to `test`, with failure retained. Lint exit0 and production/full installed graph commands exit0. No failed command is relabelled successful. Full private logs and numeric exits: `.cache/task12/`; original Task11 audit1 remains untouched.

## Final committed gates/build and limits

Executable source `f2d69ea088403a3f3e641d20112318b54a344577`, patched lock `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`, Node24.14.1. Final `rtk npm run verify` ran once on this committed source and completed overall exit0. Exact private evidence `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-5MXDSq/results.json`; wrapper/full output `.cache/task12/native-verify.log`, numeric exit `.cache/task12/native-verify-exit.json`, evidence/hash snapshot `.cache/task12/native-evidence.json`.

| Gate | Exit | Actual result |
| --- | --- | --- |
| test |0|758 tests /65 files |
| lint |0|zero-warning gate |
| typecheck |0|tsc --noEmit |
| workflow:wire |0|20 prior payloads /24 current roundtrips, zero failures |
| db:test |0|PG17.6 frozen packet mapping, six forward drift cases, review integrity/authorization/task/concurrency controls |
| audit:dependencies |0|production/full npm exits0; info/low/moderate/high/critical/total all0 in both raw reports |
| build:isolated |0|source f2d69ea, generic BUILD_IDc8XKB05fOmf7LmdLCY-w5 |

Generic snapshot: `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-5SpG3A/project`; placeholder configuration, never started. Raw audit JSON and numeric exits were independently parsed after verify; no missing check is inferred from another gate. The original Task11 audit1 stays preserved and attributable to its old lock.

Fresh `rtk proxy node scripts/hosted-build.mjs` completed exit0 against the exact existing target via selected positive connection configuration. Snapshot `/private/tmp/serenia-hosted-build-w4zDky/project`, same committed source f2d69ea/lock above, BUILD_ID `7-SFAHJkzrF9ef47Bhjl7`,876 inventoried files, artifact SHA256 `bc0ef03700d0c28d3de31bb188208916ee110dd08315caab71908c03fee6ca9f`. Actual `metadata.json`, `result.json`, `artifact.json` and `build.log` remain private in its parent. Stored metadata SHA256 `6560efcdf8fa406a5c1facd2929fb667f8caa91ee80f14814c7531e1accde4b9`; artifact-record SHA256 `2503fd3b69d677866a5c7666e192724d01e117771ae3cc928c1760f15d5fe746`. All affected copied dependency versions and lock bytes were rechecked inside the hosted snapshot; read-only recomputation matches the complete stored artifact identity. Selected public/server keys were never printed. Local identity summary `.cache/task12/hosted-build-identity.json` and command/exit logs retain provenance.

At the24October source/build checkpoint the hosted artifact was NOT STARTED, and no hosted fixture call, provider request, same-run restart or UI acceptance had occurred. The25October bounded runtime results are recorded below separately. No Task11 vulnerable hosted build ran; its earlier pre-execution approval-infrastructure usage-limit failure is preserved separately. The final documentation-only descendant records these results; the built executable source remains exactly f2d69ea, not that later docs HEAD.

Frozen: canonical6f0037fc93052bytes, inboxd9604, prepared Task11 review forward8191bytes/SHA256 `86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504`/body7f83d3074a279a2740d1bf82a2977ebd. No migration/history/type/ACL/catalog change by Task12. Root alone owns application after fresh metadata/review; it subsequently applied the exact review forward as recorded below.

At that source checkpoint the original source27 binary/buildxhrWTx9JGknr6oTSmk6va/PID11147 and state `/private/tmp/serenia-hosted-acceptance-20261023-riwqxqs4` remained separate; runtime actions were still prohibited. Subsequent explicit root approval/handoff and actual same-run restart are recorded below. Real JWT/HTTP/UI nonzero fact integrity, review/patient projection and scoped cleanup remain separate follow-up gates. Clinical/legal/real-model validation/public deployment remain separate gates. UX/behavior/preliminary-diagnosis work is deferred by the human and is outside this patch.


##25October actual patched hosted runtime and writer handback

Root/same reviewer approved Task11+Task12 source/build. Root alone applied exact8191B review forward86a461 once→hosted version `20261024203657`, verifying43history and unchanged original40/prior6f+d9604/catalog/signature/owner/ACL plus new body7f83. Root refreshed metadata25Oct07:03UTC before the resumed handoff; no DDL or original account read was performed by this source owner. Immutable prepared manifests stay unchanged; actual application is recorded separately by root.

An initial transition command on24Oct did not execute because automatic approval review hit its usage limit before CreateProcess. No signal/new state/fixture action occurred then. After root explicitly resumed with reset quota25Oct, both old/new artifact hashes were rechecked. Fresh OS listener11147 on127.0.0.1:3000, cwdNd4nXo, parent11146 launcher/oldstate and recorded source27 identity matched before the sole SIGTERM. Signal-send exit0 and observed PID absence/portfree are saved; the old child numeric exit remains UNKNOWN because its original unified handle was unavailable. Original six actors/state/proofs/clocks were not replayed, renewed or cleaned.

New canonical private0700 state: `/private/tmp/serenia-hosted-acceptance-patched-20261024-8a6dkdog`, manifest run `07c6ac580f15390b125c`; the20261024 prefix identifies the approved handoff contract and was actually created25Oct. Normal strict launcher used the SAME approved f2 artifact/source/lock/build identity above, selected connection keys privately, new cryptorandom cron/fixture credentials and the existing synthetic network/provider fence. Current external launcher HEAD at initial readiness b0a46ea, file SHA971f429334007f8316e34e3210561b89550205d82bc63dbe2fb0758b467bf5cd; no rebaseline/cache edit/rebuild or lifecycle override.

Only existing `restart-checkpoint` and `restart-verify` modes ran; fixtures/review/cron/browser/cleanup modes did NOT run. Exactly ONE newly generated restart actor: user `e34ed848-a58a-4c0e-945d-43d936637a26`, session `8be6b378-194e-43bc-9c43-e44fdc37da02`, conversation `b18f7140-d279-4083-9dc7-3028136b7001`. Admin creation, real GoTrue password login/getUser/JWT, technical adult onboarding/current server consent and five actual Next HTTP messages used only that fixture. No original profiles/account values were fetched.

| Runtime operation | Actual result |
| --- | --- |
| Initial normal start | PID31819 /handle60521; GET/login200 |
| restart-checkpoint |exit0 at07:05:14UTC; intended actor/job/input/run retry observed |
| Planned runtime termination |launcher exit1, child exitnull/SIGKILL; preserved as planned termination, not a PASS exit |
| New-state control transition |structured fail→success only; no job/Workflow event edits/requeue |
| Normal SAME artifact/state restart |PID31879 /handle34811 |
| restart-verify |exit0 at07:06:34UTC; SAME original run recovered |
| Scoped readonly capture |exit0; full raw synthetic proof private |
| Fresh handback readiness |07:09:21UTC GET/login200 +exact lsof/CWD; handle34811 still running |

Original run `wrun_01M5RY1CHPA2DXK3F7PKPSV4GY` completed with jobattempt1,23events, one run_created and each of three completed prefix steps started once. One draft assessment `7358dc0e-4448-4422-a9c1-092670fba5ed`, five completed turns/attempt1, ten visible messages (5user/5assistant), session/conversation closed user_request; zero questionnaire instances and report.questionnaires=[] are legitimate here. This empty case DOES NOT prove the nonzero PHQ9 mapping; root retains that distinct native UI probe.

New-state provider immutable prefix15rows SHAa94e63ea45418c439e53fe68d5931b4a88918d197ae6bf39d2662ca19c3d7a72→24rows SHA85588c36446abd36e04e2b5e4cb4ddb2b16faa9f29a2c4f9a61c344e88cb169f at scoped capture. Total5conversational/2structured (one deliberate fail at31819 and one real recovery success at31879)/0fast/0network-denied/0model-denied; recovery phase adds0conversational/1structured. Structured marker920dc4004eb15720 attempts1→2 matches across restart. Counters are bounded to this automatic phase, not later root UI or all-model-zero claims.

Proofs in new state: `restart-proof.json`37,770B/SHA256 `39d7d8444a01cd9e39aac80f7d1ea70dcaa4388c20bac3c4d2fa4d69081beed8`; `patched-runtime-scoped-proof.json`21,014B/SHA256 `e7880d7505d5cb0151024720f61e085e1cfc6ade0b4b9c966efe4b0bdacedd11`. Full command logs, mode exits, old stop/initial readiness/planned kill/control transition and fresh process handback: `.cache/task12/runtime/`; `handoff.json` binds exact state/build/PID/handle/fixture/proof paths. Keys/password/tokens are never printed; full synthetic rows remain private.

ALL fixture/runtime writes were explicitly handed back to ROOT at07:09:21UTC with PID31879/handle34811 live. No further scenario/write/cleanup/stop by this owner; only these evidence documents change. Root owns fresh combined-manifest clinical prefetch gating, native PHQ9nonzero→report/directRPC negatives/clinical edit/patient projection, final evidence review and two-manifest scoped cleanup after stop. Earlier Task7source27 matrix/cron/type/advisor proofs keep their own dated scope. No overall MVP, clinical/legal/real-provider validation or public deployment completion is claimed.
