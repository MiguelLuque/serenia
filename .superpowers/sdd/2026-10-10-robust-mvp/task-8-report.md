# Security maintenance — 2026-10-14

Task8 BASE b67368eb2f2dfaf8c60e44fe3b82a5d1d92a8902 (controller plan after c88c11f). Source pins: Next/eslint-config-next16.4.0→16.4.1; React/DOM19.3.0→19.3.1. No product/clinical, Workflow SDK, SQL or runtime-harness source changes.

## Primary release evidence

- [Next16.4.1 release](https://github.com/vercel/next.js/releases/tag/v16.4.1), tag7217011, published14Oct15:39.
- [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr): Critical typed-array Cache Components RCE; Next16.4.1 fixes affected16.x through16.4.0, recommendation includes apps without matching cached functions.
- [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw): Critical glibc SVG optimizer RCE; Next16.4.1/sharp>=0.35.5. Existing locked sharp0.35.5 remains unchanged.
- [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r): High Server Action DoS; fixed16.4.1.
- [React19.3.1 release](https://github.com/facebook/react/releases/tag/v19.3.1) and [official release PR37845](https://github.com/facebook/react/pull/37845), commit61aa00d: contemporaneous RSC transport protocol patch. Paired React/DOM19.3.1 is compatible with Next's ^19 peer and DOM's ^19.3.1 peer; Next does not require this exact patch. No separate React advisory is claimed.

Installed npm metadata was retrieved from the public registry with a positive child environment, private empty user/global npm config and private cache; no global credentials/config read. Exact four pins installed with --ignore-scripts --no-audit --no-fund, exit0. Before editing, installed Next16 upgrading guide and dependency gate instructions were read.

## Exact graph and policy

Lock SHA256 **4f7ab0eee4e989a1dbabe3b6f248529db1859eb2c9899b87f91ab3ab00744e8a**. 1,059 lock entries, none added/removed. Fourteen package nodes change: Next, @next/env, eight platform SWC16.4.1 nodes, eslint-config-next/@next/eslint-plugin-next16.4.1, React/DOM19.3.1. Root dependency fields follow four pins. All other package nodes byte-equivalent as parsed JSON; scheduler0.28.0 and sharp0.35.5 unchanged. Private before-lock, registry metadata, install log and structural delta: .cache/task8/.

No compatible braces3 patch is published (registry versions3.0.0–3.0.3). Existing exact dev exception GHSA-vfj7-8cjw-p6xm retains expiry2026-10-18T00:00:00Z, eslint config SHA, unique consumer edges, advisory identity, dev-only and zero production requirements. Only parent versions/plugin edge change16.4.0→16.4.1. This remains a five-entry high inherited advisory, not a clean full audit. RED on new graph with old guard:2 failed/32 passed; GREEN after exact update:37/37, including negative old-parent-version and nonexact-edge cases. Full logs retained privately.

## Acceptance status

Source commit, all-seven native results, actual local-key artifact and scoped synthetic Auth/generated-Workflow smoke: pending at source freeze. Earlier720/all-seven and XSm build prove previous dependency source only. Evidence-only follow-up will record numeric exits and immutable identities.

Canonical hosted packet724e (92,971bytes) and forwardd9604 (5,172bytes) are unchanged, prepared-not-applied. No hosted writes/retries performed by Task8. Hosted acceptance and full release remain unresolved; root owns connector/remote gates. Existing I1 proof remains intact and M4 copy observation stays parked. No new same-run Workflow restart is claimed for unchanged SDK; historical Task6 restart evidence remains separately identified.

Implementation ledger: source freeze pending; next all-seven native gates and new local artifact normal-run smoke. Ruling: actual Task8 BASE is controller planning commit b67368e, not earlier brief base c88c11f; scope diff starts at actual clean dispatch HEAD.
