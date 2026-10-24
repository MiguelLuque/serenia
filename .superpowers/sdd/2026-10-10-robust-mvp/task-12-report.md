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

The hosted artifact is NOT STARTED. No hosted fixture call, provider request, same-run restart or UI acceptance occurred under Task12. No Task11 vulnerable hosted build ran; its earlier pre-execution approval-infrastructure usage-limit failure is preserved separately. The final documentation-only descendant records these results; the built executable source remains exactly f2d69ea, not that later docs HEAD.

Frozen: canonical6f0037fc93052bytes, inboxd9604, prepared Task11 review forward8191bytes/SHA256 `86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504`/body7f83d3074a279a2740d1bf82a2977ebd. No migration/history/type/ACL/catalog change by Task12. Root alone owns later application after fresh metadata/review.

Original source27 binary/buildxhrWTx9JGknr6oTSmk6va/PID11147 and state `/private/tmp/serenia-hosted-acceptance-20261023-riwqxqs4` remain separate and untouched; current runtime liveness belongs to root's dated checks. No child/scenario jobs or fixture writes have been started. Later acceptance requires independent source/build approval and explicit root runtime/fixture handoff, same-run restart proof, real JWT/HTTP/UI fact integrity and review/patient projection, scoped cleanup. Clinical/legal/real-model validation/public deployment remain separate gates. UX/behavior/preliminary-diagnosis work is deferred by the human and is outside this patch.
