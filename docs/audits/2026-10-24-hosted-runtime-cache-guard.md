# Task7 standalone response-cache guard — 24 October 2026

Source-only checkpoint; no runtime restart/new build/fixture write/DDL/cache edit/cleanup in this correction. Root retains exclusive fixture/CUA control. BASE and actual application binary remain `27f82d8e8d46257dff8517dbca5592e4a4681df9`. Standalone launcher source revision is **c1d78b4ae8936b208cd05432eda284619861d6e5**, `scripts/hosted-start.mjs` file SHA256 **971f429334007f8316e34e3210561b89550205d82bc63dbe2fb0758b467bf5cd**. Evidence-doc follow-up changes no executable bytes. This is an external launcher revision validating an existing original artifact; no current-HEAD application binary is claimed.

## Observed cause

The first actual GET/login/favicon populated eight files under `.next/server/route-cache`; no originally inventoried source/build file changed. The old helper excluded `.next/cache` but hashed response-cache additions, so future start would reject the otherwise unchanged artifact. The initial supplemental capture exit1 is retained in `.cache/hosted-task7/actual-20261024/capture-scoped.log` and its exit record. Exact eight-file delta is `artifact-runtime-delta.json` beside it; build aggregate `c3d0ddb6…a9136`, cache-populated aggregate `b8d2e741…295e2` under the old algorithm.

Before source correction, a separate explicitly refined read-only proof asserted all original files unchanged and only response-cache additions: state `automated-scoped-proof.json`, SHA256 `214a0cfe620391903ab774a9ee88429d277039c01391360be1379d88bbb095c6`. It does not erase the initial failure or prove the old launcher could restart after browsing.

Installed Next16.4.1 `dist/docs/01-app/02-guides/self-hosting.md` describes disk response caching; `dist/server/lib/route-cache-key.js` declares route-cache and `incremental-cache/file-system-cache.js` places those scoped responses beside compiled server output. The exact mutable subtree is `.next/server/route-cache`, not `.next/server` or `.next/server/app`.

## Narrow correction and verification

The scanner omits content hashes only inside two exact data subtrees: existing `.next/cache` and `.next/server/route-cache`. It still traverses their entries to reject boundary or nested symlinks and requires real directories at both boundaries. Compiled routes/chunks/static assets/source/scripts/config/lock and lookalike cache sibling paths remain inventoried. Credential/target/public-key/lock/build/source checks, network/provider boundaries and startup mechanism are unchanged. No metadata/cache rebaselining or original artifact files were edited.

Private full logs/exit records: `.cache/hosted-task7/runtime-cache-20261024/` (0700; files0600).

| Command | Actual result | Evidence |
|---|---|---|
| `rtk npm test -- tests/tooling/hosted-artifact.test.ts` before helper correction | RED exit1:2fail/13pass; legitimate populated cache changes identity, and regular file cache boundary accepted incorrectly | red.log / red-exit.json |
| `rtk npm test -- tests/tooling/hosted-artifact.test.ts tests/tooling/hosted-acceptance.test.ts` | GREEN exit0:21tests/2files | green.log / green-exit.json |
| `rtk npm run lint` | exit0 | lint.log / lint-exit.json |
| `rtk npm run typecheck` | exit0 | typecheck.log / typecheck-exit.json |
| Read-only corrected helper against actual untouched27 artifact with populated cache | PASS; all871inventoried files/buildId/aggregate exactly equal original | actual-artifact-readonly.json |

Fifteen new artifact cases cover cache population/refresh/removal; seven original-byte mutations (compiled route/server chunk/static chunk/app/lib/provider/lock); added code and a cache-lookalike sibling; removed compiled route; symlink at each cache boundary; nested response-cache symlink; regular file at response-cache boundary. Negative identity mismatches exercise the unchanged launcher's comparison contract. Six existing hosted credential/target/provider/archive tests also pass. Root explicitly scoped this to relevant tests/lint/types; unrelated whole suite/SQL/model/Workflow/build/runtime gates were not replayed.

Actual artifact remains `/private/tmp/serenia-hosted-build-Nd4nXo/project`, BUILD_ID `xhrWTx9JGknr6oTSmk6va`, lock SHA256 `e0f9eb1ffc90023ebb1b4bf2f1b7f85902f751229d2d679733f64f7b75fc1ed4`, original aggregate SHA256 **c3d0ddb6e48185deda89f9d4ec66b730bae6316f7aa2a17d6401497d8a3a9136**. Calling the new pure scanner reproduced the entire original artifact identity without reading credentials or starting Next. Existing artifact embeds the27 version of its own scripts; that original content is still verified byte for byte. A later invocation can use the separately committed external launcher while its Next child/provider remain the original snapshot.

## Runtime boundary and remaining work

Earlier actual hosted modes (fixtures/HTTP/intended retry/normal restart/review/cron/browser-fixtures) all exited0 before this source correction. The known9493→9673 same-original-run restart is already proven and is not repeated here. Root later verified PID9673 missing and handle89204 unknown; runtime is stopped at that observation, but termination cause/signal is not established. Do not attribute it to model interruption. Root reached browser PHQ9Q1, no answers submitted; navigation wait timeout followed by arrival is not declared a functional failure.

Root plus the same independent scoped reviewer must approve this exact helper delta before any normal restart. No new binary is required/created. Root must explicitly hand runtime control back and verify original artifact/state/port before launch. Existing fixtures/clocks/jobs are preserved; no timestamp refresh or fixture replay. UI, any after-browsing normal-restart acceptance and final scoped cleanup/postchecks remain pending, along with clinical/legal/model-quality/public-production gates. Root-owned application record and Postgres maintenance research are untouched.
